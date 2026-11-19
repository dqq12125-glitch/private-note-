import UIKit
import AuthenticationServices
import CryptoKit

// 「通过 Apple 登录」（Sign in with Apple）。iPhone 才有，给网页两个异步方法：
//   appleSignIn(id, nonce)           弹苹果的登录面板 → {identityToken, authorizationCode, user, email?, fullName?}，
//                                    自己点了取消 → {cancelled:true}（都是 'ok'）；出错 → 'fail' {error, message}
//   appleCredentialState(id, user)   这个 Apple ID 还授权着没有（在「设置」里停用了「通过 Apple 登录」就是 revoked）
// nonce：网页自己生成的随机串（至少 16 个字），这里把它的 SHA-256（小写十六进制）放进请求，
// 网页把**原文**和 identityToken 一起交给服务器（cloud/API.md §3 POST /v1/auth/apple），服务器核对。
// 要有 com.apple.developer.applesignin 这个权限（App/EchoIsland.entitlements，签名的正式包才带，见 make-config.mjs 的
// ECHO_APPLE_SIGNIN）。没带的包（云上模拟器的包都不签名）BuildConfig.appleSignIn = false：两个方法当场回
// {error:'unavailable'}，不去碰系统（不然苹果那边会回一个看不懂的 1000 号错）。
@MainActor
final class AppleSignIn: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    // 回给网页：ok = 'ok' / 'fail'，json 是 JSON 文字
    typealias Done = @MainActor @Sendable (_ ok: Bool, _ json: String) -> Void

    static let unavailableMessage = "Sign in with Apple is not available in this build (no Sign in with Apple entitlement)"
    // 这个包带没带「通过 Apple 登录」的权限（打包时 make-config.mjs 定的）
    static var available: Bool { return BuildConfig.appleSignIn }

    private let anchor: @MainActor () -> UIWindow?       // 登录面板挂在哪个窗口上（游戏画面的窗口）
    private var running: (key: ObjectIdentifier, controller: ASAuthorizationController, done: Done)?

    init(anchor: @escaping @MainActor () -> UIWindow?) {
        self.anchor = anchor
        super.init()
    }

    // ---------- 小工具（纯逻辑，测试直接调） ----------

    // SHA-256，小写十六进制（服务器拿原文算一遍，和 identityToken 里的 nonce 比）
    nonisolated static func sha256Hex(_ s: String) -> String {
        return SHA256.hash(data: Data(s.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    // nonce：16–256 个看得见的 ASCII 字（不许空格和控制字符）
    nonisolated static func okNonce(_ n: String) -> Bool {
        return n.count >= 16 && n.count <= 256 && n.unicodeScalars.allSatisfy { $0.value > 0x20 && $0.value < 0x7f }
    }

    nonisolated static func fail(_ error: String, _ message: String, _ extra: [String: Any] = [:]) -> (Bool, String) {
        var o: [String: Any] = ["error": error, "message": message]
        for (k, v) in extra { o[k] = v }
        return (false, Bridge.json(o))
    }

    // 登录成功：苹果给的凭证 → 给网页的 JSON。email、fullName 只有**第一次**授权时苹果才给（之后要从服务器拿）
    nonisolated static func result(_ authorization: ASAuthorization) -> (Bool, String) {
        guard let c = authorization.credential as? ASAuthorizationAppleIDCredential else {
            return fail("unexpected-credential", "the credential is not an Apple ID credential")
        }
        var o: [String: Any] = ["user": c.user]
        if let d = c.identityToken, let s = String(data: d, encoding: .utf8) { o["identityToken"] = s }
        if let d = c.authorizationCode, let s = String(data: d, encoding: .utf8) { o["authorizationCode"] = s }
        if let e = c.email, !e.isEmpty { o["email"] = e }
        if let n = c.fullName {
            var f: [String: Any] = [:]
            if let v = n.givenName, !v.isEmpty { f["givenName"] = v }
            if let v = n.middleName, !v.isEmpty { f["middleName"] = v }
            if let v = n.familyName, !v.isEmpty { f["familyName"] = v }
            if let v = n.nickname, !v.isEmpty { f["nickname"] = v }
            if !f.isEmpty { o["fullName"] = f }
        }
        switch c.realUserStatus {
        case .likelyReal: o["realUserStatus"] = "likelyReal"
        case .unknown: o["realUserStatus"] = "unknown"
        case .unsupported: o["realUserStatus"] = "unsupported"
        @unknown default: o["realUserStatus"] = "unknown"
        }
        if o["identityToken"] == nil { return fail("no-token", "Apple did not return an identity token") }
        return (true, Bridge.json(o))
    }

    // 出错：自己点了取消 → ok {cancelled:true}；别的 → fail。1000 号（unknown）多半是这个包没有权限、或者模拟器没登录 Apple 账户
    nonisolated static func errorResult(_ error: Error) -> (Bool, String) {
        let e = error as NSError
        if e.domain == ASAuthorizationError.errorDomain {
            if e.code == ASAuthorizationError.Code.canceled.rawValue { return (true, #"{"cancelled":true}"#) }
            let name: String
            switch e.code {
            case ASAuthorizationError.Code.unknown.rawValue: name = "unknown"
            case ASAuthorizationError.Code.invalidResponse.rawValue: name = "invalid-response"
            case ASAuthorizationError.Code.notHandled.rawValue: name = "not-handled"
            case ASAuthorizationError.Code.failed.rawValue: name = "failed"
            case ASAuthorizationError.Code.notInteractive.rawValue: name = "not-interactive"
            default: name = "failed"
            }
            var extra: [String: Any] = ["code": e.code]
            if name == "unknown" { extra["hint"] = "no Sign in with Apple entitlement in this build, or no Apple Account signed in on this device" }
            return fail(name, e.localizedDescription, extra)
        }
        return fail("failed", "\(e.domain) \(e.code)", ["code": e.code])
    }

    nonisolated static func stateName(_ s: ASAuthorizationAppleIDProvider.CredentialState) -> String {
        switch s {
        case .authorized: return "authorized"
        case .revoked: return "revoked"
        case .notFound: return "notFound"
        case .transferred: return "transferred"
        @unknown default: return "unknown"
        }
    }

    // 回到主线程再做（苹果的回调一般就在主线程上；不在的话排到主线程）
    nonisolated static func onMain(_ work: @escaping @MainActor @Sendable () -> Void) {
        if Thread.isMainThread {
            MainActor.assumeIsolated { work() }
        } else {
            DispatchQueue.main.async { MainActor.assumeIsolated { work() } }
        }
    }

    // ---------- 给网页的两个方法 ----------

    func signIn(nonce: String, done: @escaping Done) {
        let n = nonce.trimmingCharacters(in: .whitespacesAndNewlines)
        guard AppleSignIn.okNonce(n) else {
            let r = AppleSignIn.fail("bad-nonce", "nonce must be 16 to 256 visible ASCII characters")
            done(r.0, r.1)
            return
        }
        guard AppleSignIn.available else {
            let r = AppleSignIn.fail("unavailable", AppleSignIn.unavailableMessage)
            done(r.0, r.1)
            return
        }
        guard running == nil else {
            let r = AppleSignIn.fail("busy", "a Sign in with Apple sheet is already open")
            done(r.0, r.1)
            return
        }
        let req = ASAuthorizationAppleIDProvider().createRequest()
        req.requestedScopes = [.fullName, .email]
        req.nonce = AppleSignIn.sha256Hex(n)
        let c = ASAuthorizationController(authorizationRequests: [req])
        c.delegate = self
        c.presentationContextProvider = self
        running = (ObjectIdentifier(c), c, done)       // 留着它：系统只弱引用 controller
        c.performRequests()
    }

    func credentialState(user: String, done: @escaping Done) {
        let u = user.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !u.isEmpty, u.count <= 256 else {
            let r = AppleSignIn.fail("bad-user", "user is the Apple user id from appleSignIn")
            done(r.0, r.1)
            return
        }
        guard AppleSignIn.available else {
            let r = AppleSignIn.fail("unavailable", AppleSignIn.unavailableMessage)
            done(r.0, r.1)
            return
        }
        ASAuthorizationAppleIDProvider().getCredentialState(forUserID: u) { state, error in
            let r: (Bool, String) = error.map { AppleSignIn.errorResult($0) } ?? (true, Bridge.json(["state": AppleSignIn.stateName(state)]))
            AppleSignIn.onMain { done(r.0, r.1) }
        }
    }

    private func complete(_ key: ObjectIdentifier, _ r: (Bool, String)) {
        guard let run = running, run.key == key else { return }
        running = nil
        run.done(r.0, r.1)
    }

    // ---------- 系统回调（写成 nonisolated：不管 SDK 把这两个协议标没标主线程都编得过；回调本来就在主线程上） ----------

    nonisolated func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        let key = ObjectIdentifier(controller)
        let r = AppleSignIn.result(authorization)
        AppleSignIn.onMain { [weak self] in self?.complete(key, r) }
    }

    nonisolated func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let key = ObjectIdentifier(controller)
        let r = AppleSignIn.errorResult(error)
        AppleSignIn.onMain { [weak self] in self?.complete(key, r) }
    }

    nonisolated func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return MainActor.assumeIsolated { () -> UIWindow in
            if let w = self.anchor() { return w }
            // 游戏画面还没有窗口（不该发生）：随便找一个前台的窗口
            let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            if let w = scenes.flatMap({ $0.windows }).first(where: { $0.isKeyWindow }) { return w }
            if let s = scenes.first { return UIWindow(windowScene: s) }
            return UIWindow(frame: .zero)
        }
    }
}

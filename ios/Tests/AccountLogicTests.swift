import XCTest
import StoreKit
import AuthenticationServices
@testable import EchoIsland

// 订阅和「通过 Apple 登录」里不碰 App Store、不弹界面的那一层：参数检查、结果怎么回给网页。
// 真的买、续费、退款在 StoreKitTests.swift（要本地的 App Store，云上单独一步、指定模拟器的系统版本跑）。

private func parse(_ json: String) -> [String: Any] {
    return (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any] ?? [:]
}

// AppleSignIn 回给网页的话记在这里（回调是 @MainActor @Sendable 的）
@MainActor
private final class Answers {
    var items: [(Bool, [String: Any])] = []
}

final class StoreLogicTests: XCTestCase {
    func testProductIds() {
        XCTAssertTrue(Store.okId("com.echoisland.app.premium.monthly"))
        XCTAssertTrue(Store.okId("premium_yearly_2026"))
        XCTAssertFalse(Store.okId(""))
        XCTAssertFalse(Store.okId("com.echoisland app"))
        XCTAssertFalse(Store.okId("a,b"))
        XCTAssertFalse(Store.okId("../x"))
        XCTAssertFalse(Store.okId(String(repeating: "a", count: 101)))
    }

    // 买的四种结果分得开：取消、等家长批准都是 ok + status，网页不当出错
    func testPurchaseOutcomes() {
        let c = Store.outcome(Product.PurchaseResult.userCancelled)
        XCTAssertTrue(c.ok); XCTAssertEqual(c.body["status"] as? String, "cancelled")
        let p = Store.outcome(Product.PurchaseResult.pending)
        XCTAssertTrue(p.ok); XCTAssertEqual(p.body["status"] as? String, "pending")
        let thrown = Store.outcome(error: StoreKitError.userCancelled)
        XCTAssertTrue(thrown.ok, "有的系统版本取消是抛错：也按 cancelled 回")
        XCTAssertEqual(thrown.body["status"] as? String, "cancelled")
        let net = Store.outcome(error: StoreKitError.networkError(URLError(.notConnectedToInternet)))
        XCTAssertFalse(net.ok); XCTAssertEqual(net.body["error"] as? String, "network")
        XCTAssertEqual(Store.code(StoreKitError.notAvailableInStorefront), "storefront")
        XCTAssertEqual(Store.code(Product.PurchaseError.productUnavailable), "purchase")
        let j = parse(StoreReply.fail("bad-token", "x").json)
        XCTAssertEqual(j["error"] as? String, "bad-token"); XCTAssertEqual(j["message"] as? String, "x")
    }

    // 参数不对：当场回，不去问 App Store
    @MainActor
    func testBadArgumentsAnswerWithoutTheStore() async {
        let s = Store(monthly: "com.echoisland.app.premium.monthly", yearly: "com.echoisland.app.premium.yearly")
        var r = await s.buy("com.echoisland.app.premium.monthly", token: "not-a-uuid", confirmIn: nil)
        XCTAssertFalse(r.ok); XCTAssertEqual(r.body["error"] as? String, "bad-token", "没有账号的 UUID 不买（买了服务器对不上账号）")
        r = await s.buy("com.echoisland.app.premium.monthly", token: "", confirmIn: nil)
        XCTAssertEqual(r.body["error"] as? String, "bad-token")
        r = await s.buy("bad id", token: UUID().uuidString, confirmIn: nil)
        XCTAssertEqual(r.body["error"] as? String, "bad-product")
        r = await s.products("ok.id,bad id")
        XCTAssertEqual(r.body["error"] as? String, "bad-product")
        r = await s.finish("12ab")
        XCTAssertEqual(r.body["error"] as? String, "bad-id")
        r = await s.manage(in: nil)
        XCTAssertEqual(r.body["error"] as? String, "no-scene")
    }
}

final class AppleSignInTests: XCTestCase {
    func testNonceHashAndRules() {
        // 已知答案：SHA-256("abc")；服务器拿原文算一遍和 identityToken 里的比
        XCTAssertEqual(AppleSignIn.sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        XCTAssertTrue(AppleSignIn.okNonce("0123456789abcdef"))
        XCTAssertFalse(AppleSignIn.okNonce("short"))
        XCTAssertFalse(AppleSignIn.okNonce("0123456789 abcdef"), "不许空格")
        XCTAssertFalse(AppleSignIn.okNonce(String(repeating: "x", count: 257)))
    }

    func testErrorsTheWebCanTellApart() {
        let cancel = AppleSignIn.errorResult(ASAuthorizationError(.canceled))
        XCTAssertTrue(cancel.0, "自己点了取消不算出错")
        XCTAssertEqual(parse(cancel.1)["cancelled"] as? Bool, true)
        let failed = AppleSignIn.errorResult(ASAuthorizationError(.failed))
        XCTAssertFalse(failed.0); XCTAssertEqual(parse(failed.1)["error"] as? String, "failed")
        let unknown = parse(AppleSignIn.errorResult(ASAuthorizationError(.unknown)).1)
        XCTAssertEqual(unknown["error"] as? String, "unknown"); XCTAssertEqual(unknown["code"] as? Int, 1000)
        XCTAssertNotNil(unknown["hint"], "1000 号带一句原因（没有权限 / 没登录 Apple 账户）")
        XCTAssertEqual(AppleSignIn.stateName(.revoked), "revoked")
        XCTAssertEqual(AppleSignIn.stateName(.authorized), "authorized")
    }

    // 没带权限的包（云上的模拟器包）：当场回 unavailable，不碰系统、不崩
    @MainActor
    func testUnsignedBuildSaysNotAvailable() {
        let got = Answers()
        let a = AppleSignIn { nil }
        // 参数不对：哪个包都当场回
        a.signIn(nonce: "") { ok, json in got.items.append((ok, parse(json))) }
        a.credentialState(user: "") { ok, json in got.items.append((ok, parse(json))) }
        XCTAssertEqual(got.items.count, 2, "当场回的")
        XCTAssertEqual(got.items[0].1["error"] as? String, "bad-nonce")
        XCTAssertEqual(got.items[1].1["error"] as? String, "bad-user")
        guard !AppleSignIn.available else {
            print("EchoIsland tests: this build has the Sign in with Apple entitlement; the not-available answer is not checked")
            return
        }
        a.signIn(nonce: "0123456789abcdef0123") { ok, json in got.items.append((ok, parse(json))) }
        a.credentialState(user: "001234.abcdef") { ok, json in got.items.append((ok, parse(json))) }
        XCTAssertEqual(got.items.count, 4, "没带权限：也是当场回，不弹面板")
        XCTAssertEqual(got.items[2].1["error"] as? String, "unavailable")
        XCTAssertTrue((got.items[2].1["message"] as? String ?? "").contains("not available in this build"))
        XCTAssertEqual(got.items[3].1["error"] as? String, "unavailable")
        XCTAssertFalse(got.items.contains { $0.0 }, "都是 fail")
    }
}

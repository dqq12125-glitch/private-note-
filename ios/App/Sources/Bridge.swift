import UIKit
import WebKit
import AVFoundation
import UniformTypeIdentifiers

// 原生桥：给网页用的 window.EchoNative。方法名、参数、返回值和安卓 MainActivity 的 Native 一一对应
// （表在 android/README.md；tests/ios.test.js 核对这里、echo-native.js、README 三处对得上）。
// 安卓上网页是同步调用的，iPhone 上分两条路：
//   同步（要返回值、或者后面紧跟着要读结果的）：网页 window.prompt('__echo_native__:{…}') → GameViewController 的 prompt 回调 → callSync
//   异步（连阿里云的四个，没有返回值）：webkit.messageHandlers.echo.postMessage({…}) → callAsync，结果用 window.__echoNative(...) 回
// 网页拿不到密钥本身，只能请这里带着密钥去连阿里云。全部在主线程上跑。
// iPhone 才有的方法（订阅 Store.swift、「通过 Apple 登录」AppleSignIn.swift、口语题的本机识别 LocalSpeech.swift）都是异步的，写在 iosOnlyMethods 里；
// 安卓那边以后接 Google Play 结算时再加对应的（tests/ios.test.js 的 IOS_ONLY 表核对这三处和自测页）。
@MainActor
final class Bridge: NSObject, WKScriptMessageHandler, UIDocumentPickerDelegate {
    static let tag = "__echo_native__:"
    static let handlerName = "echo"
    // 同步的方法和异步的方法（tests/ios.test.js 拿这两张表和 echo-native.js、android/README.md 对）
    static let syncMethods = ["hasKey", "setKey", "setOrientation", "version", "diag", "takeRecovered", "edition", "verUrl", "books", "storage",
                              "hasPin", "checkPin", "pinStatus", "setPin", "micPermission", "openAppSettings",
                              "backupWrite", "backupList", "backupRead", "backupPick", "shareText", "shareFile"]
    static let asyncMethods = ["wsOpen", "wsSend", "wsClose", "post",
                               "iapProducts", "iapBuy", "iapRestore", "iapCurrent", "iapPending", "iapFinish", "iapManage",
                               "appleSignIn", "appleCredentialState",
                               "speechState", "speechStart", "speechFeed", "speechStop"]
    // 上面这些里 iPhone 才有的（安卓的 MainActivity 里没有；以后安卓接 Google Play 结算再说）
    static let iosOnlyMethods = ["iapProducts", "iapBuy", "iapRestore", "iapCurrent", "iapPending", "iapFinish", "iapManage",
                                 "appleSignIn", "appleCredentialState",
                                 "speechState", "speechStart", "speechFeed", "speechStop"]
    // 销售版（公开发的版本，ECHO_EDITION 不写就是它）：没有打包的密钥和家长密码，家长在首次设置向导里设
    static let sales = BuildConfig.edition != "family"
    static let shareTextMax = 8000                       // 比这长的文字改成文件分享（整个存档当文字发不出去）
    #if DEBUG
    static let isDebug = true
    #else
    static let isDebug = false
    #endif

    weak var host: GameViewController?
    let pin: PinGuard
    private let defaults = UserDefaults.standard
    private let backups = BackupStore()
    private var micLast = ""
    private(set) lazy var net = DashScope { [weak self] gen, id, type, data in self?.callback(gen, id, type, data) }
    // 「通过 Apple 登录」的面板挂在游戏画面的窗口上
    private lazy var apple = AppleSignIn { [weak self] in self?.host?.view.window }
    // 口语题的本机识别（LocalSpeech.swift，只管识别，声音由网页录了送来）：过程（边说边出的字、出声 / 不出声、停了）用事件 echo-speech 发给网页
    // 引擎：iOS 26 上这门语言的新模型装好了用 SpeechAnalyzer，不然 SFSpeechRecognizer（HybridSpeechEngine，2026-11-22）
    private(set) lazy var speech = LocalSpeech(engine: HybridSpeechEngine()) { [weak self] detail in
        self?.emit("echo-speech", "JSON.parse(" + Bridge.jsStr(Bridge.json(detail)) + ")")
    }

    override init() {
        // 家长密码：家庭版用打包时的哈希；销售版打包时没有，家长在首次设置向导里设（setPin），哈希和随机盐存在 UserDefaults
        pin = PinGuard(salt: BuildConfig.parentPinSalt, hash: BuildConfig.parentPinHash,
                       store: DefaultsPinStore(), clock: SystemPinClock(), allowSet: Bridge.sales)
        super.init()
        // 全新安装第一次打开：钥匙串里上一次安装留下的密钥先清掉（删 App 不会清钥匙串）
        if !defaults.bool(forKey: "installed") {
            KeyStore.write("")
            defaults.set(true, forKey: "installed")
        }
        micLast = Bridge.micState()
        // 订阅：Transaction.updates 来的交易（续费、退款、家长批准了的「请求购买」）发事件 echo-iap 给网页。
        // 网页还没打开时来的不会丢：网页打开后调 iapPending 拿还没 finish 的
        Store.shared.onEvent = { [weak self] detail in
            self?.emit("echo-iap", "JSON.parse(" + Bridge.jsStr(Bridge.json(detail)) + ")")
        }
    }

    // 密钥：手机上家长填的优先（钥匙串）；没有就用打包时带的（只有家庭版有）。两个都空时连接一律按「没有密钥」回
    private func key() -> String {
        let k = KeyStore.read()
        return k.isEmpty ? BuildConfig.dashscopeKey : k
    }

    // ---------- 小工具（纯文字处理，哪个线程都能调） ----------

    // 写成一段 JS / JSON 里的字符串（和安卓的 jsStr 一样：引号、反斜杠、控制字符、< 和两个行分隔符都转掉）
    nonisolated static func jsStr(_ v: String) -> String {
        var out = "\""
        out.reserveCapacity(v.utf8.count + 2)
        for u in v.unicodeScalars {
            if u == "\"" { out += "\\\"" }
            else if u == "\\" { out += "\\\\" }
            else if u.value < 0x20 || u == "<" || u.value == 0x2028 || u.value == 0x2029 { out += String(format: "\\u%04x", u.value) }
            else { out.unicodeScalars.append(u) }
        }
        return out + "\""
    }

    nonisolated static func json(_ o: Any) -> String {
        guard JSONSerialization.isValidJSONObject(o), let d = try? JSONSerialization.data(withJSONObject: o),
              let s = String(data: d, encoding: .utf8) else { return "{}" }
        return s
    }

    // 回给网页的值：布尔 → true / false，字符串 → "…"，没有返回值 → null
    nonisolated static func encode(_ v: Any?) -> String {
        if let b = v as? Bool { return b ? "true" : "false" }
        if let s = v as? String { return jsStr(s) }
        return "null"
    }

    nonisolated static func str(_ a: [Any], _ i: Int) -> String {
        guard i < a.count else { return "" }
        if let s = a[i] as? String { return s }
        if a[i] is NSNull { return "" }
        if let n = a[i] as? NSNumber { return n.stringValue }
        return ""
    }

    nonisolated static func int(_ a: [Any], _ i: Int) -> Int {
        guard i < a.count else { return 0 }
        if let n = a[i] as? NSNumber { return n.intValue }
        if let s = a[i] as? String { return Int(s) ?? 0 }
        return 0
    }

    // 只许字母数字 . _ -，不能以 . 开头，最长 80
    nonisolated static func okName(_ n: String) -> Bool {
        let ok = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-")
        return n.count >= 1 && n.count <= 80 && !n.hasPrefix(".") && n.unicodeScalars.allSatisfy { ok.contains($0) }
    }

    // 只认自己的网页（echoisland://localhost）
    static func trusted(_ o: WKSecurityOrigin) -> Bool {
        return o.`protocol`.lowercased() == WebAssets.scheme && o.host.lowercased() == WebAssets.host
    }

    nonisolated private static func machine() -> String {
        var size = 0
        if sysctlbyname("hw.machine", nil, &size, nil, 0) != 0 || size <= 1 || size > 128 { return "" }
        var buf = [CChar](repeating: 0, count: size)
        if sysctlbyname("hw.machine", &buf, &size, nil, 0) != 0 { return "" }
        return String(cString: buf)
    }

    // 等这一次网页的调用回完了再做（弹分享面板、文件选择器、跳到「设置」：不在 prompt 的回调里面弹界面）
    private func later(_ work: @escaping @MainActor @Sendable () -> Void) {
        DispatchQueue.main.async { MainActor.assumeIsolated { work() } }
    }

    // ---------- 回调网页 ----------

    // window.__echoNative(id, 类型, 数据)。gen = 发起时是第几个网页，网页重建过就不发了
    private func callback(_ gen: Int, _ id: Int, _ type: String, _ data: String) {
        guard let h = host, gen == h.gen else { return }
        h.runJS("window.__echoNative&&window.__echoNative(\(id),\(Bridge.jsStr(type)),\(Bridge.jsStr(data)))")
    }

    // 给网页发一个事件：window.dispatchEvent(new CustomEvent(名字, {detail: …}))。detailJs 是一段 JS 表达式
    private func emit(_ event: String, _ detailJs: String) {
        host?.runJS("window.dispatchEvent(new CustomEvent(\(Bridge.jsStr(event)),{detail:\(detailJs)}))")
    }

    // ---------- 入口 ----------

    // 网页的 prompt：是桥的就办了、返回要回给网页的 JSON 文字；不是桥的返回 nil（那是网页自己的输入框）
    func handlePrompt(_ prompt: String) -> String? {
        guard prompt.hasPrefix(Bridge.tag) else { return nil }
        let body = String(prompt.dropFirst(Bridge.tag.count))
        guard let o = (try? JSONSerialization.jsonObject(with: Data(body.utf8))) as? [String: Any], let m = o["m"] as? String else { return "null" }
        return Bridge.encode(callSync(m, o["a"] as? [Any] ?? []))
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == Bridge.handlerName, message.frameInfo.isMainFrame, Bridge.trusted(message.frameInfo.securityOrigin),
              let o = message.body as? [String: Any], let m = o["m"] as? String else { return }
        callAsync(m, o["a"] as? [Any] ?? [])
    }

    // 同步的方法（每个 case 一个方法，名字和安卓一样）
    func callSync(_ m: String, _ a: [Any]) -> Any? {
        switch m {
        // ---- AI 密钥 ----
        case "hasKey":
            return !key().isEmpty
        case "setKey":
            KeyStore.write(Bridge.str(a, 0).trimmingCharacters(in: .whitespacesAndNewlines))
            return nil
        // ---- 设置、版本、诊断 ----
        case "setOrientation":
            let v = Bridge.str(a, 0)
            let mode = v == "landscape" || v == "auto" ? v : "portrait"
            defaults.set(mode, forKey: "orient")
            host?.applyOrientation(mode)
            return nil
        case "version":
            return "{\"code\":\(BuildConfig.versionCode),\"name\":\(Bridge.jsStr(BuildConfig.versionName))}"
        case "diag":
            return diagJson()
        case "takeRecovered":
            return host?.takeRecovered() ?? false
        case "edition":
            return Bridge.sales ? "sales" : "family"
        case "verUrl":
            return BuildConfig.verUrl
        case "books":
            return BuildConfig.books
        case "storage":
            return storageJson()
        // ---- 家长密码 ----
        case "hasPin":
            return pin.has()
        case "checkPin":
            return pin.check(Bridge.str(a, 0))
        case "pinStatus":
            return pin.statusJson()
        case "setPin":
            // 只有销售版能在手机上设 / 改家长密码（4 位数字）。还没有密码时直接设；已经有了要 2 分钟内刚 checkPin 对过
            return Bridge.sales && pin.set(Bridge.str(a, 0))
        // ---- 麦克风 ----
        case "micPermission":
            return Bridge.micState()
        case "openAppSettings":
            if let u = URL(string: UIApplication.openSettingsURLString) {
                later { UIApplication.shared.open(u, options: [:], completionHandler: nil) }
            }
            return true
        // ---- 存档备份和导出 ----
        case "backupWrite":
            let json = Bridge.str(a, 0)
            if !json.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("{") { return false }
            return backups.write(json, excludeFromBackup: Bridge.sales)
        case "backupList":
            return BackupNames.listJson(backups.list())
        case "backupRead":
            return backups.read(Bridge.str(a, 0))
        case "backupPick":
            later { [weak self] in self?.pick() }
            return true
        case "shareText":
            return shareText(Bridge.str(a, 0), Bridge.str(a, 1))
        case "shareFile":
            let name = Bridge.str(a, 1)
            if a.count < 3 || a[2] is NSNull || !Bridge.okName(name) || !(name.hasSuffix(".json") || name.hasSuffix(".txt")) { return false }
            return shareAsFile(Bridge.str(a, 0), name, Bridge.str(a, 2))
        default:
            return nil
        }
    }

    // 异步的方法：连阿里云（带密钥）。结果回调 window.__echoNative(id, …)
    func callAsync(_ m: String, _ a: [Any]) {
        guard let h = host else { return }
        switch m {
        case "wsOpen":
            net.wsOpen(gen: h.gen, id: Bridge.int(a, 0), url: Bridge.str(a, 1), key: key())
        case "wsSend":
            net.wsSend(id: Bridge.int(a, 0), text: Bridge.str(a, 1))
        case "wsClose":
            net.wsClose(id: Bridge.int(a, 0))
        case "post":
            net.post(gen: h.gen, id: Bridge.int(a, 0), url: Bridge.str(a, 1), body: Bridge.str(a, 2), key: key())
        // ---- 订阅（iPhone 才有，Store.swift）：结果 window.__echoNative(id, 'ok' / 'fail', JSON 文字) ----
        case "iapProducts":
            let ids = Bridge.str(a, 1)
            storeCall(h.gen, Bridge.int(a, 0)) { await Store.shared.products(ids) }
        case "iapBuy":
            let product = Bridge.str(a, 1), token = Bridge.str(a, 2)
            storeCall(h.gen, Bridge.int(a, 0)) { [weak h] in await Store.shared.buy(product, token: token, confirmIn: h) }
        case "iapRestore":
            storeCall(h.gen, Bridge.int(a, 0)) { await Store.shared.restore() }
        case "iapCurrent":
            storeCall(h.gen, Bridge.int(a, 0)) { await Store.shared.current() }
        case "iapPending":
            storeCall(h.gen, Bridge.int(a, 0)) { await Store.shared.pending() }
        case "iapFinish":
            let tx = Bridge.str(a, 1)
            storeCall(h.gen, Bridge.int(a, 0)) { await Store.shared.finish(tx) }
        case "iapManage":
            storeCall(h.gen, Bridge.int(a, 0)) { [weak h] in await Store.shared.manage(in: h?.view.window?.windowScene) }
        // ---- 通过 Apple 登录（iPhone 才有，AppleSignIn.swift） ----
        case "appleSignIn":
            let gen = h.gen, id = Bridge.int(a, 0)
            apple.signIn(nonce: Bridge.str(a, 1)) { [weak self] ok, json in self?.callback(gen, id, ok ? "ok" : "fail", json) }
        case "appleCredentialState":
            let gen = h.gen, id = Bridge.int(a, 0)
            apple.credentialState(user: Bridge.str(a, 1)) { [weak self] ok, json in self?.callback(gen, id, ok ? "ok" : "fail", json) }
        // ---- 口语题的本机识别（iPhone 才有，LocalSpeech.swift）：结果 window.__echoNative(id, 'ok' / 'fail', JSON)，过程是事件 echo-speech。
        //      麦克风归网页：网页录到的声音用 speechFeed 一段段送来（不回话，和 wsSend 一样） ----
        case "speechState":
            callback(h.gen, Bridge.int(a, 0), "ok", Bridge.json(speech.state()))
        case "speechStart":
            let gen = h.gen, id = Bridge.int(a, 0)
            speech.start(sid: id, opts: Bridge.str(a, 1)) { [weak self] ok, body in self?.callback(gen, id, ok ? "ok" : "fail", Bridge.json(body)) }
        case "speechFeed":
            speech.feed(sid: Bridge.int(a, 0), b64: Bridge.str(a, 1))
        case "speechStop":
            let had = speech.stop(reason: "stop")
            callback(h.gen, Bridge.int(a, 0), "ok", Bridge.json(["stopped": had]))
        default:
            break
        }
    }

    // 订阅的方法：在主线程上等 StoreKit 办完，回 window.__echoNative(id, 'ok' / 'fail', JSON)。网页重建过（gen 变了）就不回
    private func storeCall(_ gen: Int, _ id: Int, _ work: @escaping @MainActor @Sendable () async -> StoreReply) {
        Task { @MainActor [weak self] in
            let r = await work()
            self?.callback(gen, id, r.ok ? "ok" : "fail", r.json)
        }
    }

    // ---------- 版本和诊断 ----------

    // 安卓的 diag() 有 sdk / android / webview；这里换成 platform / ios / model（setup.js 的设备检查认 platform = ios）
    private func diagJson() -> String {
        let o: [String: Any] = [
            "renderGone": defaults.integer(forKey: "goneCount"),
            "lastGone": Int64(defaults.double(forKey: "goneLast")),
            "lastCrash": false,                          // iPhone 上分不出「崩了」还是「被系统收回内存」
            "platform": "ios",
            "ios": UIDevice.current.systemVersion,
            "model": Bridge.machine(),
            "webview": "WebKit",
            "debug": Bridge.isDebug,
            "micLastDeny": [String: Any](),
            // iPhone 才有：这个包能不能「通过 Apple 登录」（签名的正式包才带权限），订阅的两个商品编号
            "appleSignIn": AppleSignIn.available,
            "iapProducts": [BuildConfig.iapMonthly, BuildConfig.iapYearly],
        ]
        return Bridge.json(o)
    }

    // {"free":剩余字节,"total":总字节,"ram":内存字节}
    private func storageJson() -> String {
        let home = URL(fileURLWithPath: NSHomeDirectory())
        let v = try? home.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey, .volumeTotalCapacityKey])
        let free: Int64 = v?.volumeAvailableCapacityForImportantUsage ?? 0
        let total: Int64 = Int64(v?.volumeTotalCapacity ?? 0)
        return "{\"free\":\(free),\"total\":\(total),\"ram\":\(ProcessInfo.processInfo.physicalMemory)}"
    }

    // ---------- 麦克风 ----------

    // granted 允许了 / denied 还没问过（再开口会弹系统框）/ blocked 拒绝过了（iPhone 不会再弹框，只能去「设置」里打开）
    static func micState() -> String {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized: return "granted"
        case .notDetermined: return "denied"
        default: return "blocked"
        }
    }

    // 麦克风状态变了（系统弹窗点完、从「设置」里打开回来）就告诉网页：事件 echo-mic
    func notifyMic() {
        let s = Bridge.micState()
        let changed = !micLast.isEmpty && micLast != s
        micLast = s
        if changed { emit("echo-mic", Bridge.jsStr(s)) }
    }

    // 销售版：App 数据（网页的存档）不跟着 iCloud / 电脑备份走（安卓销售版 allowBackup=false 的意思）。每次回到前台补一下
    func applyBackupPolicy() {
        guard Bridge.sales, let lib = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first else { return }
        var web = lib.appendingPathComponent("WebKit", isDirectory: true)
        guard FileManager.default.fileExists(atPath: web.path) else { return }
        var rv = URLResourceValues()
        rv.isExcludedFromBackup = true
        try? web.setResourceValues(rv)
    }

    // ---------- 分享（导出存档） ----------

    private func presentShare(_ items: [Any]) {
        let vc = UIActivityViewController(activityItems: items, applicationActivities: nil)
        later { [weak self] in
            guard let h = self?.host else { return }
            if let pop = vc.popoverPresentationController {
                pop.sourceView = h.view
                pop.sourceRect = CGRect(x: h.view.bounds.midX, y: h.view.bounds.midY, width: 1, height: 1)
                pop.permittedArrowDirections = []
            }
            h.top().present(vc, animated: true)
        }
    }

    private func shareAsFile(_ title: String, _ name: String, _ text: String) -> Bool {
        let fm = FileManager.default
        let dir = fm.temporaryDirectory.appendingPathComponent("share", isDirectory: true)
        try? fm.removeItem(at: dir)                      // 只留这一份
        do {
            try fm.createDirectory(at: dir, withIntermediateDirectories: true)
            let file = dir.appendingPathComponent(name, isDirectory: false)
            try Data(text.utf8).write(to: file, options: [.atomic])
            presentShare([file])
            return true
        } catch {
            return false
        }
    }

    private func shareText(_ title: String, _ text: String) -> Bool {
        if text.isEmpty { return false }
        if text.count > Bridge.shareTextMax {            // 太长（整个存档）：改成发文件
            let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
            let day = BackupStore.today()
            return shareAsFile(title, t.hasPrefix("{") || t.hasPrefix("[") ? "echo-save-\(day).json" : "echo-island-\(day).txt", text)
        }
        presentShare([text])
        return true
    }

    // ---------- 从文件恢复存档 ----------

    private func pick() {
        guard let h = host else { emitPicked(false, "", nil, "no picker"); return }
        let types: [UTType] = [.json, .plainText, .data]
        let p = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
        p.delegate = self
        p.allowsMultipleSelection = false
        p.directoryURL = backups.dir                     // 先打开 App 自己放备份的文件夹
        h.top().present(p, animated: true)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let u = urls.first else { emitPicked(false, "", nil, "cancel"); return }
        let name = u.lastPathComponent
        let scoped = u.startAccessingSecurityScopedResource()
        defer { if scoped { u.stopAccessingSecurityScopedResource() } }
        guard let size = (try? u.resourceValues(forKeys: [.fileSizeKey]))?.fileSize else { emitPicked(false, name, nil, "read"); return }
        if size > BackupStore.pickMax { emitPicked(false, name, nil, "too big"); return }
        guard let d = try? Data(contentsOf: u), let s = String(data: d, encoding: .utf8) else { emitPicked(false, name, nil, "read"); return }
        emitPicked(true, name, s, nil)
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        emitPicked(false, "", nil, "cancel")
    }

    // 事件 echo-backup-picked：{ok:true, name, text} 或 {ok:false, name, error:'cancel' / 'read' / 'too big' / 'no picker'}
    private func emitPicked(_ ok: Bool, _ name: String, _ text: String?, _ error: String?) {
        var o: [String: Any] = ["ok": ok, "name": name]
        if let t = text { o["text"] = t }
        if let e = error { o["error"] = e }
        emit("echo-backup-picked", "JSON.parse(" + Bridge.jsStr(Bridge.json(o)) + ")")
    }
}

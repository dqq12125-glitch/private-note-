import XCTest
import WebKit
@testable import EchoIsland

// 纯逻辑的测试，在模拟器里跑（云上的 Mac：.github/workflows/ios-simulator.yml）。
// 家长密码和备份文件名这两段是照着 tests/native.test.js 里那个 Java 小程序一条一条搬过来的：
// 安卓那边用 JDK 实测的每一种情况，这里用同样的数字再测一遍。
// 碰到界面那一层（WebAssetHandler、Bridge、DashScope 的回调）的测试标了 @MainActor：它们本来就只在主线程上跑。

private final class MemStore: PinStore {
    var longs: [String: Int64] = [:]
    var strs: [String: String] = [:]
    func getLong(_ k: String, _ d: Int64) -> Int64 { return longs[k] ?? d }
    func putLongs(_ keys: [String], _ vals: [Int64]) { for i in 0..<keys.count { longs[keys[i]] = vals[i] } }
    func getStr(_ k: String, _ d: String) -> String { return strs[k] ?? d }
    func putStrs(_ keys: [String], _ vals: [String]) { for i in 0..<keys.count { strs[keys[i]] = vals[i] } }
}

private final class FakeClock: PinClock {
    var wallMs: Int64 = 1_790_000_000_000
    var elapsedMs: Int64 = 3_600_000
    var bootId: Int64 = 7
    func wall() -> Int64 { return wallMs }
    func elapsed() -> Int64 { return elapsedMs }
    func boot() -> Int64 { return bootId }
}

// DashScope 回给网页的话记在这里（回调是 @MainActor @Sendable 的，不能直接改外面的局部变量）
@MainActor
private final class Got {
    var items: [[String]] = []
}

final class PinGuardTests: XCTestCase {
    private let salt = "echo-island-parent-pin-v1:"
    private let pin = "2468"
    // 「盐 + 2468」的 SHA-256：tests/ios.test.js 用 Node 算一遍核对这一行（和 build.gradle、make-config.mjs 的算法一样）
    private let knownHash = "029c8cadc9e96dff52ae2eaf9e054115b20b4ba2a5ac78169efeccae3ea384d1"

    private func status(_ g: PinGuard) -> [String: Any] {
        let d = Data(g.statusJson().utf8)
        return (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] ?? [:]
    }

    private func wrong(_ g: PinGuard, _ n: Int) { for _ in 0..<n { _ = g.check("0000") } }

    func testHashIsSaltPlusPinSha256() {
        // 已知答案：SHA-256("abc")
        XCTAssertEqual(PinGuard.sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        XCTAssertEqual(PinGuard.sha256Hex(salt + pin), knownHash, "和 Node（make-config.mjs）、Java（build.gradle）算的一样")
        XCTAssertEqual(BuildConfig.parentPinSalt, salt, "打包设置里的盐和安卓一样")
    }

    func testNoBakedPinMeansNoParentAccess() {
        let g = PinGuard(salt: salt, hash: "", store: MemStore(), clock: FakeClock())
        XCTAssertFalse(g.has())
        XCTAssertFalse(g.check(pin))
    }

    func testLockoutLikeAndroid() {
        let st = MemStore(), ck = FakeClock()
        let g = PinGuard(salt: salt, hash: knownHash, store: st, clock: ck)
        XCTAssertTrue(g.has())
        XCTAssertTrue(g.check(pin))
        XCTAssertFalse(g.check(""))
        XCTAssertEqual(g.triesLeft(), 5, "空密码不算一次")
        wrong(g, 4)
        XCTAssertEqual(g.triesLeft(), 1)
        XCTAssertTrue(g.check(pin))
        XCTAssertEqual(g.triesLeft(), 5, "输对就清零")
        wrong(g, 5)
        let s = status(g)
        XCTAssertEqual(s["locked"] as? Bool, true)
        XCTAssertEqual(s["waitSec"] as? Int, 600)
        XCTAssertEqual(s["triesLeft"] as? Int, 0)
        XCTAssertEqual(s["lockouts"] as? Int, 1)
        XCTAssertFalse(g.check(pin), "锁着的时候对的密码也不放行")
        ck.wallMs += 24 * 3_600_000
        XCTAssertTrue(g.waitMs() > 0, "同一次开机：把手机时钟往后调没用")
        ck.elapsedMs += 9 * 60_000
        XCTAssertTrue(g.waitMs() > 0)
        ck.elapsedMs += 61_000
        XCTAssertEqual(g.waitMs(), 0, "10 分钟后解锁")
        XCTAssertTrue(g.check(pin))
        wrong(g, 5)
        ck.bootId = 8; ck.elapsedMs = 1_000; ck.wallMs += 5 * 60_000        // 重启过：按手机时钟，还剩 5 分钟
        XCTAssertEqual((g.waitMs() + 999) / 1000, 300)
        ck.wallMs += 6 * 60_000
        XCTAssertEqual(g.waitMs(), 0)
        wrong(g, 5)
        ck.bootId = 9; ck.wallMs -= 24 * 3_600_000                          // 重启 + 时钟往回调一天：最多锁 10 分钟
        XCTAssertEqual((g.waitMs() + 999) / 1000, 600)
        XCTAssertEqual(status(g)["lockouts"] as? Int, 3)
    }

    func testBootIdUnknownFallsBackToWallClock() {
        let st = MemStore(), ck = FakeClock()
        ck.bootId = -1                                                      // 读不到开机编号（SystemPinClock.boot() 的退路）
        let g = PinGuard(salt: salt, hash: knownHash, store: st, clock: ck)
        wrong(g, 5)
        XCTAssertEqual((g.waitMs() + 999) / 1000, 600)
        ck.wallMs += 10 * 60_000 + 1
        XCTAssertEqual(g.waitMs(), 0)
    }

    func testSalesEditionSetsPinOnThePhone() {
        let st = MemStore(), ck = FakeClock()
        // 家庭版（allowSet = false）：不能在手机上设，也不认手机上存的
        let fam = PinGuard(salt: salt, hash: "", store: st, clock: ck)
        XCTAssertFalse(fam.set("2580")); XCTAssertFalse(fam.has()); XCTAssertFalse(fam.canSet())
        let g = PinGuard(salt: salt, hash: "", store: st, clock: ck, allowSet: true)
        XCTAssertFalse(g.has()); XCTAssertTrue(g.canSet()); XCTAssertFalse(g.check("2580"))
        XCTAssertFalse(g.set("12a4")); XCTAssertFalse(g.set("123")); XCTAssertFalse(g.set(""))
        XCTAssertTrue(g.set("2580")); XCTAssertTrue(g.has()); XCTAssertFalse(g.canSet(), "设完要重新输对才能再改")
        let salt1 = st.strs["pinSalt"] ?? ""
        XCTAssertTrue(salt1.hasPrefix("echo-island-parent-pin-v2:"))
        XCTAssertEqual(salt1.count, "echo-island-parent-pin-v2:".count + 32)
        XCTAssertEqual(st.strs["pinHash"], PinGuard.sha256Hex(salt1 + "2580"))
        XCTAssertFalse(st.strs.values.contains("2580"), "原文不存")
        XCTAssertFalse(g.check("0000")); XCTAssertTrue(g.check("2580"))
        XCTAssertTrue(g.canSet()); XCTAssertTrue(g.set("3691"))
        XCTAssertNotEqual(st.strs["pinSalt"], salt1, "每次换一个新盐")
        XCTAssertFalse(g.check("2580")); XCTAssertTrue(g.check("3691"))
        ck.elapsedMs += 3 * 60_000
        XCTAssertFalse(g.canSet()); XCTAssertFalse(g.set("1470"), "过了 2 分钟不能改")
        XCTAssertTrue(g.check("3691")); XCTAssertFalse(g.check("1111")); XCTAssertFalse(g.canSet(), "刚输错一次就不能改")
        let again = PinGuard(salt: salt, hash: "", store: st, clock: ck, allowSet: true)   // 重开 App
        XCTAssertTrue(again.has()); XCTAssertFalse(again.canSet()); XCTAssertTrue(again.check("3691"))
        XCTAssertFalse(PinGuard(salt: salt, hash: "", store: st, clock: ck).has(), "家庭版不认手机上存的")
        XCTAssertFalse(PinGuard(salt: salt, hash: knownHash, store: st, clock: ck, allowSet: true).set("2222"), "打包了密码的不许改")
        wrong(again, 5)
        XCTAssertFalse(again.check("3691"))
        let s = status(again)
        XCTAssertEqual(s["has"] as? Bool, true); XCTAssertEqual(s["locked"] as? Bool, true)
        XCTAssertEqual(s["waitSec"] as? Int, 600); XCTAssertEqual(s["canSet"] as? Bool, false)
    }

    func testRealClockAndStore() {
        let ck = SystemPinClock()
        XCTAssertGreaterThan(ck.wall(), 1_700_000_000_000)
        let a = ck.elapsed()
        XCTAssertGreaterThan(a, 0)
        XCTAssertGreaterThanOrEqual(ck.elapsed(), a)
        XCTAssertEqual(ck.boot(), ck.boot(), "同一次开机编号不变")
        // 读不到开机编号（-1）也能用，只是改时钟能解锁：打印出来看一眼
        print("EchoIsland tests: boot id known = \(ck.boot() >= 0)")
        let d = UserDefaults(suiteName: "echo-tests-\(UUID().uuidString)")!
        let st = DefaultsPinStore(d)
        XCTAssertEqual(st.getLong("x", -2), -2)
        st.putLongs(["x", "y"], [1_790_000_000_000, 5])
        XCTAssertEqual(st.getLong("x", 0), 1_790_000_000_000)
        st.putStrs(["s"], ["v"])
        XCTAssertEqual(st.getStr("s", ""), "v")
    }
}

final class BackupNamesTests: XCTestCase {
    func testNames() {
        XCTAssertEqual(BackupNames.forDay("20261007"), "echo-save-20261007.json")
        XCTAssertTrue(BackupNames.valid("echo-save-20261007.json"))
        XCTAssertTrue(BackupNames.valid("echo-save-20261007 (1).json"))
        XCTAssertTrue(BackupNames.valid("echo-save-20261007 (1234).json"))
        XCTAssertFalse(BackupNames.valid("../echo-save-20261007.json"))
        XCTAssertFalse(BackupNames.valid("echo-save-2026107.json"))
        XCTAssertFalse(BackupNames.valid("echo-save-20261007.json.tmp"))
        XCTAssertFalse(BackupNames.valid("echo-save-20261007 (12345).json"))
        XCTAssertFalse(BackupNames.valid("echo-save-20261007 ().json"))
        XCTAssertFalse(BackupNames.valid("echo-save-2026100a.json"))
        XCTAssertFalse(BackupNames.valid(nil))
        XCTAssertEqual(BackupNames.day("echo-save-20261007 (1).json"), "20261007")
    }

    func testKeepSeven() {
        var ten: [BackupNames.Item] = []
        for d in 1...10 { ten.append(BackupNames.Item(id: Int64(d), name: String(format: "echo-save-202610%02d.json", d), size: Int64(100 + d), time: Int64(d) * 1000)) }
        XCTAssertEqual(BackupNames.toDelete(ten, keepName: "echo-save-20261010.json").map { $0.id }, [3, 2, 1])
        // 有一份是日期被往后调时写的（2027 年），刚写的是 10/3：刚写的不删，共留 7 份
        var fut = ten
        fut.append(BackupNames.Item(id: 99, name: "echo-save-20271231.json", size: 5, time: 1))
        XCTAssertEqual(BackupNames.toDelete(fut, keepName: "echo-save-20261003.json").map { $0.id }, [5, 4, 2, 1])
    }

    func testListJson() {
        let dup = [
            BackupNames.Item(id: 1, name: "echo-save-20261007.json", size: 10, time: 1000),
            BackupNames.Item(id: 2, name: "echo-save-20261007 (1).json", size: 20, time: 2000),
            BackupNames.Item(id: 3, name: "echo-save-20261006.json", size: 30, time: 3000),
            BackupNames.Item(id: 4, name: "notes.json", size: 1, time: 1),
        ]
        let json = BackupNames.listJson(dup)
        let list = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [[String: Any]] ?? []
        XCTAssertEqual(list.count, 3)
        XCTAssertEqual(list.first?["name"] as? String, "echo-save-20261007 (1).json")
        XCTAssertEqual(list.last?["date"] as? String, "2026-10-06")
        XCTAssertEqual(list.last?["size"] as? Int, 30)
        XCTAssertEqual(list.first?["time"] as? Int, 2000)
    }

    func testStoreWritesReadsAndRotates() {
        let store = BackupStore()
        let name = BackupNames.forDay(BackupStore.today())
        XCTAssertTrue(store.write("{\"unit\":1}", excludeFromBackup: true))
        XCTAssertEqual(store.read(name), "{\"unit\":1}")
        XCTAssertTrue(store.list().contains { $0.name == name && $0.size == 10 })
        XCTAssertEqual(store.read("../x"), "")
        XCTAssertEqual(BackupStore.today().count, 8)
        try? FileManager.default.removeItem(at: store.dir.appendingPathComponent(name))
    }
}

final class ShellLogicTests: XCTestCase {
    func testByteRange() {
        XCTAssertEqual(WebAssets.byteRange("bytes=0-99", total: 1000), 0...99)
        XCTAssertEqual(WebAssets.byteRange("bytes=500-", total: 1000), 500...999)
        XCTAssertEqual(WebAssets.byteRange("bytes=-100", total: 1000), 900...999)
        XCTAssertEqual(WebAssets.byteRange("bytes=0-5000", total: 1000), 0...999)
        XCTAssertEqual(WebAssets.byteRange("bytes=0-1", total: 1000), 0...1)
        XCTAssertNil(WebAssets.byteRange("bytes=1000-", total: 1000))
        XCTAssertNil(WebAssets.byteRange("bytes=5-2", total: 1000))
        XCTAssertNil(WebAssets.byteRange("bytes=0-1,5-9", total: 1000))
        XCTAssertNil(WebAssets.byteRange("items=0-1", total: 1000))
        XCTAssertNil(WebAssets.byteRange(nil, total: 1000))
        XCTAssertNil(WebAssets.byteRange("bytes=0-", total: 0))
    }

    func testMimeTypes() {
        XCTAssertEqual(WebAssets.mimeType("ogg"), "audio/ogg")
        XCTAssertEqual(WebAssets.mimeType("GLB"), "model/gltf-binary")
        XCTAssertEqual(WebAssets.mimeType("webp"), "image/webp")
        XCTAssertEqual(WebAssets.mimeType("json"), "application/json; charset=utf-8")
        XCTAssertEqual(WebAssets.mimeType("woff2"), "font/woff2")
        XCTAssertEqual(WebAssets.mimeType("js"), "text/javascript; charset=utf-8")
        XCTAssertEqual(WebAssets.mimeType("zzz"), "application/octet-stream")
    }

    // 拼回应：200 整份、206 一段（Content-Range）、404；用临时文件夹当 www
    func testReplies() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("www-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir.appendingPathComponent("assets", isDirectory: true), withIntermediateDirectories: true)
        try Data("0123456789".utf8).write(to: dir.appendingPathComponent("assets/a.ogg"))
        defer { try? FileManager.default.removeItem(at: dir) }
        var req = URLRequest(url: URL(string: "echoisland://localhost/assets/a.ogg")!)
        var r = WebAssets.reply(for: req, root: dir, testRoot: nil)
        XCTAssertEqual(r.status, 200); XCTAssertEqual(r.body.count, 10)
        XCTAssertEqual(r.headers["Content-Type"], "audio/ogg"); XCTAssertEqual(r.headers["Accept-Ranges"], "bytes")
        req.setValue("bytes=2-5", forHTTPHeaderField: "Range")
        r = WebAssets.reply(for: req, root: dir, testRoot: nil)
        XCTAssertEqual(r.status, 206); XCTAssertEqual(String(data: r.body, encoding: .utf8), "2345")
        XCTAssertEqual(r.headers["Content-Range"], "bytes 2-5/10"); XCTAssertEqual(r.headers["Content-Length"], "4")
        r = WebAssets.reply(for: URLRequest(url: URL(string: "echoisland://localhost/assets/none.ogg")!), root: dir, testRoot: nil)
        XCTAssertEqual(r.status, 404)
        r = WebAssets.reply(for: URLRequest(url: URL(string: "echoisland://localhost/__test/x.html")!), root: dir, testRoot: nil)
        XCTAssertEqual(r.status, 404, "没有自测页文件夹（正式包）时 /__test/ 一律 404")
    }

    @MainActor
    func testBundledFilesAndNoEscape() {
        let h = WebAssetHandler()
        XCTAssertNotNil(h.fileURL(for: URL(string: "echoisland://localhost/index.html")!), "游戏网页打包进来了")
        XCTAssertNotNil(h.fileURL(for: URL(string: "echoisland://localhost/")!))
        XCTAssertNotNil(h.fileURL(for: URL(string: "echoisland://localhost/assets/voice/index.json")!))
        XCTAssertNotNil(h.fileURL(for: URL(string: "echoisland://localhost/vendor/three.min.js?v=1")!))
        XCTAssertNotNil(h.fileURL(for: URL(string: "echoisland://localhost/__test/selftest.html")!), "调试包带原生桥自测页")
        XCTAssertNil(h.fileURL(for: URL(string: "echoisland://localhost/../Info.plist")!))
        XCTAssertNil(h.fileURL(for: URL(string: "echoisland://localhost/%2e%2e/Info.plist")!))
        XCTAssertNil(h.fileURL(for: URL(string: "echoisland://localhost/__test/../index.html")!))
        XCTAssertNil(h.fileURL(for: URL(string: "echoisland://localhost/assets")!), "文件夹不给")
        XCTAssertNil(h.fileURL(for: URL(string: "echoisland://other/index.html")!))
        XCTAssertNil(h.fileURL(for: URL(string: "https://localhost/index.html")!))
        XCTAssertNotNil(Bundle.main.url(forResource: "echo-native", withExtension: "js"), "EchoNative 那一层打包进来了")
        XCTAssertNotNil(Bundle.main.url(forResource: "PrivacyInfo", withExtension: "xcprivacy"), "隐私清单打包进来了")
    }

    func testOnlyDashScopeIsReachable() {
        XCTAssertNotNil(DashScope.allowed("wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=x", prefix: DashScope.wsPrefix))
        XCTAssertNotNil(DashScope.allowed("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", prefix: DashScope.httpsPrefix))
        XCTAssertNil(DashScope.allowed("wss://dashscope.aliyuncs.com.evil.example/x", prefix: DashScope.wsPrefix))
        XCTAssertNil(DashScope.allowed("https://example.com/x", prefix: DashScope.httpsPrefix))
        XCTAssertNil(DashScope.allowed("https://dashscope.aliyuncs.com@evil.example/x", prefix: DashScope.httpsPrefix))
        XCTAssertNil(DashScope.allowed("http://dashscope.aliyuncs.com/x", prefix: DashScope.httpsPrefix))
        XCTAssertNil(DashScope.allowed("https://dashscope.aliyuncs.com/x", prefix: DashScope.wsPrefix))
        XCTAssertNil(DashScope.allowed(nil, prefix: DashScope.wsPrefix))
    }

    // 没有密钥、地址不对：不连网，当场按安卓一样的话回
    @MainActor
    func testNoKeyAnswersWithoutNetwork() {
        let got = Got()
        let net = DashScope { _, id, type, data in got.items.append([String(id), type, data]) }
        net.wsOpen(gen: 0, id: 6, url: "wss://dashscope.aliyuncs.com/x", key: "")
        net.post(gen: 0, id: 5, url: "https://dashscope.aliyuncs.com/x", body: "{}", key: "")
        net.wsOpen(gen: 0, id: 7, url: "wss://example.com/x", key: "k")
        net.post(gen: 0, id: 8, url: "https://example.com/x", body: "{}", key: "k")
        XCTAssertEqual(got.items.count, 4)
        XCTAssertEqual(got.items[0], ["6", "error", "HTTP 401 no key"])
        XCTAssertEqual(got.items[1][1], "fail"); XCTAssertTrue(got.items[1][2].contains("InvalidApiKey"))
        XCTAssertEqual(got.items[2], ["7", "error", "bad url"])
        XCTAssertEqual(got.items[3], ["8", "fail", "bad url"])
        XCTAssertEqual(net.openCount, 0, "一条连接都没开")
    }

    func testErrorTextsTheWebCanClassify() {
        let off = DashScope.describe(URLError(.notConnectedToInternet))
        XCTAssertTrue(off.hasPrefix("Unable to resolve host \"dashscope.aliyuncs.com\""), off)
        XCTAssertTrue(DashScope.describe(URLError(.cannotFindHost)).hasPrefix("Unable to resolve host"))
        XCTAssertEqual(DashScope.describe(URLError(.timedOut)), "NSURLError -1001 timed out")
    }

    func testJsStringAndNames() {
        XCTAssertEqual(Bridge.jsStr("a\"b\\c\n<\u{2028}"), "\"a\\\"b\\\\c\\u000a\\u003c\\u2028\"")
        XCTAssertEqual(Bridge.encode(true), "true"); XCTAssertEqual(Bridge.encode(nil), "null"); XCTAssertEqual(Bridge.encode("x"), "\"x\"")
        XCTAssertTrue(Bridge.okName("echo-save-20261007.json"))
        XCTAssertFalse(Bridge.okName("../a.json")); XCTAssertFalse(Bridge.okName(".hidden.json")); XCTAssertFalse(Bridge.okName("")); XCTAssertFalse(Bridge.okName("存档.json"))
        XCTAssertEqual(Bridge.str(["a", 5, NSNull()], 1), "5"); XCTAssertEqual(Bridge.str(["a", 5, NSNull()], 2), ""); XCTAssertEqual(Bridge.str([], 0), "")
        XCTAssertEqual(Bridge.int([7.0, "8"], 0), 7); XCTAssertEqual(Bridge.int([7.0, "8"], 1), 8)
    }

    // 方法表：和安卓一样的同步 22 个、异步 4 个，另有 iPhone 才有的异步 9 个（订阅、通过 Apple 登录）；名字由 tests/ios.test.js 在电脑上逐个核对
    @MainActor
    func testBridgeMethodTables() {
        XCTAssertEqual(Bridge.syncMethods.count, 22)
        XCTAssertEqual(Bridge.asyncMethods.count, 4 + 13)
        XCTAssertEqual(Bridge.iosOnlyMethods.count, 13, "订阅、登录 9 个 + 口语题的本机识别 4 个")
        XCTAssertTrue(Set(Bridge.iosOnlyMethods).isSubset(of: Bridge.asyncMethods), "iPhone 才有的都是异步的")
        XCTAssertTrue(Set(Bridge.syncMethods).isDisjoint(with: Bridge.asyncMethods))
        let b = Bridge()
        // 没有原生画面也能答的几个同步方法：返回值的种类对
        XCTAssertTrue(b.callSync("hasPin", []) is Bool)
        XCTAssertTrue(b.callSync("micPermission", []) is String)
        XCTAssertEqual(b.callSync("edition", []) as? String, Bridge.sales ? "sales" : "family")
        let v = (try? JSONSerialization.jsonObject(with: Data(((b.callSync("version", []) as? String) ?? "").utf8))) as? [String: Any]
        XCTAssertNotNil(v?["code"]); XCTAssertNotNil(v?["name"])
        XCTAssertEqual(b.handlePrompt("not the bridge"), nil, "不是桥的 prompt 交回给网页自己的输入框")
        XCTAssertEqual(b.handlePrompt(Bridge.tag + "{bad json"), "null")
        XCTAssertEqual(b.handlePrompt(Bridge.tag + "{\"m\":\"checkPin\",\"a\":[\"\"]}"), "false", "空密码不算、不放行")
        XCTAssertEqual(b.handlePrompt(Bridge.tag + "{\"m\":\"noSuchMethod\",\"a\":[]}"), "null")
        XCTAssertEqual(b.callSync("backupWrite", ["not json"]) as? Bool, false)
        XCTAssertEqual(b.callSync("shareFile", ["t", "../x.json", "{}"]) as? Bool, false, "文件名不对不分享")
        XCTAssertEqual(b.callSync("shareText", ["t", ""]) as? Bool, false)
        let d = (try? JSONSerialization.jsonObject(with: Data(((b.callSync("diag", []) as? String) ?? "").utf8))) as? [String: Any]
        XCTAssertEqual(d?["appleSignIn"] as? Bool, BuildConfig.appleSignIn, "diag() 说这个包能不能通过 Apple 登录")
        XCTAssertEqual(d?["iapProducts"] as? [String], [BuildConfig.iapMonthly, BuildConfig.iapYearly])
    }

    // 这个包是哪个版本：销售版（公开发的）里一定没有密钥、家长密码的哈希、中转服务
    @MainActor
    func testEditionSecrets() {
        if BuildConfig.edition != "family" {
            XCTAssertEqual(BuildConfig.dashscopeKey, "")
            XCTAssertEqual(BuildConfig.parentPinHash, "")
            XCTAssertEqual(BuildConfig.talkUrl, ""); XCTAssertEqual(BuildConfig.talkCode, ""); XCTAssertEqual(BuildConfig.verUrl, "")
            XCTAssertTrue(Bridge.sales)
        } else {
            XCTAssertFalse(Bridge.sales)
            XCTAssertTrue(BuildConfig.parentPinHash.isEmpty || BuildConfig.parentPinHash.count == 64)
        }
        XCTAssertGreaterThan(BuildConfig.versionCode, 0)
        XCTAssertTrue(Store.okId(BuildConfig.iapMonthly) && Store.okId(BuildConfig.iapYearly), "两个订阅的商品编号写对了")
        XCTAssertNotEqual(BuildConfig.iapMonthly, BuildConfig.iapYearly)
    }
}

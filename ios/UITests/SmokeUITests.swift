import XCTest

// 开起来看一眼（在模拟器里跑，云上的 Mac：.github/workflows/ios-simulator.yml）。
// 怎么知道网页走到哪了：调试包带启动参数 -EchoUITest 时，原生在屏幕最下面放一行很小的字（accessibilityIdentifier = echo-status），
// 每半秒写一次 {"native":{…},"page":{…}}（GameViewController 的 statusProbe），这里读它。
// 测试按名字的顺序跑（test1… test6…）：前两个开游戏，第三个跑原生桥自测页（销售版里会设一个家长密码），后面几个弹界面，第六个问订阅的商品。
// 截图都挂在结果里（.xcresult），云上的工作流把它们导出来一起上传。
final class SmokeUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    // ---------- 小工具 ----------

    @MainActor
    private func launch(_ args: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-EchoUITest"] + args
        app.launch()
        return app
    }

    // 读一次状态行（还没有 / 读不出来就是空的）
    @MainActor
    private func status(_ app: XCUIApplication) -> [String: Any] {
        let el = app.staticTexts["echo-status"]
        guard el.exists else { return [:] }
        let text = el.label
        return (try? JSONSerialization.jsonObject(with: Data(text.utf8))) as? [String: Any] ?? [:]
    }

    // 等到状态满足条件（每半秒看一次），返回最后一次读到的状态
    @MainActor
    private func waitStatus(_ app: XCUIApplication, timeout: TimeInterval, _ what: String,
                            _ ok: ([String: Any], [String: Any]) -> Bool) -> [String: Any] {
        let end = Date().addingTimeInterval(timeout)
        var last: [String: Any] = [:]
        _ = app.staticTexts["echo-status"].waitForExistence(timeout: min(timeout, 30))
        while Date() < end {
            last = status(app)
            let native = last["native"] as? [String: Any] ?? [:]
            let page = last["page"] as? [String: Any] ?? [:]
            if ok(native, page) { return last }
            Thread.sleep(forTimeInterval: 0.5)
        }
        attachJSON(last, "status-timeout-" + what)
        XCTFail("等了 \(Int(timeout)) 秒还没到：\(what)")
        return last
    }

    @MainActor
    private func shot(_ name: String) {
        let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }

    @MainActor
    private func attachJSON(_ o: [String: Any], _ name: String) {
        let data = (try? JSONSerialization.data(withJSONObject: o, options: [.prettyPrinted, .sortedKeys])) ?? Data("{}".utf8)
        let a = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        a.name = name + ".json"
        a.lifetime = .keepAlways
        add(a)
    }

    // 大地图的画布是不是和画面那一层、和屏幕都对得上（wide：这时候应该是横的）。对得上返回空字符串，不然说哪里不对
    @MainActor
    private func worldFit(_ s: [String: Any], wide: Bool) -> String {
        let n = s["native"] as? [String: Any] ?? [:], p = s["page"] as? [String: Any] ?? [:]
        guard let w = p["world"] as? [String: Any] else { return "没有大地图" }
        func num(_ d: [String: Any], _ k: String) -> Int { return d[k] as? Int ?? -1 }
        let nw = num(n, "w"), nh = num(n, "h"), pw = num(p, "vw"), ph = num(p, "vh")
        let vw = num(w, "vw"), vh = num(w, "vh"), cw = num(w, "cw"), ch = num(w, "ch"), cx = num(w, "cx"), cy = num(w, "cy")
        let all = "屏幕 \(nw)×\(nh)，网页 \(pw)×\(ph)，画面层 \(vw)×\(vh)，画布 \(cw)×\(ch) 在 \(cx),\(cy)"
        if (nw > nh) != wide { return "屏幕还没转过来（" + all + "）" }
        if (pw > ph) != wide { return "网页还没转过来（" + all + "）" }
        if (vw > vh) != wide { return "画面那一层还是另一个方向的（" + all + "）" }
        if vw > pw || vh > ph { return "画面那一层比屏幕大（" + all + "）" }
        if cw != vw || ch != vh || cx != 0 || cy != 0 { return "画布和画面那一层对不上（" + all + "）" }
        return ""
    }

    // 等大地图的画布对上（每半秒看一次）。返回（对上没有，最后读到的状态，哪里不对）——对不上也不当场判失败，让调用的人先把截图拍了
    @MainActor
    private func settleWorld(_ app: XCUIApplication, wide: Bool, timeout: TimeInterval) -> (Bool, [String: Any], String) {
        let end = Date().addingTimeInterval(timeout)
        var last: [String: Any] = [:]
        var why = "读不到状态"
        while Date() < end {
            last = status(app)
            why = worldFit(last, wide: wide)
            if why.isEmpty { return (true, last, "") }
            Thread.sleep(forTimeInterval: 0.5)
        }
        return (false, last, why)
    }

    // ---------- 1. 打开 App，网页到了首页（销售版第一次打开是家长首次设置向导，盖在首页上面） ----------
    @MainActor
    func test1LaunchReachesHomePortrait() {
        let app = launch([])
        let s = waitStatus(app, timeout: 90, "home") { _, p in
            (p["game"] as? Bool) == true && ((p["home"] as? Bool) == true || (p["wizard"] as? Bool) == true)
        }
        let n = s["native"] as? [String: Any] ?? [:], p = s["page"] as? [String: Any] ?? [:]
        attachJSON(s, "status-home-portrait")
        XCTAssertEqual(p["secure"] as? Bool, true, "页面是安全来源（麦克风要用）")
        XCTAssertEqual(p["native"] as? Bool, true, "有 window.EchoNative")
        XCTAssertEqual(p["ios"] as? Bool, true, "有 window.ECHO_IOS")
        XCTAssertEqual(p["app"] as? Bool, true, "有 window.ECHO_APP")
        XCTAssertEqual(p["media"] as? Bool, true, "有 getUserMedia")
        XCTAssertEqual(n["crash"] as? Bool, false, "没有出错画面")
        XCTAssertNotNil(p["edition"] as? String)
        XCTAssertTrue((p["href"] as? String ?? "").hasPrefix("echoisland://localhost/index.html"))
        XCTAssertGreaterThan(n["h"] as? Int ?? 0, n["w"] as? Int ?? 0, "竖屏")
        Thread.sleep(forTimeInterval: 2)             // 等首页的图画完再拍
        shot("portrait-home")
    }

    // ---------- 2. 横屏打开（-EchoOrient landscape 这次不记住） ----------
    @MainActor
    func test2LaunchLandscape() {
        XCUIDevice.shared.orientation = .landscapeLeft
        defer { XCUIDevice.shared.orientation = .portrait }
        let app = launch(["-EchoOrient", "landscape"])
        let s = waitStatus(app, timeout: 90, "home-landscape") { n, p in
            (p["game"] as? Bool) == true && (n["w"] as? Int ?? 0) > (n["h"] as? Int ?? 0)
        }
        attachJSON(s, "status-home-landscape")
        let p = s["page"] as? [String: Any] ?? [:]
        XCTAssertGreaterThan(p["vw"] as? Int ?? 0, p["vh"] as? Int ?? 0, "网页也是横的")
        Thread.sleep(forTimeInterval: 2)
        shot("landscape-home")
    }

    // ---------- 3. 原生桥自测页：每个方法都调一遍，一个都不能没过 ----------
    @MainActor
    func test3BridgeSelfTest() {
        let app = launch(["-EchoSelfTest", "all"])
        let s = waitStatus(app, timeout: 180, "selftest") { _, p in
            ((p["test"] as? [String: Any])?["done"] as? Bool) == true
        }
        let t = (s["page"] as? [String: Any])?["test"] as? [String: Any] ?? [:]
        attachJSON(t, "selftest-result")
        shot("selftest")
        let items = t["items"] as? [[String: Any]] ?? []
        let bad = items.filter { ($0["ok"] as? Bool) == false }.map { "\($0["name"] ?? "?")：\($0["got"] ?? "")" }
        XCTAssertEqual(t["fail"] as? Int, 0, "原生桥自测没过的：\n" + bad.joined(separator: "\n"))
        XCTAssertGreaterThanOrEqual(t["pass"] as? Int ?? 0, 30, "自测真的跑了")
        let warns = items.filter { ($0["ok"] as? String) == "warn" }.map { "\($0["name"] ?? "?")：\($0["got"] ?? "")" }
        if !warns.isEmpty { print("EchoIsland selftest warnings:\n" + warns.joined(separator: "\n")) }
    }

    // ---------- 4. 麦克风：第一次要会弹系统的「允许使用麦克风」，点「允许」以后 micPermission() 是 granted ----------
    @MainActor
    func test4MicrophonePermission() {
        let app = launch(["-EchoSelfTest", "mic"])
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        var tapped = false
        let end = Date().addingTimeInterval(20)
        while Date() < end && !tapped {
            let alert = springboard.alerts.firstMatch
            if alert.exists {
                shot("mic-system-alert")
                // 模拟器默认英文；系统语言是中文时按钮是「允许」
                for label in ["Allow", "允许", "OK", "好"] where alert.buttons[label].exists {
                    alert.buttons[label].tap()
                    tapped = true
                    break
                }
                if !tapped && alert.buttons.count > 0 { alert.buttons.element(boundBy: alert.buttons.count - 1).tap(); tapped = true }
            }
            let p = status(app)["page"] as? [String: Any] ?? [:]
            if ((p["test"] as? [String: Any])?["done"] as? Bool) == true { break }
            Thread.sleep(forTimeInterval: 0.5)
        }
        let s = waitStatus(app, timeout: 30, "mic") { _, p in ((p["test"] as? [String: Any])?["done"] as? Bool) == true }
        let t = (s["page"] as? [String: Any])?["test"] as? [String: Any] ?? [:]
        let mic = t["mic"] as? [String: Any] ?? [:]
        attachJSON(t, "mic-result")
        print("EchoIsland mic: alert tapped = \(tapped), result = \(mic)")
        XCTAssertNotEqual(mic["after"] as? String, "blocked", "麦克风没被拒绝")
        if tapped { XCTAssertEqual(mic["after"] as? String, "granted", "点了「允许」以后是 granted") }
        XCTAssertEqual((s["native"] as? [String: Any])?["mic"] as? String, mic["after"] as? String, "原生和网页看到的一样")
    }

    // ---------- 5. 分享面板、文件选择器弹得出来（导出存档、从文件恢复用） ----------
    @MainActor
    func test5ShareSheetAndPicker() {
        var app = launch(["-EchoSelfTest", "share"])
        var s = waitStatus(app, timeout: 30, "share-sheet") { n, _ in (n["presented"] as? String ?? "").contains("UIActivityViewController") }
        shot("share-sheet")
        attachJSON(s, "status-share")
        app.terminate()
        app = launch(["-EchoSelfTest", "pick"])
        s = waitStatus(app, timeout: 30, "document-picker") { n, _ in (n["presented"] as? String ?? "").contains("DocumentPicker") }
        shot("document-picker")
        attachJSON(s, "status-pick")
        app.terminate()
    }

    // ---------- 6. 订阅：网页问得到商品（异步桥一路通到 StoreKit 再回来）；有商品就看购买面板弹没弹出来 ----------
    // 云上的模拟器没有本地 App Store：xcodebuild test 不把 Store.storekit 交给模拟器（iOS 26.5 上 UI 测试里 SKTestSession 也不管用，
    // 苹果开发者论坛 FB22237318），所以多半一个商品都没有——只要求 iapProducts 回了话；商品、买、续费、退款在单元测试 StoreKitTests 里测
    @MainActor
    func test6StoreProductsAndBuySheet() {
        let app = launch(["-EchoSelfTest", "store"])
        let s = waitStatus(app, timeout: 60, "store") { _, p in ((p["test"] as? [String: Any])?["done"] as? Bool) == true }
        let t = (s["page"] as? [String: Any])?["test"] as? [String: Any] ?? [:]
        let store = t["store"] as? [String: Any] ?? [:]
        attachJSON(t, "store-result")
        shot("store")
        XCTAssertEqual(store["plumbing"] as? Bool, true, "网页 → 原生 Store.swift → window.__echoNative 一路通（不是 UUID 当场回 bad-token）")
        let count = store["count"] as? Int ?? 0
        // 问商品要连 App Store：回没回、有几个都只记下来（云上的模拟器多半没有）
        print("EchoIsland store: products answered = \(store["answered"] ?? "") count = \(count) \(store["ids"] ?? "") missing = \(store["missing"] ?? "") error = \(store["error"] ?? "")")
        guard count > 0 else { return }
        // 有商品：购买面板（系统的）应该弹出来。只看、不点，弹没弹出来都只记下来
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        var seen = ""
        let end = Date().addingTimeInterval(20)
        while Date() < end && seen.isEmpty {
            let n = status(app)["native"] as? [String: Any] ?? [:]
            if let pres = n["presented"] as? String, !pres.isEmpty { seen = "presented " + pres }
            else if springboard.alerts.count > 0 { seen = "springboard alert" }
            else if app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Subscribe' OR label CONTAINS[c] 'Confirm' OR label CONTAINS[c] 'Purchase'")).count > 0 { seen = "purchase button" }
            Thread.sleep(forTimeInterval: 0.5)
        }
        shot("buy-sheet")
        print("EchoIsland store: buy sheet = \(seen.isEmpty ? "not seen" : seen)")
        app.terminate()
    }

    // ---------- 7. 大地图里转屏：画布一直和屏幕一样大 ----------
    // 老板 2026-11-20 在 iPhone 上：从横屏转回竖屏主角跑到屏幕最右边，从竖屏转到横屏只看得到天和屋顶（主角在屏幕下面外头）——
    // 画布还是转之前量的大小。电脑上的浏览器模拟不出 iPhone 转屏时「通知先到、版面后排」，所以在这里用真的 WKWebView 转。
    // -EchoWorldTest：放一份现成的存档、替人点进大地图（GameViewController 的 worldDriver）；-EchoOrient auto：跟着手机转。
    // 每个方向都拍一张（world-*.png），对不上也拍，最后一起判
    @MainActor
    func test7WorldSurvivesRotation() {
        XCUIDevice.shared.orientation = .portrait
        defer { XCUIDevice.shared.orientation = .portrait }
        let app = launch(["-EchoOrient", "auto", "-EchoWorldTest"])
        // 进了大地图、画过几帧、对话框点掉了
        let s0 = waitStatus(app, timeout: 240, "world") { _, p in
            guard let w = p["world"] as? [String: Any] else { return false }
            return (w["frame"] as? Int ?? 0) > 5 && (w["dlg"] as? Bool) == false
        }
        let w0 = (s0["page"] as? [String: Any])?["world"] as? [String: Any] ?? [:]
        print("EchoIsland world: renderer = \(w0["using"] ?? "") map = \(w0["map"] ?? "")")
        var problems: [String] = []
        let steps: [(String, UIDeviceOrientation, Bool)] = [
            ("1-portrait", .portrait, false),
            ("2-landscape-left", .landscapeLeft, true),
            ("3-portrait-again", .portrait, false),
            ("4-landscape-right", .landscapeRight, true),
            ("5-portrait-last", .portrait, false),
        ]
        for step in steps {
            XCUIDevice.shared.orientation = step.1
            let r = settleWorld(app, wide: step.2, timeout: 25)
            Thread.sleep(forTimeInterval: 2)             // 等这一帧画完再拍
            shot("world-" + step.0)
            attachJSON(r.1, "status-world-" + step.0)
            print("EchoIsland world: \(step.0) \(r.0 ? "ok" : "BAD " + r.2)")
            if !r.0 { problems.append(step.0 + "：" + r.2) }
        }
        XCTAssertTrue(problems.isEmpty, "转屏以后大地图的画布和屏幕对不上：" + problems.joined(separator: "；"))
        app.terminate()
    }
}

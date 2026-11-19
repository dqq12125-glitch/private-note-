import XCTest

// 开起来看一眼（在模拟器里跑，云上的 Mac：.github/workflows/ios-simulator.yml）。
// 怎么知道网页走到哪了：调试包带启动参数 -EchoUITest 时，原生在屏幕最下面放一行很小的字（accessibilityIdentifier = echo-status），
// 每半秒写一次 {"native":{…},"page":{…}}（GameViewController 的 statusProbe），这里读它。
// 测试按名字的顺序跑（test1… test5…）：前两个开游戏，第三个跑原生桥自测页（销售版里会设一个家长密码），后面几个弹界面。
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
        let s = waitStatus(app, timeout: 120, "selftest") { _, p in
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
}

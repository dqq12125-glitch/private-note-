import UIKit
import WebKit
import AVFoundation

// 全屏的 WKWebView：铺满整个屏幕（刘海 / 灵动岛 / 底部横条下面也是网页，网页自己用 env(safe-area-inset-*) 让开）。
// 这里管：建网页、原生桥的两条通道、麦克风放行、网页自己的 prompt / alert / confirm、屏幕方向、声音被打断以后接上、
// 切到后台前让网页把存档存好、网页进程没了以后重建（连挂 3 次显示一句话，等孩子点一下）。
// iPhone 没有返回键：游戏里每个画面都有自己的「关闭 / 返回」按钮（网页版在 iPhone 上本来就是这样玩的），
// 所以这里不接任何「返回」手势，也不调 window.EchoBack（屏幕左边缘是摇杆的地方，右划返回会和摇杆抢手指）。
@MainActor
final class GameViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    static let background = UIColor(red: 0x12 / 255.0, green: 0x30 / 255.0, blue: 0x4a / 255.0, alpha: 1)
    // 切到后台前让网页存一下（走路攒着没整份存的那一份：game.js 的 EchoGame.flush）
    static let flushJS = "(function(){try{if(window.EchoGame&&EchoGame.flush)EchoGame.flush()}catch(e){}return 1})()"
    // 回到前台 / 声音打断结束：把被打断的声音接上（echo-native.js 的 wake）
    static let wakeJS = "(function(){try{if(window.__echoIOS&&window.__echoIOS.wake)return window.__echoIOS.wake()}catch(e){}return 0})()"

    private(set) var gen = 0                         // 第几个网页：旧网页的回调不发给新网页
    private var web: WKWebView?
    private let assets = WebAssetHandler()
    private let bridge = Bridge()
    private var recovered = false                    // 网页进程挂了、刚重建过（takeRecovered() 告诉网页一次）
    private var pendingReopen = false                // 在后台时网页进程没了：等回到前台再重建
    private var goneAt: [TimeInterval] = []
    private var crashLabel: UILabel?
    private var orient = "portrait"
    private var didApplyLaunchOrient = false
    private var observers: [NSObjectProtocol] = []
    private var bgTask: UIBackgroundTaskIdentifier = .invalid
    #if DEBUG
    private var statusLabel: UILabel?
    private var statusWindow: UIWindow?
    private var statusTimer: Timer?
    #endif

    // ---------- 画面 ----------

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = GameViewController.background
        bridge.host = self
        let saved = UserDefaults.standard.string(forKey: "orient") ?? "portrait"     // 上次在游戏设置里选的屏幕方向
        orient = GameViewController.orientMode(saved)
        #if DEBUG
        if let o = GameViewController.launchArg("-EchoOrient") { orient = GameViewController.orientMode(o) }   // 自动化测试：这次用哪个方向（不记住）
        #endif
        AppAudio.configure()
        watchAudio()
        buildWebView()
        loadHome()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // 一打开就是横屏 / 跟着转（上次选的、或者测试的启动参数）：viewDidLoad 那会儿还没有窗口，系统按竖屏开起来；
        // 窗口有了以后再要一次方向，系统才真的转过去（云上第一次跑 UI 测试，横屏打开一直停在竖屏）
        if orient != "portrait" && !didApplyLaunchOrient {
            didApplyLaunchOrient = true
            applyOrientation(orient)
        }
        #if DEBUG
        if statusTimer == nil && GameViewController.launchArg("-EchoUITest") != nil { startStatus() }
        #endif
    }

    override var prefersStatusBarHidden: Bool { return true }
    // 底部横条玩的时候自动淡掉
    override var prefersHomeIndicatorAutoHidden: Bool { return true }
    // 屏幕四边的系统手势（底部横条上滑、顶上下拉通知）让游戏先用：第一下只露出小横条，再划一次才真的出去
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { return .all }

    // 屏幕方向：portrait 竖屏 / landscape 横屏（两个横向都行）/ auto 跟着手机转
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return orient == "landscape" ? .landscape : orient == "auto" ? .allButUpsideDown : .portrait
    }

    static func orientMode(_ v: String) -> String {
        return v == "landscape" || v == "auto" ? v : "portrait"
    }

    func applyOrientation(_ mode: String) {
        orient = GameViewController.orientMode(mode)
        setNeedsUpdateOfSupportedInterfaceOrientations()
        if let scene = view.window?.windowScene {
            scene.requestGeometryUpdate(.iOS(interfaceOrientations: supportedInterfaceOrientations)) { _ in }
        }
    }

    // 最上面的那个画面（已经弹着分享面板时，新的弹窗要从它上面弹）
    func top() -> UIViewController {
        var vc: UIViewController = self
        while let p = vc.presentedViewController, !p.isBeingDismissed { vc = p }
        return vc
    }

    // 启动参数里 名字 后面的那个值（"-EchoUITest" 这种没有值的返回 ""）；没有这个参数返回 nil
    static func launchArg(_ name: String) -> String? {
        let a = ProcessInfo.processInfo.arguments
        guard let i = a.firstIndex(of: name) else { return nil }
        return i + 1 < a.count && !a[i + 1].hasPrefix("-") ? a[i + 1] : ""
    }

    // ---------- 建网页 ----------

    // 页面一开始就执行的脚本：原生告诉网页的几个值 + echo-native.js（EchoNative 那一层）
    private func bootScript() -> String {
        let boot: [String: Any] = ["talkUrl": BuildConfig.talkUrl, "talkCode": BuildConfig.talkCode]
        var shim = ""
        if let u = Bundle.main.url(forResource: "echo-native", withExtension: "js"), let s = try? String(contentsOf: u, encoding: .utf8) { shim = s }
        return "window.__ECHO_BOOT=" + Bridge.json(boot) + ";\n" + shim
    }

    // 建一个网页放进画面（启动时一次；网页进程挂了以后再建一次）
    private func buildWebView() {
        let cfg = WKWebViewConfiguration()
        cfg.setURLSchemeHandler(assets, forURLScheme: WebAssets.scheme)
        cfg.websiteDataStore = WKWebsiteDataStore.default()          // 存档在 localStorage：写在磁盘上，重建网页、装新版都还在
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []            // 配音自动播放
        cfg.applicationNameForUserAgent = "Mobile/15E148 EchoIslandApp/" + BuildConfig.versionName
        cfg.preferences.javaScriptCanOpenWindowsAutomatically = false
        let ucc = WKUserContentController()
        ucc.addUserScript(WKUserScript(source: bootScript(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        ucc.add(bridge, name: Bridge.handlerName)
        cfg.userContentController = ucc

        let w = WKWebView(frame: view.bounds, configuration: cfg)
        w.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        w.navigationDelegate = self
        w.uiDelegate = self
        w.isOpaque = false
        w.backgroundColor = GameViewController.background
        w.scrollView.backgroundColor = GameViewController.background
        w.scrollView.contentInsetAdjustmentBehavior = .never         // 铺满全屏，安全区交给网页的 env()
        w.scrollView.bounces = false                                 // 不要拉到头的回弹
        w.scrollView.alwaysBounceVertical = false
        w.scrollView.alwaysBounceHorizontal = false
        w.scrollView.pinchGestureRecognizer?.isEnabled = false       // 不要双指缩放（网页的 viewport 也写了不许缩放）
        w.allowsLinkPreview = false                                  // 长按链接不出预览
        w.allowsBackForwardNavigationGestures = false
        #if DEBUG
        w.isInspectable = true                                       // 调试包：Mac 上的 Safari 能连上来看网页；正式包不行
        #endif
        view.insertSubview(w, at: 0)
        web = w
    }

    private func loadHome() {
        var url = WebAssets.home
        #if DEBUG
        // 自动化测试：打开原生桥自测页（ios/www-test/selftest.html，只有调试包里有）。值是要跑的那一组：all / mic / share / pick
        if let mode = GameViewController.launchArg("-EchoSelfTest"),
           let t = URL(string: WebAssets.origin + WebAssets.testPrefix + "selftest.html?run=" + (mode.isEmpty ? "all" : mode)) { url = t }
        #endif
        web?.load(URLRequest(url: url))
    }

    // 在网页里执行一段 JS（不要结果）。一定在主线程上
    func runJS(_ js: String) {
        web?.evaluateJavaScript(js, completionHandler: nil)
    }

    func takeRecovered() -> Bool {
        let r = recovered
        recovered = false
        return r
    }

    // ---------- 前台 / 后台 ----------

    func appBecameActive() {
        if pendingReopen && crashLabel == nil {
            pendingReopen = false
            reopen()
        }
        bridge.notifyMic()
        bridge.applyBackupPolicy()
        // 来电、Siri、闹钟打断过声音：让网页把被打断的声音接上
        runJS(GameViewController.wakeJS)
    }

    // 要离开前台（来电、下拉通知中心、回主屏幕）：先让网页把存档存好
    func appWillResign() {
        flushPage()
    }

    func appWentBackground() {
        bridge.applyBackupPolicy()
        flushPage()
    }

    // 让网页存一下；向系统多要几秒，免得还没写完 App 就被挂起（存档写进 localStorage 以后 WebKit 还要落盘）
    private func flushPage() {
        guard let w = web else { return }
        if bgTask == .invalid {
            bgTask = UIApplication.shared.beginBackgroundTask(withName: "echo-island-save") { [weak self] in
                MainActor.assumeIsolated { self?.endBackgroundTask() }
            }
        }
        w.evaluateJavaScript(GameViewController.flushJS) { [weak self] _, _ in
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                MainActor.assumeIsolated { self?.endBackgroundTask() }
            }
        }
    }

    private func endBackgroundTask() {
        if bgTask == .invalid { return }
        UIApplication.shared.endBackgroundTask(bgTask)
        bgTask = .invalid
    }

    // ---------- 声音被打断（来电、闹钟、Siri）/ 声音服务重启 ----------

    private func watchAudio() {
        let nc = NotificationCenter.default
        observers.append(nc.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            let type = (note.userInfo?[AVAudioSessionInterruptionTypeKey] as? NSNumber)?.uintValue ?? 0
            MainActor.assumeIsolated { self?.audioInterrupted(ended: type == AVAudioSession.InterruptionType.ended.rawValue) }
        })
        observers.append(nc.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.audioInterrupted(ended: true) }
        })
    }

    private func audioInterrupted(ended: Bool) {
        if !ended { return }                         // 开始打断：WebKit 自己会停；等结束再接上
        AppAudio.configure()
        if UIApplication.shared.applicationState == .active { runJS(GameViewController.wakeJS) }
    }

    // ---------- 网页进程没了 ----------

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        renderGone(webView)
    }

    // 扔掉旧网页、重建、重新打开首页。存档在 localStorage（写在磁盘上），重建后还在。
    // 在后台被系统收回内存的：回到前台再重建，不算「连着挂」。前台 2 分钟里挂了 3 次就别死循环了：显示一句话，等孩子点一下再开
    private func renderGone(_ gone: WKWebView) {
        let d = UserDefaults.standard
        d.set(d.integer(forKey: "goneCount") + 1, forKey: "goneCount")
        d.set(Date().timeIntervalSince1970 * 1000, forKey: "goneLast")
        gone.removeFromSuperview()
        if gone !== web { return }
        web = nil
        gen += 1
        bridge.net.closeAll()
        if UIApplication.shared.applicationState != .active {
            pendingReopen = true
            return
        }
        let now = ProcessInfo.processInfo.systemUptime
        goneAt.append(now)
        goneAt.removeAll { now - $0 > 120 }
        if goneAt.count >= 3 { showCrashScreen("画面出了点问题 😵\n\n点这里重新打开\n（存档还在）"); return }
        reopen()
    }

    private func reopen() {
        recovered = true
        buildWebView()
        loadHome()
    }

    private func showCrashScreen(_ text: String) {
        if crashLabel != nil { return }
        let t = UILabel(frame: view.bounds)
        t.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        t.backgroundColor = GameViewController.background
        t.text = text
        t.textColor = .white
        t.font = .systemFont(ofSize: 22)
        t.textAlignment = .center
        t.numberOfLines = 0
        t.isUserInteractionEnabled = true
        t.accessibilityIdentifier = "echo-crash"
        t.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(crashTapped)))
        view.addSubview(t)
        crashLabel = t
    }

    @objc private func crashTapped() {
        crashLabel?.removeFromSuperview()
        crashLabel = nil
        goneAt.removeAll()
        pendingReopen = false
        if let w = web {                              // 网页还在（是首页没打开）：扔掉重来
            w.removeFromSuperview()
            web = nil
            gen += 1
            bridge.net.closeAll()
        }
        reopen()
    }

    // ---------- 网页去哪：只许在自己的地址里走；外面的网址交给系统的浏览器 ----------

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else { decisionHandler(.cancel); return }
        if scheme == WebAssets.scheme || scheme == "about" || scheme == "blob" || scheme == "data" {
            decisionHandler(.allow)
            return
        }
        if (scheme == "https" || scheme == "http") && navigationAction.targetFrame?.isMainFrame != false { openOutside(url) }
        decisionHandler(.cancel)
    }

    // target=_blank / window.open：不开新窗口，外面的网址交给系统
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, let s = url.scheme?.lowercased(), s == "https" || s == "http" { openOutside(url) }
        return nil
    }

    private func openOutside(_ url: URL) {
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        loadFailed(webView, error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        loadFailed(webView, error)
    }

    // 首页没打开（包里的文件不全之类）：显示一句话，点一下重试。自己取消的跳转（点了外面的链接）不算
    private func loadFailed(_ webView: WKWebView, _ error: Error) {
        let e = error as NSError
        if e.code == NSURLErrorCancelled || (e.domain == "WebKitErrorDomain" && e.code == 102) { return }
        if webView !== web { return }
        NSLog("EchoIsland: page load failed: %@ %ld", e.domain, e.code)
        showCrashScreen("打不开游戏画面 😵\n\n点这里再试一次\n（\(e.domain) \(e.code)）")
    }

    // ---------- 麦克风：自己的网页直接放行（系统那一次「允许使用麦克风」的弹窗还是会问），别的一律不给 ----------
    // 不实现这个方法时 WebKit 每次打开页面都会再弹一个「允许 echoisland://localhost 使用麦克风吗」，所以要实现

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping @MainActor @Sendable (WKPermissionDecision) -> Void) {
        decisionHandler(type == .microphone && Bridge.trusted(origin) ? .grant : .deny)
    }

    // ---------- prompt / alert / confirm ----------

    // prompt 有两种：原生桥的同步通道（开头是 Bridge.tag），和网页自己的输入框（家庭版粘贴 AI 密钥、填中转服务地址）
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable (String?) -> Void) {
        if prompt.hasPrefix(Bridge.tag) {
            guard frame.isMainFrame, Bridge.trusted(frame.securityOrigin) else { completionHandler(nil); return }
            completionHandler(bridge.handlePrompt(prompt))
            return
        }
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { f in
            f.text = defaultText
            f.autocorrectionType = .no
            f.autocapitalizationType = .none
            f.clearButtonMode = .whileEditing
        }
        a.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "好", style: .default) { [weak a] _ in completionHandler(a?.textFields?.first?.text ?? "") })
        if !show(a) { completionHandler(nil) }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "好", style: .default) { _ in completionHandler() })
        if !show(a) { completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "好", style: .default) { _ in completionHandler(true) })
        if !show(a) { completionHandler(false) }
    }

    // 弹得出来返回 true；画面还没上屏就返回 false（调用的人要自己把回调叫掉）
    private func show(_ alert: UIAlertController) -> Bool {
        if view.window == nil { return false }
        top().present(alert, animated: true)
        return true
    }

    // ---------- 调试包里给自动化测试看的状态（ios/UITests）：屏幕最下面一行很小的字，每半秒更新一次 ----------
    // 内容：{"native":{原生这边：网页在不在、出错画面、最上面弹着什么、画面大小、麦克风权限},"page":{网页那边：见 statusProbe}}
    #if DEBUG
    private static let statusProbe = #"""
        (function () {
          try {
            var h = document.getElementById('home');
            return JSON.stringify({
              ready: document.readyState, href: location.href, secure: window.isSecureContext === true,
              media: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
              native: !!window.EchoNative, ios: window.ECHO_IOS === 1, app: window.ECHO_APP === 1,
              game: !!window.EchoGame, home: !!(h && !h.hidden), wizard: !!document.querySelector('.su'),
              place: !!document.querySelector('.pl'),
              edition: (window.EchoNative ? String(EchoNative.edition()) : ''),
              errs: (window.EchoErr && EchoErr.count ? EchoErr.count(1) : -1),
              lastErr: (function () { try { var l = window.EchoErr && EchoErr.list ? EchoErr.list() : []; var e = l && l.length ? l[l.length - 1] : null; return e ? String(e.msg || e.m || JSON.stringify(e)).slice(0, 160) : ''; } catch (e) { return ''; } })(),
              ogg: (function () { try { return new Audio().canPlayType('audio/ogg; codecs="opus"'); } catch (e) { return 'err'; } })(),
              vw: window.innerWidth, vh: window.innerHeight,
              test: window.__echoTestResult || null
            });
          } catch (e) { return JSON.stringify({ probeError: String(e) }); }
        })()
        """#

    // 放在一个单独的小窗口里（叠在最上面、不接触摸）：弹出分享面板、文件选择器时也读得到
    private func startStatus() {
        guard let scene = view.window?.windowScene else { return }
        let win = UIWindow(windowScene: scene)
        win.windowLevel = UIWindow.Level(rawValue: UIWindow.Level.alert.rawValue + 1)
        win.isUserInteractionEnabled = false
        win.backgroundColor = .clear
        let root = UIViewController()
        root.view.backgroundColor = .clear
        win.rootViewController = root
        let l = UILabel(frame: root.view.bounds)
        l.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        l.font = .systemFont(ofSize: 5)
        l.textColor = .white
        l.text = "{}"
        l.isAccessibilityElement = true
        l.accessibilityIdentifier = "echo-status"
        root.view.addSubview(l)
        win.isHidden = false
        statusWindow = win
        statusLabel = l
        placeStatus()
        statusTimer = Timer.scheduledTimer(timeInterval: 0.5, target: self, selector: #selector(pollStatus), userInfo: nil, repeats: true)
    }

    // 贴在屏幕最下面一条（转屏以后跟着换）
    private func placeStatus() {
        guard let win = statusWindow, let b = view.window?.bounds else { return }
        let f = CGRect(x: 0, y: b.height - 8, width: b.width, height: 8)
        if win.frame != f { win.frame = f }
    }

    private func nativeStatus() -> String {
        let presented = top() === self ? "" : String(describing: type(of: top()))
        let o: [String: Any] = [
            "web": web != nil, "crash": crashLabel != nil, "gen": gen, "presented": presented,
            "w": Int(view.bounds.width), "h": Int(view.bounds.height), "orient": orient,
            "mic": Bridge.micState(), "sockets": bridge.net.openCount,
        ]
        return Bridge.json(o)
    }

    @objc private func pollStatus() {
        placeStatus()
        let native = nativeStatus()
        guard let w = web else { statusLabel?.text = "{\"native\":" + native + ",\"page\":null}"; return }
        w.evaluateJavaScript(GameViewController.statusProbe) { [weak self] value, error in
            var page = "null"
            if let s = value as? String { page = s }
            else if let e = error { page = "{\"jsError\":" + Bridge.jsStr(String(describing: e)) + "}" }
            self?.statusLabel?.text = "{\"native\":" + native + ",\"page\":" + page + "}"
        }
    }
    #endif
}

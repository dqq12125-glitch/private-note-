import UIKit

// 回声岛 iPhone 版：一个全屏的 WKWebView 壳（和 android/ 的 WebView 壳是一对）。
// 游戏网页整个打包在 App 里（www/），用 echoisland://localhost/ 这个自己的地址打开，离线能玩；
// 原生桥 EchoNative 的方法和安卓一模一样（android/README.md 的表），网页不用改。说明见 ios/README.md
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        // 订阅：一开 App 就听 Transaction.updates（苹果只在刚打开时把没 finish 的交易给一次，晚了会错过；Store.swift）
        Store.shared.start()
        return true
    }

    // 用「场景」的写法（苹果说 iOS 26 之后的系统不这样写的 App 打不开）
    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let cfg = UISceneConfiguration(name: "Default", sessionRole: connectingSceneSession.role)
        cfg.delegateClass = SceneDelegate.self
        return cfg
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var game: GameViewController?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let ws = scene as? UIWindowScene else { return }
        let vc = GameViewController()
        let w = UIWindow(windowScene: ws)
        w.backgroundColor = GameViewController.background
        w.rootViewController = vc
        w.makeKeyAndVisible()
        window = w
        game = vc
    }

    // 回到前台（也包括：系统的麦克风弹窗关掉、来电结束、从「设置」回来）
    func sceneDidBecomeActive(_ scene: UIScene) {
        UIApplication.shared.isIdleTimerDisabled = true      // 玩的时候屏幕常亮
        game?.appBecameActive()
    }

    // 要离开前台（来电、下拉通知中心、切到别的 App）：先让网页把存档存好
    func sceneWillResignActive(_ scene: UIScene) {
        UIApplication.shared.isIdleTimerDisabled = false
        game?.appWillResign()
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        game?.appWentBackground()
    }
}

import Foundation

// 直连阿里云百炼：带密钥的 WebSocket（实时语音、实时识别）和 HTTPS（评语、点评、合成）。
// 和安卓的 OkHttp 那一段是一对：只许连 dashscope.aliyuncs.com，网页拿不到密钥本身，
// 结果用同样的话回给网页：WebSocket 是 open / message / closed / error，HTTPS 是 ok / fail。
// 线程：URLSession 的回调都在主线程上（delegateQueue = .main），网页调过来的也在主线程上，所以这里的状态不用加锁；
// 回给网页的 emit 一定在主线程上调（@MainActor）。
final class DashScope: NSObject, URLSessionWebSocketDelegate, @unchecked Sendable {
    static let host = "dashscope.aliyuncs.com"
    static let wsPrefix = "wss://" + host + "/"
    static let httpsPrefix = "https://" + host + "/"
    static let noKeyWs = "HTTP 401 no key"
    static let noKeyPost = "{\"code\":\"InvalidApiKey\",\"message\":\"no key\",\"status\":401}"
    static let pingEvery: TimeInterval = 20      // 和安卓的 pingInterval 一样：安静的时候也别被网络设备断开

    // 回给网页：第几个网页（gen）、网页给的编号、类型、数据
    typealias Emit = @MainActor @Sendable (_ gen: Int, _ id: Int, _ type: String, _ data: String) -> Void

    private final class Sock: @unchecked Sendable {
        let id: Int
        let gen: Int
        let task: URLSessionWebSocketTask
        var closing = false          // 网页自己要关的
        var done = false             // 已经告诉过网页「关了 / 出错了」
        init(id: Int, gen: Int, task: URLSessionWebSocketTask) { self.id = id; self.gen = gen; self.task = task }
    }

    private var session: URLSession!
    private var socks: [Int: Sock] = [:]            // 网页给的编号 → 连接
    private var byTask: [Int: Sock] = [:]           // URLSession 的任务编号 → 连接
    private var pinger: Timer?
    private let onEmit: Emit

    init(emit: @escaping Emit) {
        onEmit = emit
        super.init()
        let cfg = URLSessionConfiguration.ephemeral          // 不留缓存、不留 cookie
        cfg.waitsForConnectivity = false
        cfg.timeoutIntervalForRequest = 60
        cfg.httpShouldSetCookies = false
        cfg.requestCachePolicy = .reloadIgnoringLocalCacheData
        session = URLSession(configuration: cfg, delegate: self, delegateQueue: OperationQueue.main)
    }

    // 回给网页（一定在主线程上）
    private func emit(_ gen: Int, _ id: Int, _ type: String, _ data: String) {
        let f = onEmit
        if Thread.isMainThread {
            MainActor.assumeIsolated { f(gen, id, type, data) }
        } else {
            DispatchQueue.main.async { MainActor.assumeIsolated { f(gen, id, type, data) } }
        }
    }

    // 地址是不是阿里云的（开头必须一模一样，主机名再核对一遍）
    static func allowed(_ url: String?, prefix: String) -> URL? {
        guard let s = url, s.hasPrefix(prefix), let u = URL(string: s), u.host?.lowercased() == host,
              u.user == nil, u.password == nil, u.port == nil else { return nil }
        return u
    }

    // 出错的原因写成固定的英文（不用系统的本地化文字：网页按这些字分「没网 / 密钥 / 额度 / 太忙」）。
    // 断网、找不到服务器的，开头和安卓一样写 Unable to resolve host
    static func describe(_ error: Error) -> String {
        let e = error as NSError
        guard e.domain == NSURLErrorDomain else { return "\(e.domain) \(e.code)" }
        let names: [Int: String] = [
            NSURLErrorTimedOut: "timed out", NSURLErrorCannotFindHost: "cannot find host", NSURLErrorCannotConnectToHost: "cannot connect to host",
            NSURLErrorNetworkConnectionLost: "connection lost", NSURLErrorDNSLookupFailed: "DNS lookup failed",
            NSURLErrorNotConnectedToInternet: "not connected to the internet", NSURLErrorSecureConnectionFailed: "secure connection failed",
            NSURLErrorBadServerResponse: "bad server response", NSURLErrorCancelled: "cancelled",
            NSURLErrorDataNotAllowed: "cellular data not allowed", NSURLErrorInternationalRoamingOff: "roaming off",
        ]
        let text = "NSURLError \(e.code) " + (names[e.code] ?? "failed")
        let offline = [NSURLErrorNotConnectedToInternet, NSURLErrorCannotFindHost, NSURLErrorDNSLookupFailed,
                       NSURLErrorDataNotAllowed, NSURLErrorInternationalRoamingOff]
        return offline.contains(e.code) ? "Unable to resolve host \"\(host)\" (\(text))" : text
    }

    // ---------- WebSocket ----------

    func wsOpen(gen: Int, id: Int, url: String?, key: String) {
        guard let u = DashScope.allowed(url, prefix: DashScope.wsPrefix) else { emit(gen, id, "error", "bad url"); return }
        // 没有密钥：不用连了，直接按「密钥失效」回（网页认 401，提示「请家长在设置里粘贴 AI 密钥」）
        if key.isEmpty { emit(gen, id, "error", DashScope.noKeyWs); return }
        if let old = socks[id] { drop(old); old.task.cancel() }
        var req = URLRequest(url: u)
        req.setValue("Bearer " + key, forHTTPHeaderField: "Authorization")
        let task = session.webSocketTask(with: req)
        task.maximumMessageSize = 16 * 1024 * 1024
        let s = Sock(id: id, gen: gen, task: task)
        socks[id] = s
        byTask[task.taskIdentifier] = s
        task.resume()
    }

    func wsSend(id: Int, text: String) {
        guard let s = socks[id], !s.done else { return }
        s.task.send(.string(text)) { _ in }          // 发不出去时，连接本身的出错回调会告诉网页
    }

    func wsClose(id: Int) {
        guard let s = socks[id] else { return }
        s.closing = true
        socks[id] = nil                              // 和安卓一样：编号马上让出来，「closed」等连接真的关了再回
        s.task.cancel(with: .normalClosure, reason: Data("bye".utf8))
    }

    // 网页重建了（渲染进程挂了）或者 App 要退了：全部断开，不再回调
    func closeAll() {
        for s in byTask.values { s.done = true; s.task.cancel() }
        socks.removeAll()
        byTask.removeAll()
        updatePinger()
    }

    var openCount: Int { return byTask.count }

    private func drop(_ s: Sock) {
        s.done = true
        if socks[s.id] === s { socks[s.id] = nil }
        byTask[s.task.taskIdentifier] = nil
        updatePinger()
    }

    private func finish(_ s: Sock, _ type: String, _ data: String) {
        if s.done { return }
        drop(s)
        emit(s.gen, s.id, s.closing ? "closed" : type, s.closing && type == "error" ? "" : data)
    }

    // 收消息：收到一条再等下一条，直到出错（断了以后 didCompleteWithError 来收尾）
    private func receive(_ s: Sock) {
        s.task.receive { [weak self] result in
            guard let self = self, !s.done else { return }
            switch result {
            case .success(let msg):
                if case .string(let text) = msg { self.emit(s.gen, s.id, "message", text) }   // 阿里云只发文字消息
                self.receive(s)
            case .failure:
                break
            }
        }
    }

    // 有连接开着的时候每 20 秒给每条连接发一个 ping；都关了就停
    private func updatePinger() {
        if byTask.isEmpty {
            pinger?.invalidate()
            pinger = nil
        } else if pinger == nil {
            pinger = Timer.scheduledTimer(timeInterval: DashScope.pingEvery, target: self, selector: #selector(pingAll), userInfo: nil, repeats: true)
        }
    }

    @objc private func pingAll() {
        for s in byTask.values where !s.done { s.task.sendPing { _ in } }
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol proto: String?) {
        guard let s = byTask[webSocketTask.taskIdentifier], !s.done else { return }
        emit(s.gen, s.id, "open", "")
        receive(s)
        updatePinger()
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask,
                    didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        guard let s = byTask[webSocketTask.taskIdentifier] else { return }
        let why = reason.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        finish(s, "closed", why)
    }

    // 连接结束（握手就被拒、半路断了、正常关完都会到这里）
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let s = byTask[task.taskIdentifier] else { return }
        guard let error = error else { finish(s, "closed", ""); return }
        var msg = DashScope.describe(error)
        // 握手时服务器回了 401 / 429 之类：把状态码写在前面（网页按 HTTP 401、HTTP 429 分原因，和安卓一样）
        if let http = task.response as? HTTPURLResponse, http.statusCode != 101 { msg = "HTTP \(http.statusCode) " + msg }
        finish(s, "error", msg)
    }

    // ---------- HTTPS ----------

    func post(gen: Int, id: Int, url: String?, body: String?, key: String) {
        guard let u = DashScope.allowed(url, prefix: DashScope.httpsPrefix) else { emit(gen, id, "fail", "bad url"); return }
        if key.isEmpty { emit(gen, id, "fail", DashScope.noKeyPost); return }
        var req = URLRequest(url: u)
        req.httpMethod = "POST"
        req.setValue("Bearer " + key, forHTTPHeaderField: "Authorization")
        req.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        req.httpBody = Data((body ?? "").utf8)
        session.dataTask(with: req) { [weak self] data, response, error in
            guard let self = self else { return }
            if let error = error { self.emit(gen, id, "fail", DashScope.describe(error)); return }
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            let ok = code >= 200 && code < 300
            var text = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            if !ok && text.isEmpty { text = "HTTP \(code)" }
            self.emit(gen, id, ok ? "ok" : "fail", text)
        }.resume()
    }
}

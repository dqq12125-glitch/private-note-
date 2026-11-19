import Foundation
import WebKit

// 把 App 里打包的游戏网页（www/）当成一个网站给 WKWebView：echoisland://localhost/index.html。
// 为什么不用 file://：自己登记的地址在 iOS 15 起算「安全的网页」（麦克风 getUserMedia、fetch 读模型和配音都能用），
// 存档（localStorage）也跟着这个固定的地址走。主机名一定要是 localhost、不带端口（WebKit 也把 localhost 当安全来源）。
// 配音 <audio> 会带 Range 来要一段：这里按 206 + Content-Range 回。每个回应都带 no-cache：装了新版不会还用旧文件。
//
// 分两层：
//   WebAssets       纯逻辑（地址 → 文件、扩展名 → 类型、Range → 哪一段、拼回应），不碰界面，哪个线程都能调，测试直接调；
//   WebAssetHandler 交给 WKWebView 的那一层：在后台线程读文件，回到主线程交给 WebKit。
//                   WebKit 随时可能叫停一个请求（页面换了、<audio> 不要了）：叫停以后再往这个请求里写东西会抛异常、App 直接崩，
//                   所以每个请求先记在 live 里，stop 时划掉，读完回到主线程时还在 live 里才回。

enum WebAssets {
    static let scheme = "echoisland"
    static let host = "localhost"
    static let origin = scheme + "://" + host
    static let home = URL(string: origin + "/index.html")!
    static let testPrefix = "/__test/"          // 调试包里的原生桥自测页（ios/www-test），正式包里没有

    // 扩展名 → 类型。文字类的都按 UTF-8
    static let mime: [String: String] = [
        "html": "text/html; charset=utf-8", "htm": "text/html; charset=utf-8",
        "js": "text/javascript; charset=utf-8", "mjs": "text/javascript; charset=utf-8",
        "css": "text/css; charset=utf-8", "json": "application/json; charset=utf-8",
        "txt": "text/plain; charset=utf-8", "svg": "image/svg+xml", "xml": "application/xml; charset=utf-8",
        "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp", "gif": "image/gif", "ico": "image/x-icon",
        "ogg": "audio/ogg", "oga": "audio/ogg", "opus": "audio/ogg", "mp3": "audio/mpeg", "wav": "audio/wav", "m4a": "audio/mp4", "webm": "audio/webm",
        "glb": "model/gltf-binary", "gltf": "model/gltf+json", "bin": "application/octet-stream", "wasm": "application/wasm",
        "woff2": "font/woff2", "woff": "font/woff", "ttf": "font/ttf", "otf": "font/otf",
    ]

    static func mimeType(_ ext: String) -> String {
        return mime[ext.lowercased()] ?? "application/octet-stream"
    }

    // 地址里的路径 → 包里的文件。不许跳出 www/（.. 之类的一律当没有）；/__test/ 开头的去 www-test/（只有调试包有）
    static func fileURL(for url: URL, root: URL, testRoot: URL?) -> URL? {
        guard url.scheme?.lowercased() == scheme, url.host?.lowercased() == host else { return nil }
        var path = url.path                        // 已经解过 %XX
        if path.isEmpty || path == "/" { path = "/index.html" }
        var base = root
        if path.hasPrefix(testPrefix) {
            guard let t = testRoot else { return nil }
            base = t
            path = "/" + String(path.dropFirst(testPrefix.count))
        }
        if path.contains("..") || path.contains("\\") || path.contains("\0") { return nil }
        let f = base.appendingPathComponent(String(path.dropFirst()), isDirectory: false).standardizedFileURL
        let basePath = base.path.hasSuffix("/") ? base.path : base.path + "/"
        guard f.path.hasPrefix(basePath) else { return nil }
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: f.path, isDirectory: &isDir), !isDir.boolValue else { return nil }
        return f
    }

    // "bytes=a-b" / "bytes=a-" / "bytes=-n" → 要的那一段（闭区间）；看不懂、越界就 nil（那就整份回）
    static func byteRange(_ header: String?, total: Int) -> ClosedRange<Int>? {
        guard let h = header?.trimmingCharacters(in: .whitespaces).lowercased(), h.hasPrefix("bytes="), total > 0 else { return nil }
        let spec = String(h.dropFirst(6))
        if spec.contains(",") { return nil }                       // 一次要好几段的：不支持，整份回
        let parts = spec.split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false).map { $0.trimmingCharacters(in: .whitespaces) }
        guard parts.count == 2 else { return nil }
        if parts[0].isEmpty {                                      // 最后 n 个字节
            guard let n = Int(parts[1]), n > 0 else { return nil }
            return max(0, total - n)...(total - 1)
        }
        guard let a = Int(parts[0]), a >= 0, a < total else { return nil }
        if parts[1].isEmpty { return a...(total - 1) }
        guard let b = Int(parts[1]), b >= a else { return nil }
        return a...min(b, total - 1)
    }

    // 一个请求的回应（状态码、头、正文）。HEAD 请求的正文由调用的人不发
    struct Reply {
        let status: Int
        let headers: [String: String]
        let body: Data
    }

    // 读文件、拼回应：没有的 404；带 Range 的 206 + Content-Range；其余 200
    static func reply(for request: URLRequest, root: URL, testRoot: URL?) -> Reply {
        guard let url = request.url, let file = fileURL(for: url, root: root, testRoot: testRoot),
              let data = try? Data(contentsOf: file, options: .mappedIfSafe) else {
            return make(404, "text/plain; charset=utf-8", Data("not found".utf8), [:])
        }
        let type = mimeType(file.pathExtension)
        let total = data.count
        if let r = byteRange(request.value(forHTTPHeaderField: "Range"), total: total) {
            return make(206, type, data.subdata(in: r.lowerBound..<(r.upperBound + 1)),
                        ["Content-Range": "bytes \(r.lowerBound)-\(r.upperBound)/\(total)"])
        }
        return make(200, type, data, [:])
    }

    private static func make(_ status: Int, _ type: String, _ body: Data, _ extra: [String: String]) -> Reply {
        var headers = [
            "Content-Type": type,
            "Content-Length": String(body.count),
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
        ]
        for (k, v) in extra { headers[k] = v }
        return Reply(status: status, headers: headers, body: body)
    }
}

@MainActor
final class WebAssetHandler: NSObject, WKURLSchemeHandler {
    private let root: URL
    private let testRoot: URL?
    // 读文件的后台线程（一个一个读：文件都小，免得一下子开出几十个线程）
    private let io = DispatchQueue(label: "echo-island.web-assets", qos: .userInitiated)
    // 还在等回应的请求（只在主线程上读写）
    private var live = Set<ObjectIdentifier>()

    override init() {
        let res = Bundle.main.resourceURL ?? Bundle.main.bundleURL
        root = res.appendingPathComponent("www", isDirectory: true).standardizedFileURL
        #if DEBUG
        testRoot = res.appendingPathComponent("www-test", isDirectory: true).standardizedFileURL
        #else
        testRoot = nil
        #endif
        super.init()
    }

    // 给测试用：这个地址对应包里哪个文件（nil = 没有 / 不给）
    func fileURL(for url: URL) -> URL? {
        return WebAssets.fileURL(for: url, root: root, testRoot: testRoot)
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let key = ObjectIdentifier(urlSchemeTask)
        live.insert(key)
        let request = urlSchemeTask.request
        let root = self.root, testRoot = self.testRoot
        io.async { [weak self] in
            let r = WebAssets.reply(for: request, root: root, testRoot: testRoot)
            DispatchQueue.main.async {
                MainActor.assumeIsolated {
                    // 读的时候被叫停了（或者网页已经换掉）：什么都不回
                    guard let self = self, self.live.remove(key) != nil else { return }
                    WebAssetHandler.send(urlSchemeTask, request, r)
                }
            }
        }
    }

    // WebKit 不要这个请求了：划掉，读完以后就不回了
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        live.remove(ObjectIdentifier(urlSchemeTask))
    }

    private static func send(_ task: WKURLSchemeTask, _ request: URLRequest, _ r: WebAssets.Reply) {
        let url = request.url ?? WebAssets.home
        guard let res = HTTPURLResponse(url: url, statusCode: r.status, httpVersion: "HTTP/1.1", headerFields: r.headers) else {
            task.didFailWithError(URLError(.cannotParseResponse))
            return
        }
        task.didReceive(res)
        if request.httpMethod?.uppercased() != "HEAD" && !r.body.isEmpty { task.didReceive(r.body) }
        task.didFinish()
    }
}

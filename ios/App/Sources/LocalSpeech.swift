import UIKit
import AVFoundation
import Speech

// 口语题的本机识别（iPhone 才有；2026-11-20 老板在 iPhone 上：「那个识别，还是太慢了，有时候还不准」）。
// 以前口语题在 iPhone 上也是网页开麦克风 → 连服务器 → 阿里云实时识别（北京）：每题新连一次、要登录、算每天的 AI 额度。
// 现在先用手机自带的语音识别在手机上听写：不联网、不用登录、不算额度，边说边出字；这台手机用不了才由网页改走云端那一条。
//
// 第二版（2026-11-20 晚）：**麦克风归网页，这里只管识别**。
//   第一版这里自己用 AVAudioEngine 录音（App 自己的声音会话），在老板的 iPhone 16 Pro（iOS 26.6）上一点话筒就停在「请说……」、什么都认不出来：
//   App 进程的声音会话和网页那一层（WebKit 在另一个进程里放声音、录音）的声音会话互相打断，识别被掐掉。模拟器没有本机识别，云上的测试碰不到这一步。
//   现在网页用和云端识别同一套代码开麦克风（talk.js 的 lmOpen：getUserMedia + AudioWorklet），把 16 位 PCM 一段段交过来（speechFeed），
//   这里一点声音会话都不碰（不 setActive、不改类别、不录音），麦克风的权限也是网页的事（getUserMedia 弹框）。
//
// 给网页四个异步方法（Bridge.callAsync → 这里 → window.__echoNative(id, 'ok' / 'fail', JSON 文字)）和一个事件：
//   speechState(id)          现在能不能用：{auth, mic, onDevice, available, locale, engine, listening}。不弹任何框
//   speechStart(id, opts)    开始一次识别。opts 是 JSON 文字：{short 单词 / 短语, long 说几句话, ask 要不要弹权限框（默认要）, locale（默认 en-US）,
//                            rate 送来的声音的采样率（默认 16000）}。第一次会弹「语音识别」的系统框；识别任务建好了就回 ok {listening, sid, ms, locale, engine}；
//                            不行回 fail {error, message}：unavailable 这台手机这门语言没有本机识别 / denied、restricted 没给语音识别的权限 /
//                            busy 正在弹权限框 / not-asked 还没问过权限（ask:false 时）/ cancelled 弹框时网页叫停了 / background App 在后台
//   speechFeed(sid, base64)  一段声音：16 位有符号、小端、单声道的 PCM（采样率是 speechStart 给的 rate），base64。一秒约 10 段。
//                            **不回话**（和 wsSend 一样）：编号不对、已经停了、解不开的一律不管
//   speechStop(id)           停（网页判断说完了、对上答案了、学的人点了停）：ok {stopped: true / false}
//   事件 echo-speech         {sid: speechStart 的编号, kind, t: 开始以后几毫秒, …}：
//                            partial / final {text}（到目前为止听到的整句）、voice {on}（送来的声音开始 / 停止出声，只在变的时候发）、
//                            error {code, message}、end {reason: stop / final / error / background / page / replaced, fed: 收到几段声音}
// 规矩（老板 11-20 定的）：
//   · 只在手机上识别（requiresOnDeviceRecognition = true），**不退回苹果的服务器识别**：这台手机不支持就回 unavailable，网页改走云端。
//   · 打分要诚实：识别不知道这道题的答案——不设 contextualStrings、不用自定义语言模型。识别只管听写，打分还是网页的 scoreSpeech()。
//     （以前试过让模型看着答案打分，读错的也给过。）
//   · 什么时候算说完由网页定（文字停住不变的计时 + 这里的出声 / 不出声），这里不等苹果的「最终结果」（它要等很久）。
//   · 切到后台、网页重建：当场停，发 end。
// 识别引擎（SpeechEngine）单独一层：现在是 SFSpeechRecognizer；以后换 iOS 26 的 SpeechAnalyzer / SpeechTranscriber，
// 只要再写一个 SpeechEngine，权限顺序、收声音、事件、计时都不用动。

// 常数（不归哪个线程管）
enum SpeechConst {
    static let locale = "en-US"
    static let locales = ["en-US", "en-GB", "en-AU"]       // 网页可以要的；别的一律按 en-US
    static let rate = 16000.0                            // 网页送来的声音默认 16kHz（talk.js 的 pcm16，和云端识别一样）
}

// speechStart 的选项
struct SpeechOpts: Sendable {
    var short = false
    var long = false
    var ask = true
    var locale = SpeechConst.locale
    var rate = SpeechConst.rate
}

// 收声音的那一头（交给识别请求）
typealias SpeechSink = @Sendable (AVAudioPCMBuffer) -> Void
// 识别到的字（到目前为止的整句、是不是最终结果）、出错（代号、说明）：都在主线程上回
typealias SpeechText = @MainActor @Sendable (_ text: String, _ isFinal: Bool) -> Void
typealias SpeechError = @MainActor @Sendable (_ code: String, _ message: String) -> Void

// 开始的结果：拿到 sink 就是开起来了；没拿到看 error / message
struct SpeechBegin {
    let sink: SpeechSink?
    let error: String
    let message: String
}

// 识别引擎：权限、能不能用、开始 / 收尾。收声音、计时、事件在 LocalSpeech 里
@MainActor
protocol SpeechEngine: AnyObject {
    var name: String { get }
    // 语音识别的权限：authorized / notDetermined / denied / restricted
    func authorization() -> String
    // 弹权限框，问完（不管答了什么）在主线程上调 done
    func requestAuthorization(_ done: @escaping @MainActor @Sendable () -> Void)
    // 这门语言：onDevice 这台手机能不能本机识别、available 现在能不能用。不弹框
    func check(locale: String) -> (onDevice: Bool, available: Bool)
    func begin(locale: String, short: Bool, onText: @escaping SpeechText, onError: @escaping SpeechError) -> SpeechBegin
    // 不再有声音了
    func end()
    // 扔掉，不要结果了
    func cancel()
}

// ---------- 现在的引擎：SFSpeechRecognizer，只在手机上识别 ----------
@MainActor
final class AppleSpeechEngine: SpeechEngine {
    let name = "SFSpeechRecognizer"
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    nonisolated static func authName(_ s: SFSpeechRecognizerAuthorizationStatus) -> String {
        switch s {
        case .authorized: return "authorized"
        case .notDetermined: return "notDetermined"
        case .denied: return "denied"
        case .restricted: return "restricted"
        @unknown default: return "denied"
        }
    }

    func authorization() -> String {
        return AppleSpeechEngine.authName(SFSpeechRecognizer.authorizationStatus())
    }

    func requestAuthorization(_ done: @escaping @MainActor @Sendable () -> Void) {
        SFSpeechRecognizer.requestAuthorization(AppleSpeechEngine.asked(done))
    }

    // 权限框的回调在别的线程上：回主线程再接着做（写成 nonisolated：回调不归主线程管）
    nonisolated static func asked(_ done: @escaping @MainActor @Sendable () -> Void) -> @Sendable (SFSpeechRecognizerAuthorizationStatus) -> Void {
        return { _ in LocalSpeech.onMain(done) }
    }

    func check(locale: String) -> (onDevice: Bool, available: Bool) {
        guard let r = SFSpeechRecognizer(locale: Locale(identifier: locale)) else { return (false, false) }
        return (r.supportsOnDeviceRecognition, r.isAvailable)
    }

    func begin(locale: String, short: Bool, onText: @escaping SpeechText, onError: @escaping SpeechError) -> SpeechBegin {
        cancel()
        guard let r = SFSpeechRecognizer(locale: Locale(identifier: locale)) else {
            return SpeechBegin(sink: nil, error: "unavailable", message: "no speech recognizer for " + locale)
        }
        // 只要本机识别：这台手机不支持就不开（不退回苹果的服务器）
        guard r.supportsOnDeviceRecognition else {
            return SpeechBegin(sink: nil, error: "unavailable", message: "on-device recognition is not supported for " + locale + " on this device")
        }
        guard r.isAvailable else {
            return SpeechBegin(sink: nil, error: "unavailable", message: "the speech recognizer is not available right now")
        }
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true            // 边说边出字
        req.requiresOnDeviceRecognition = true           // 声音不离开手机
        req.taskHint = .dictation                        // 照着念：听写
        req.addsPunctuation = false
        // 诚实打分：这里故意不设 contextualStrings、不用 customizedLanguageModel——识别不知道这道题的答案
        recognizer = r
        request = req
        task = r.recognitionTask(with: req, resultHandler: AppleSpeechEngine.results(onText, onError))
        return SpeechBegin(sink: AppleSpeechEngine.sink(req), error: "", message: "")
    }

    // 识别的回调（recognizer.queue，默认是主线程；不管在哪个线程都先把要的东西取出来，再回主线程）
    nonisolated static func results(_ onText: @escaping SpeechText, _ onError: @escaping SpeechError) -> @Sendable (SFSpeechRecognitionResult?, Error?) -> Void {
        return { result, error in
            let text = result.map { $0.bestTranscription.formattedString }
            let isFinal = result?.isFinal ?? false
            let ns = error.map { $0 as NSError }
            let code = ns.map { $0.domain + " " + String($0.code) }
            let msg = ns.map { $0.localizedDescription } ?? ""
            LocalSpeech.onMain {
                if let t = text { onText(t, isFinal) }
                if let c = code { onError(c, msg) }
            }
        }
    }

    // 声音交给识别
    nonisolated static func sink(_ req: SFSpeechAudioBufferRecognitionRequest) -> SpeechSink {
        return { buf in req.append(buf) }
    }

    func end() {
        request?.endAudio()
    }

    func cancel() {
        task?.cancel()
        task = nil
        request = nil
        recognizer = nil
    }
}

// ---------- 出声 / 不出声（给网页的「说完了」判断用：文字停住了、人也不出声了才算说完） ----------
// 量的是网页送来的声音（speechFeed，主线程上一段一段来），变的时候才告诉网页
final class VoiceMeter: @unchecked Sendable {
    static let onLevel: Float = 0.015                     // 均方根，约 -36 dBFS：在手机前说话一般 0.03–0.1，安静的房间约 0.003
    static let hangSec = 0.25                            // 小于它 0.25 秒才算停了（字和字之间的小停顿不算）
    private var loud = false
    private var quietFor = 0.0
    private let changed: @Sendable (Bool) -> Void

    init(changed: @escaping @Sendable (Bool) -> Void) {
        self.changed = changed
    }

    // 一段声音的均方根（只看第一个声道）
    static func rms(_ buf: AVAudioPCMBuffer) -> Float {
        guard let ch = buf.floatChannelData, buf.frameLength > 0 else { return 0 }
        let n = Int(buf.frameLength), p = ch[0]
        var sum: Float = 0
        for i in 0..<n { let v = p[i]; sum += v * v }
        return (sum / Float(n)).squareRoot()
    }

    func feed(_ buf: AVAudioPCMBuffer) {
        let sec = buf.format.sampleRate > 0 ? Double(buf.frameLength) / buf.format.sampleRate : 0
        level(VoiceMeter.rms(buf), seconds: sec)
    }

    // 拆出来给单元测试：这一段多响、多长
    func level(_ rms: Float, seconds: Double) {
        if rms >= VoiceMeter.onLevel {
            quietFor = 0
            if !loud { loud = true; changed(true) }
        } else if loud {
            quietFor += seconds
            if quietFor >= VoiceMeter.hangSec { loud = false; quietFor = 0; changed(false) }
        }
    }
}

// 弱引用的小盒子：出声 / 不出声的回调里拿着它，回到主线程再看 LocalSpeech 还在不在
final class WeakSpeech: @unchecked Sendable {
    weak var v: LocalSpeech?
    init(_ v: LocalSpeech) { self.v = v }
}

// ---------- 给原生桥的那一层：权限顺序、收声音、事件 ----------
@MainActor
final class LocalSpeech {
    typealias Reply = @MainActor @Sendable (_ ok: Bool, _ body: [String: Any]) -> Void

    // 正在听的那一次
    private final class Running {
        let sid: Int
        let t0: Date
        let rate: Double
        let sink: SpeechSink
        var meter: VoiceMeter?
        var fed = 0                                      // 收到几段声音（end 事件里带着，老板的截图上看得到）
        init(sid: Int, t0: Date, rate: Double, sink: @escaping SpeechSink) { self.sid = sid; self.t0 = t0; self.rate = rate; self.sink = sink }
    }

    private let engine: SpeechEngine
    private let onEvent: @MainActor ([String: Any]) -> Void
    private var cur: Running?
    private var asking = 0                               // 正在弹权限框的那一次（网页给的编号），0 = 没有
    private var askStopped = false                       // 弹框的时候网页叫停了
    private var observers: [NSObjectProtocol] = []

    init(engine: SpeechEngine, onEvent: @escaping @MainActor ([String: Any]) -> Void) {
        self.engine = engine
        self.onEvent = onEvent
        // 切到后台：不在后台识别（网页那边的麦克风 WebKit 自己会停）
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { _ = self?.stop(reason: "background") }
        })
    }

    // ---------- 小工具（纯逻辑，单元测试直接调） ----------

    // 回到主线程再做（系统的回调可能在别的线程上）
    nonisolated static func onMain(_ work: @escaping @MainActor @Sendable () -> Void) {
        if Thread.isMainThread {
            MainActor.assumeIsolated { work() }
        } else {
            DispatchQueue.main.async { MainActor.assumeIsolated { work() } }
        }
    }

    nonisolated static func fail(_ error: String, _ message: String) -> [String: Any] {
        return ["error": error, "message": message]
    }

    // speechStart 的第二个参数（JSON 文字）；读不懂就全用默认的
    nonisolated static func opts(_ json: String) -> SpeechOpts {
        var o = SpeechOpts()
        guard let d = json.data(using: .utf8), let j = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] else { return o }
        if let v = j["short"] as? Bool { o.short = v }
        if let v = j["long"] as? Bool { o.long = v }
        if let v = j["ask"] as? Bool { o.ask = v }
        if let v = j["locale"] as? String, SpeechConst.locales.contains(v) { o.locale = v }
        if let v = j["rate"] as? NSNumber, v.doubleValue >= 8000, v.doubleValue <= 48000 { o.rate = v.doubleValue }
        return o
    }

    nonisolated static func ms(_ since: Date) -> Int {
        return max(0, Int((Date().timeIntervalSince(since) * 1000).rounded()))
    }

    // 网页送来的一段声音（base64 的 16 位有符号小端单声道 PCM）→ 识别要的 AVAudioPCMBuffer（32 位浮点、单声道、不交错，采样率照 rate）。
    // 解不开、是空的、长度是单数（半个样本）→ nil
    nonisolated static func pcmBuffer(_ b64: String, rate: Double) -> AVAudioPCMBuffer? {
        guard rate > 0, let d = Data(base64Encoded: b64), d.count >= 2, d.count % 2 == 0,
              let fmt = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: rate, channels: 1, interleaved: false) else { return nil }
        let n = d.count / 2
        guard let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: AVAudioFrameCount(n)), let out = buf.floatChannelData?[0] else { return nil }
        d.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
            for i in 0..<n {
                let v = Int16(bitPattern: UInt16(raw[2 * i]) | (UInt16(raw[2 * i + 1]) << 8))
                out[i] = Float(v) / 32768
            }
        }
        buf.frameLength = AVAudioFrameCount(n)
        return buf
    }

    private func emit(_ o: [String: Any]) {
        onEvent(o)
    }

    // ---------- 给网页的 ----------

    func state() -> [String: Any] {
        let c = engine.check(locale: SpeechConst.locale)
        return ["auth": engine.authorization(), "mic": Bridge.micState(), "onDevice": c.onDevice, "available": c.available,
                "locale": SpeechConst.locale, "engine": engine.name, "listening": cur != nil]
    }

    func start(sid: Int, opts: String, reply: @escaping Reply) {
        let o = LocalSpeech.opts(opts)
        if asking != 0 { reply(false, LocalSpeech.fail("busy", "still asking for permission")); return }
        // 网页同时只要一个：上一次没停的（不该有）先停掉
        if cur != nil { stop(reason: "replaced") }
        // 这台手机这门语言没有本机识别：权限框都不用弹，网页直接改走云端
        guard engine.check(locale: o.locale).onDevice else {
            reply(false, LocalSpeech.fail("unavailable", "no on-device speech recognition for " + o.locale + " on this device"))
            return
        }
        step(sid: sid, o: o, t0: Date(), asked: false, reply: reply)
    }

    // 语音识别的权限：要弹框就弹完再回到这里（asked：这一次已经弹过了，不弹第二次）。麦克风的权限归网页（getUserMedia）
    private func step(sid: Int, o: SpeechOpts, t0: Date, asked: Bool, reply: @escaping Reply) {
        switch engine.authorization() {
        case "authorized":
            begin(sid: sid, o: o, t0: t0, reply: reply)
        case "notDetermined":
            if !o.ask || asked { reply(false, LocalSpeech.fail(asked ? "denied" : "not-asked", "speech recognition permission has not been given")); return }
            asking = sid
            askStopped = false
            engine.requestAuthorization { [weak self] in self?.resume(sid: sid, o: o, t0: t0, reply: reply) }
        case "restricted":
            reply(false, LocalSpeech.fail("restricted", "speech recognition is restricted on this device"))
        default:
            reply(false, LocalSpeech.fail("denied", "speech recognition permission was denied"))
        }
    }

    // 权限框答完了：网页这期间叫停了就不开；不然再看一遍权限（这一次不再弹框）
    private func resume(sid: Int, o: SpeechOpts, t0: Date, reply: @escaping Reply) {
        guard asking == sid else { return }
        asking = 0
        if askStopped {
            askStopped = false
            reply(false, LocalSpeech.fail("cancelled", "stopped while asking for permission"))
            return
        }
        step(sid: sid, o: o, t0: t0, asked: true, reply: reply)
    }

    private func begin(sid: Int, o: SpeechOpts, t0: Date, reply: @escaping Reply) {
        if UIApplication.shared.applicationState == .background {
            reply(false, LocalSpeech.fail("background", "the app is in the background"))
            return
        }
        let r = engine.begin(locale: o.locale, short: o.short,
                             onText: { [weak self] text, isFinal in self?.heard(sid, text, isFinal) },
                             onError: { [weak self] code, message in self?.failed(sid, code, message) })
        guard let sink = r.sink else {
            reply(false, LocalSpeech.fail(r.error.isEmpty ? "unavailable" : r.error, r.message))
            return
        }
        let run = Running(sid: sid, t0: t0, rate: o.rate, sink: sink)
        let me = WeakSpeech(self)                        // 出声 / 不出声的回调只拿一个弱引用
        run.meter = VoiceMeter { on in LocalSpeech.onMain { me.v?.voice(sid, on) } }
        cur = run
        // 识别任务建好了就回 ok：网页把这之前录好、存着的声音一起补过来
        reply(true, ["listening": true, "sid": sid, "ms": LocalSpeech.ms(t0), "locale": o.locale, "short": o.short, "rate": o.rate, "engine": engine.name])
    }

    // 网页送来一段声音。不认识的编号、已经停了的、解不开的：不管（不回话）
    func feed(sid: Int, b64: String) {
        guard let run = cur, run.sid == sid, let buf = LocalSpeech.pcmBuffer(b64, rate: run.rate) else { return }
        run.fed += 1
        run.sink(buf)
        run.meter?.feed(buf)
    }

    private func heard(_ sid: Int, _ text: String, _ isFinal: Bool) {
        guard let run = cur, run.sid == sid else { return }
        emit(["sid": sid, "kind": isFinal ? "final" : "partial", "text": text, "t": LocalSpeech.ms(run.t0)])
        if isFinal { stop(sid: sid, reason: "final") }
    }

    private func failed(_ sid: Int, _ code: String, _ message: String) {
        guard let run = cur, run.sid == sid else { return }      // 自己叫停以后的「被取消」不算
        emit(["sid": sid, "kind": "error", "code": code, "message": message, "t": LocalSpeech.ms(run.t0), "fed": run.fed])
        stop(sid: sid, reason: "error")
    }

    private func voice(_ sid: Int, _ on: Bool) {
        guard let run = cur, run.sid == sid else { return }
        emit(["sid": sid, "kind": "voice", "on": on, "t": LocalSpeech.ms(run.t0)])
    }

    // 停（不管是哪一次）。正在弹权限框的：答完了不开。返回有没有停下什么
    @discardableResult
    func stop(reason: String) -> Bool {
        var had = false
        if asking != 0 { askStopped = true; had = true }
        if let run = cur { had = stop(sid: run.sid, reason: reason) || had }
        return had
    }

    // 停下这一次：收尾识别，告诉网页 end（带着收到几段声音）
    @discardableResult
    private func stop(sid: Int, reason: String) -> Bool {
        guard let run = cur, run.sid == sid else { return false }
        cur = nil
        engine.end()
        engine.cancel()
        emit(["sid": sid, "kind": "end", "reason": reason, "t": LocalSpeech.ms(run.t0), "fed": run.fed])
        return true
    }

    var listening: Bool { return cur != nil }
}

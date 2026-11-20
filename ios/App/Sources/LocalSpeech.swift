import UIKit
import AVFoundation
import Speech

// 口语题的本机识别（iPhone 才有；2026-11-20 老板在 iPhone 上：「那个识别，还是太慢了，有时候还不准」）。
// 以前口语题在 iPhone 上也是网页开麦克风 → 连服务器 → 阿里云实时识别（北京）：每题新连一次、要登录、算每天的 AI 额度。
// 现在先用手机自带的语音识别在手机上听写：不联网、不用登录、不算额度，边说边出字；这台手机用不了才由网页改走云端那一条。
// 给网页三个异步方法（Bridge.callAsync → 这里 → window.__echoNative(id, 'ok' / 'fail', JSON 文字)）和一个事件：
//   speechState(id)          现在能不能用：{auth, mic, onDevice, available, locale, engine, listening}。不弹任何框
//   speechStart(id, opts)    开始听。opts 是 JSON 文字：{short 单词 / 短语, long 说几句话, ask 要不要弹权限框（默认要）, locale（默认 en-US）}。
//                            第一次会弹「语音识别」和麦克风的系统框；真的开始录了才回 ok {listening, sid, ms, locale, engine}；
//                            不行回 fail {error, message}：unavailable 这台手机这门语言没有本机识别 / denied、restricted 没给语音识别的权限 /
//                            mic 没给麦克风 / audio 录音开不起来 / busy 正在弹权限框 / not-asked 还没问过权限（ask:false 时）/ cancelled 弹框时网页叫停了
//   speechStop(id)           停（网页判断说完了、对上答案了、孩子点了停）：ok {stopped: true / false}
//   事件 echo-speech         {sid: speechStart 的编号, kind, t: 开始以后几毫秒, …}：
//                            partial / final {text}（到目前为止听到的整句）、voice {on}（开始 / 停止出声，只在变的时候发）、
//                            error {code, message}、end {reason: stop / final / error / interrupted / background / audio-changed / audio-reset / page / replaced}
// 规矩（老板 11-20 定的）：
//   · 只在手机上识别（requiresOnDeviceRecognition = true），**不退回苹果的服务器识别**：这台手机不支持就回 unavailable，网页改走云端。
//   · 打分要诚实：识别不知道这道题的答案——不设 contextualStrings、不用自定义语言模型。识别只管听写，打分还是网页的 scoreSpeech()。
//     （以前试过让模型看着答案打分，读错的也给过。）
//   · 什么时候算说完由网页定（文字停住不变的计时 + 这里的出声 / 不出声），这里不等苹果的「最终结果」（它要等很久）。
//   · 声音自己用 AVAudioEngine 录，网页不另开麦克风。声音会话还是 AppAudio 那一套（边录边放 + 默认扬声器 + 模式 default，不用 measurement / voiceChat），
//     停了也不关会话：接着放的配乐、朗读照样从扬声器出来、音量不变。网页那一层在听的时候也说「边录边放」（echo-native.js 的 __echoIOS.speech）。
//   · 来电 / Siri 打断、切到后台、声音设备变了（插拔耳机）、网页重建：当场停，发 end。
// 识别引擎（SpeechEngine）单独一层：现在是 SFSpeechRecognizer；以后换 iOS 26 的 SpeechAnalyzer / SpeechTranscriber，
// 只要再写一个 SpeechEngine，权限顺序、录音、事件、计时都不用动。

// 常数（不归哪个线程管）
enum SpeechConst {
    static let locale = "en-US"
    static let locales = ["en-US", "en-GB", "en-AU"]       // 网页可以要的；别的一律按 en-US
    static let tapFrames: AVAudioFrameCount = 1024
}

// speechStart 的选项
struct SpeechOpts: Sendable {
    var short = false
    var long = false
    var ask = true
    var locale = SpeechConst.locale
}

// 收声音的那一头：在录音线程上调（AVAudioEngine 的 tap），不能碰主线程上的东西
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

// 识别引擎：权限、能不能用、开始 / 收尾。录音、计时、事件在 LocalSpeech 里
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
    // 不再有声音了（录音停了）
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

    // 录音线程上：声音交给识别
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
// 只在录音线程上用（AVAudioEngine 的 tap 一次只调一个），变的时候才告诉主线程
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

// 弱引用的小盒子：录音线程的回调里拿着它，回到主线程再看 LocalSpeech 还在不在
final class WeakSpeech: @unchecked Sendable {
    weak var v: LocalSpeech?
    init(_ v: LocalSpeech) { self.v = v }
}

// ---------- 给原生桥的那一层：权限顺序、录音、事件 ----------
@MainActor
final class LocalSpeech {
    typealias Reply = @MainActor @Sendable (_ ok: Bool, _ body: [String: Any]) -> Void

    // 正在听的那一次
    private final class Running {
        let sid: Int
        let audio: AVAudioEngine
        let t0: Date
        init(sid: Int, audio: AVAudioEngine, t0: Date) { self.sid = sid; self.audio = audio; self.t0 = t0 }
    }

    private let engine: SpeechEngine
    private let onEvent: @MainActor ([String: Any]) -> Void
    private var cur: Running?
    private var asking = 0                               // 正在弹权限框的那一次（网页给的编号），0 = 没有
    private var askStopped = false                       // 弹框的时候网页叫停了
    private var observers: [NSObjectProtocol] = []
    private var configObserver: NSObjectProtocol?

    init(engine: SpeechEngine, onEvent: @escaping @MainActor ([String: Any]) -> Void) {
        self.engine = engine
        self.onEvent = onEvent
        let nc = NotificationCenter.default
        // 来电、闹钟、Siri 打断声音：当场停（打断结束以后 GameViewController 会把声音会话接上）
        observers.append(nc.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            let type = (note.userInfo?[AVAudioSessionInterruptionTypeKey] as? NSNumber)?.uintValue ?? 0
            guard type == AVAudioSession.InterruptionType.began.rawValue else { return }
            MainActor.assumeIsolated { _ = self?.stop(reason: "interrupted") }
        })
        observers.append(nc.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { _ = self?.stop(reason: "audio-reset") }
        })
        // 切到后台：不在后台录音
        observers.append(nc.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
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
        return o
    }

    nonisolated static func ms(_ since: Date) -> Int {
        return max(0, Int((Date().timeIntervalSince(since) * 1000).rounded()))
    }

    // 录音线程上：声音交给识别，再量一下有没有在出声
    nonisolated static func tap(_ sink: @escaping SpeechSink, _ meter: VoiceMeter) -> AVAudioNodeTapBlock {
        return { buf, _ in
            sink(buf)
            meter.feed(buf)
        }
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
        step(sid: sid, o: o, t0: Date(), asked: [], reply: reply)
    }

    // 权限一步步来：语音识别 → 麦克风 → 开始录。要弹框的那一步弹完再回到这里（asked：这一次已经弹过哪几个框，同一个框不弹第二次）
    private func step(sid: Int, o: SpeechOpts, t0: Date, asked: Set<String>, reply: @escaping Reply) {
        switch engine.authorization() {
        case "authorized":
            break
        case "notDetermined":
            let done = asked.contains("speech")
            if !o.ask || done { reply(false, LocalSpeech.fail(done ? "denied" : "not-asked", "speech recognition permission has not been given")); return }
            asking = sid
            askStopped = false
            let next = asked.union(["speech"])
            engine.requestAuthorization { [weak self] in self?.resume(sid: sid, o: o, t0: t0, asked: next, reply: reply) }
            return
        case "restricted":
            reply(false, LocalSpeech.fail("restricted", "speech recognition is restricted on this device"))
            return
        default:
            reply(false, LocalSpeech.fail("denied", "speech recognition permission was denied"))
            return
        }
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            break
        case .notDetermined:
            let done = asked.contains("mic")
            if !o.ask || done { reply(false, LocalSpeech.fail(done ? "mic" : "not-asked", "microphone permission has not been given")); return }
            asking = sid
            askStopped = false
            let next = asked.union(["mic"])
            AVCaptureDevice.requestAccess(for: .audio, completionHandler: LocalSpeech.micAsked { [weak self] in self?.resume(sid: sid, o: o, t0: t0, asked: next, reply: reply) })
            return
        default:
            reply(false, LocalSpeech.fail("mic", "microphone permission was denied"))
            return
        }
        begin(sid: sid, o: o, t0: t0, reply: reply)
    }

    nonisolated static func micAsked(_ done: @escaping @MainActor @Sendable () -> Void) -> @Sendable (Bool) -> Void {
        return { _ in LocalSpeech.onMain(done) }
    }

    // 权限框答完了：网页这期间叫停了就不开；不然再看一遍权限（这一次不再弹框）
    private func resume(sid: Int, o: SpeechOpts, t0: Date, asked: Set<String>, reply: @escaping Reply) {
        guard asking == sid else { return }
        asking = 0
        if askStopped {
            askStopped = false
            reply(false, LocalSpeech.fail("cancelled", "stopped while asking for permission"))
            return
        }
        step(sid: sid, o: o, t0: t0, asked: asked, reply: reply)
    }

    private func begin(sid: Int, o: SpeechOpts, t0: Date, reply: @escaping Reply) {
        if UIApplication.shared.applicationState == .background {
            reply(false, LocalSpeech.fail("audio", "the app is in the background"))
            return
        }
        // 声音会话：边录边放 + 默认扬声器（AppAudio 一开 App 就这样设了；WebKit 放过声音以后可能改过，这里再设一次）
        AppAudio.configure()
        let audio = AVAudioEngine()
        let input = audio.inputNode
        let fmt = input.outputFormat(forBus: 0)
        guard fmt.sampleRate > 0, fmt.channelCount > 0 else {
            reply(false, LocalSpeech.fail("audio", "no audio input (sample rate \(fmt.sampleRate), \(fmt.channelCount) channels)"))
            return
        }
        let r = engine.begin(locale: o.locale, short: o.short,
                             onText: { [weak self] text, isFinal in self?.heard(sid, text, isFinal) },
                             onError: { [weak self] code, message in self?.failed(sid, code, message) })
        guard let sink = r.sink else {
            reply(false, LocalSpeech.fail(r.error.isEmpty ? "unavailable" : r.error, r.message))
            return
        }
        let me = WeakSpeech(self)                        // 录音线程那边只拿一个弱引用（录音停了 tap 就扔了）
        let meter = VoiceMeter { on in LocalSpeech.onMain { me.v?.voice(sid, on) } }
        input.installTap(onBus: 0, bufferSize: SpeechConst.tapFrames, format: fmt, block: LocalSpeech.tap(sink, meter))
        audio.prepare()
        do {
            try audio.start()
        } catch {
            input.removeTap(onBus: 0)
            engine.cancel()
            reply(false, LocalSpeech.fail("audio", String(describing: error)))
            return
        }
        cur = Running(sid: sid, audio: audio, t0: t0)
        // 声音设备变了（插拔耳机、蓝牙连上断开、别的 App 抢了声音）：AVAudioEngine 自己会停，这里收尾告诉网页
        configObserver = NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: audio, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { _ = self?.stop(sid: sid, reason: "audio-changed") }
        }
        reply(true, ["listening": true, "sid": sid, "ms": LocalSpeech.ms(t0), "locale": o.locale, "short": o.short, "engine": engine.name])
    }

    private func heard(_ sid: Int, _ text: String, _ isFinal: Bool) {
        guard let run = cur, run.sid == sid else { return }
        emit(["sid": sid, "kind": isFinal ? "final" : "partial", "text": text, "t": LocalSpeech.ms(run.t0)])
        if isFinal { stop(sid: sid, reason: "final") }
    }

    private func failed(_ sid: Int, _ code: String, _ message: String) {
        guard let run = cur, run.sid == sid else { return }      // 自己叫停以后的「被取消」不算
        emit(["sid": sid, "kind": "error", "code": code, "message": message, "t": LocalSpeech.ms(run.t0)])
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

    // 停下这一次：先停录音，再收尾识别，最后告诉网页 end。声音会话不关（AppAudio 一直开着，接着放的声音照样从扬声器出来）
    @discardableResult
    private func stop(sid: Int, reason: String) -> Bool {
        guard let run = cur, run.sid == sid else { return false }
        cur = nil
        if let o = configObserver { NotificationCenter.default.removeObserver(o); configObserver = nil }
        run.audio.inputNode.removeTap(onBus: 0)
        run.audio.stop()
        engine.end()
        engine.cancel()
        emit(["sid": sid, "kind": "end", "reason": reason, "t": LocalSpeech.ms(run.t0)])
        return true
    }

    var listening: Bool { return cur != nil }
}

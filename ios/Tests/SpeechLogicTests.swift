import XCTest
import AVFoundation
@testable import EchoIsland

// 口语题的本机识别（LocalSpeech.swift）里不碰真识别、不弹权限框的那一层：选项、网页送来的 PCM 怎么换、speechFeed 的流程、
// 出声 / 不出声、权限的顺序、回给网页的话。
// 真的识别准不准、快不快、权限框，要在真 iPhone 上看（云上的模拟器多半没有本机识别）。

// 回给网页的话、发给网页的事件记在这里（回调都在主线程上）
@MainActor
private final class Got {
    var replies: [(Bool, [String: Any])] = []
    var events: [[String: Any]] = []
}

// 出声 / 不出声的回调在录音线程上：加锁记下来
private final class Flips: @unchecked Sendable {
    private let lock = NSLock()
    private var items: [Bool] = []
    func add(_ v: Bool) { lock.lock(); items.append(v); lock.unlock() }
    var all: [Bool] { lock.lock(); defer { lock.unlock() }; return items }
}

// 假引擎收到的声音（每段的样本数、采样率、第一个样本）：加锁记下来
private final class Fed: @unchecked Sendable {
    private let lock = NSLock()
    private var items: [(Int, Double, Float)] = []
    func add(_ b: AVAudioPCMBuffer) { lock.lock(); items.append((Int(b.frameLength), b.format.sampleRate, b.floatChannelData?[0][0] ?? 0)); lock.unlock() }
    var all: [(Int, Double, Float)] { lock.lock(); defer { lock.unlock() }; return items }
}

// 假引擎：权限、能不能用由测试定；问权限时当场答完（答完以后权限没变 = 没给）。
// listens = false：开不起来（回 unavailable）；true：开起来，收到的声音记在 fed 里，onText / onError 留给测试调
@MainActor
private final class FakeEngine: SpeechEngine {
    let name = "fake"
    var auth = "authorized"
    var onDevice = true
    var available = true
    var listens = false
    var asked = 0
    var began = 0
    var ended = 0
    let fed = Fed()
    var text: SpeechText?
    var error: SpeechError?
    func authorization() -> String { return auth }
    func requestAuthorization(_ done: @escaping @MainActor @Sendable () -> Void) { asked += 1; done() }
    func check(locale: String) -> (onDevice: Bool, available: Bool) { return (onDevice, available) }
    func begin(locale: String, short: Bool, onText: @escaping SpeechText, onError: @escaping SpeechError) -> SpeechBegin {
        began += 1
        if !listens { return SpeechBegin(sink: nil, error: "unavailable", message: "fake engine does not listen") }
        text = onText
        error = onError
        let box = fed
        return SpeechBegin(sink: { buf in box.add(buf) }, error: "", message: "")
    }
    func end() { ended += 1 }
    func cancel() {}
}

// n 个 16 位小端样本 → base64（网页 talk.js 的 pcm16 + u8b64 一样的格式）
private func pcmB64(_ samples: [Int16]) -> String {
    var d = Data()
    for s in samples { let u = UInt16(bitPattern: s); d.append(UInt8(u & 0xff)); d.append(UInt8(u >> 8)) }
    return d.base64EncodedString()
}

final class SpeechLogicTests: XCTestCase {
    // speechStart 的选项：读不懂就用默认的；只认英语的几个地区
    func testOptions() {
        let d = LocalSpeech.opts("")
        XCTAssertFalse(d.short); XCTAssertFalse(d.long); XCTAssertTrue(d.ask); XCTAssertEqual(d.locale, "en-US")
        let o = LocalSpeech.opts(#"{"short":true,"long":false,"ask":false,"locale":"en-GB"}"#)
        XCTAssertTrue(o.short); XCTAssertFalse(o.long); XCTAssertFalse(o.ask); XCTAssertEqual(o.locale, "en-GB")
        XCTAssertEqual(LocalSpeech.opts(#"{"locale":"zh-CN"}"#).locale, "en-US", "只认英语的几个")
        XCTAssertEqual(LocalSpeech.opts("not json").locale, "en-US")
        XCTAssertEqual(LocalSpeech.fail("busy", "x")["error"] as? String, "busy")
        // 送来的声音的采样率：默认 16k，只认 8k–48k
        XCTAssertEqual(d.rate, 16000)
        XCTAssertEqual(LocalSpeech.opts(#"{"rate":44100}"#).rate, 44100)
        XCTAssertEqual(LocalSpeech.opts(#"{"rate":1000}"#).rate, 16000)
        XCTAssertEqual(LocalSpeech.opts(#"{"rate":"16000"}"#).rate, 16000)
    }

    // 网页送来的一段声音（base64 的 16 位有符号小端单声道 PCM）→ 32 位浮点、单声道、不交错的 AVAudioPCMBuffer
    func testPcmBuffer() throws {
        let b = try XCTUnwrap(LocalSpeech.pcmBuffer(pcmB64([16384, -32768, 0, 32767, 1, -1]), rate: 16000))
        XCTAssertEqual(b.frameLength, 6, "样本数 = 字节数 / 2")
        XCTAssertEqual(b.format.sampleRate, 16000)
        XCTAssertEqual(b.format.channelCount, 1)
        XCTAssertEqual(b.format.commonFormat, .pcmFormatFloat32)
        XCTAssertFalse(b.format.isInterleaved)
        let p = try XCTUnwrap(b.floatChannelData)[0]
        XCTAssertEqual(p[0], 0.5, accuracy: 0.00001, "16384 → 0.5（小端：低字节在前）")
        XCTAssertEqual(p[1], -1.0, accuracy: 0.00001)
        XCTAssertEqual(p[2], 0)
        XCTAssertEqual(p[3], 32767.0 / 32768.0, accuracy: 0.00001)
        XCTAssertEqual(p[5], -1.0 / 32768.0, accuracy: 0.0000001)
        // 0.1 秒 16kHz 的一段（网页一次送的大小）
        let tenth = try XCTUnwrap(LocalSpeech.pcmBuffer(pcmB64([Int16](repeating: 1000, count: 1600)), rate: 16000))
        XCTAssertEqual(tenth.frameLength, 1600)
        XCTAssertEqual(try XCTUnwrap(LocalSpeech.pcmBuffer(pcmB64([1, 2]), rate: 44100)).format.sampleRate, 44100)
        // 解不开、空的、半个样本：不要
        XCTAssertNil(LocalSpeech.pcmBuffer("not base64!!", rate: 16000))
        XCTAssertNil(LocalSpeech.pcmBuffer("", rate: 16000))
        XCTAssertNil(LocalSpeech.pcmBuffer(Data([1, 2, 3]).base64EncodedString(), rate: 16000))
        XCTAssertNil(LocalSpeech.pcmBuffer(pcmB64([1, 2]), rate: 0))
    }

    // speechStart → 识别任务建好就回 ok → speechFeed 的每段交给识别（编号不对、停了以后的不管）→ 出声事件 → 字 → speechStop 发 end（带 fed）
    @MainActor
    func testFeedFlow() {
        let got = Got()
        let eng = FakeEngine()
        eng.listens = true
        let s = LocalSpeech(engine: eng) { got.events.append($0) }
        let reply: LocalSpeech.Reply = { ok, body in got.replies.append((ok, body)) }
        s.feed(sid: 7, b64: pcmB64([1000, 1000]))
        XCTAssertTrue(eng.fed.all.isEmpty, "还没开始：不管")
        s.start(sid: 7, opts: #"{"short":true,"rate":16000}"#, reply: reply)
        XCTAssertEqual(got.replies.count, 1)
        XCTAssertEqual(got.replies.last?.0, true, "识别任务建好了就回 ok（不录音、不等声音）")
        XCTAssertEqual(got.replies.last?.1["sid"] as? Int, 7)
        XCTAssertTrue(s.listening)
        let loud = pcmB64([Int16](repeating: 3000, count: 1600))       // 约 0.09 均方根：在出声
        let quiet = pcmB64([Int16](repeating: 0, count: 1600))
        s.feed(sid: 7, b64: loud)
        s.feed(sid: 8, b64: loud)                                      // 编号不对：不管
        s.feed(sid: 7, b64: "@@not base64@@")                          // 解不开：不管
        s.feed(sid: 7, b64: quiet)
        s.feed(sid: 7, b64: quiet)
        s.feed(sid: 7, b64: quiet)
        XCTAssertEqual(eng.fed.all.count, 4, "收下 4 段")
        XCTAssertTrue(eng.fed.all.allSatisfy { $0.0 == 1600 && $0.1 == 16000 })
        XCTAssertEqual(eng.fed.all[0].2, 3000.0 / 32768.0, accuracy: 0.00001)
        let voices = got.events.filter { $0["kind"] as? String == "voice" }.map { $0["on"] as? Bool ?? false }
        XCTAssertEqual(voices, [true, false], "出声了 → 停够 0.25 秒：不出声了（只在变的时候发）")
        eng.text?("hello", false)
        XCTAssertEqual(got.events.last?["kind"] as? String, "partial")
        XCTAssertEqual(got.events.last?["text"] as? String, "hello")
        XCTAssertTrue(s.stop(reason: "stop"))
        XCTAssertEqual(eng.ended, 1, "停了：告诉识别没有声音了")
        let end = got.events.last ?? [:]
        XCTAssertEqual(end["kind"] as? String, "end")
        XCTAssertEqual(end["reason"] as? String, "stop")
        XCTAssertEqual(end["fed"] as? Int, 4, "end 带着收到几段声音（版本角标显示）")
        s.feed(sid: 7, b64: loud)
        XCTAssertEqual(eng.fed.all.count, 4, "停了以后送来的：不管")
        XCTAssertFalse(s.stop(reason: "stop"))
        // 识别出错：发 error（带 fed）再发 end
        s.start(sid: 9, opts: "{}", reply: reply)
        s.feed(sid: 9, b64: quiet)
        eng.error?("kAFAssistantErrorDomain 1101", "no model")
        let kinds = got.events.suffix(2).map { $0["kind"] as? String ?? "" }
        XCTAssertEqual(kinds, ["error", "end"])
        XCTAssertEqual(got.events.suffix(2).first?["fed"] as? Int, 1)
        XCTAssertFalse(s.listening)
    }

    func testAuthNames() {
        XCTAssertEqual(AppleSpeechEngine.authName(.authorized), "authorized")
        XCTAssertEqual(AppleSpeechEngine.authName(.notDetermined), "notDetermined")
        XCTAssertEqual(AppleSpeechEngine.authName(.denied), "denied")
        XCTAssertEqual(AppleSpeechEngine.authName(.restricted), "restricted")
    }

    // 出声 / 不出声：响了马上算出声；不响 0.25 秒以上才算停（字和字之间的小停顿不算）；只在变的时候告诉一次
    func testVoiceMeter() {
        let box = Flips()
        let m = VoiceMeter { on in box.add(on) }
        m.level(0.001, seconds: 0.1)
        m.level(0.05, seconds: 0.1)
        m.level(0.06, seconds: 0.1)
        m.level(0.001, seconds: 0.1)
        m.level(0.04, seconds: 0.05)     // 小停顿以后又出声：不算停
        m.level(0.001, seconds: 0.1)
        m.level(0.001, seconds: 0.1)
        XCTAssertEqual(box.all, [true], "0.2 秒的停顿还不算停")
        m.level(0.001, seconds: 0.1)
        XCTAssertEqual(box.all, [true, false], "停够 0.25 秒：不出声了")
        m.level(0.001, seconds: 0.5)
        XCTAssertEqual(box.all, [true, false], "已经停了：不再告诉")
    }

    func testRms() throws {
        let f = try XCTUnwrap(AVAudioFormat(standardFormatWithSampleRate: 16000, channels: 1))
        let b = try XCTUnwrap(AVAudioPCMBuffer(pcmFormat: f, frameCapacity: 160))
        b.frameLength = 160
        let p = try XCTUnwrap(b.floatChannelData)[0]
        for i in 0..<160 { p[i] = i % 2 == 0 ? 0.1 : -0.1 }
        XCTAssertEqual(VoiceMeter.rms(b), 0.1, accuracy: 0.0001)
    }

    // 权限的顺序（用假引擎，不弹框）：没有本机识别连权限都不问；被拒 / 受限当场回；ask:false 不弹；问了也没给 → denied，只问一次
    @MainActor
    func testPermissionOrderWithoutPrompts() {
        let got = Got()
        let eng = FakeEngine()
        let s = LocalSpeech(engine: eng) { got.events.append($0) }
        let reply: LocalSpeech.Reply = { ok, body in got.replies.append((ok, body)) }
        eng.onDevice = false
        s.start(sid: 1, opts: "{}", reply: reply)
        XCTAssertEqual(got.replies.last?.1["error"] as? String, "unavailable", "这台手机没有本机识别：网页改走云端")
        XCTAssertEqual(eng.asked, 0, "没有本机识别：权限框都不弹")
        eng.onDevice = true
        eng.auth = "denied"
        s.start(sid: 2, opts: "{}", reply: reply)
        XCTAssertEqual(got.replies.last?.1["error"] as? String, "denied")
        eng.auth = "restricted"
        s.start(sid: 3, opts: "{}", reply: reply)
        XCTAssertEqual(got.replies.last?.1["error"] as? String, "restricted")
        eng.auth = "notDetermined"
        s.start(sid: 4, opts: #"{"ask":false}"#, reply: reply)
        XCTAssertEqual(got.replies.last?.1["error"] as? String, "not-asked")
        XCTAssertEqual(eng.asked, 0, "ask:false：不弹框")
        s.start(sid: 5, opts: "{}", reply: reply)
        XCTAssertEqual(got.replies.last?.1["error"] as? String, "denied", "问了也没给")
        XCTAssertEqual(eng.asked, 1, "只问一次")
        // 语音识别给了：直接开引擎（麦克风是网页的事，这里不问）；假引擎开不起来 → unavailable
        eng.auth = "authorized"
        s.start(sid: 6, opts: #"{"ask":false}"#, reply: reply)
        let last = got.replies.last?.1["error"] as? String ?? ""
        XCTAssertEqual(last, "unavailable", "回的是网页认得的原因：" + last)
        XCTAssertEqual(eng.began, 1)
        XCTAssertEqual(got.replies.count, 6, "每次都回了（当场）")
        XCTAssertFalse(got.replies.contains { $0.0 }, "都没开起来")
        XCTAssertFalse(s.listening)
        XCTAssertFalse(s.stop(reason: "stop"), "没在听：stop 回 false")
        XCTAssertTrue(got.events.isEmpty, "没开起来就没有 echo-speech 事件")
        let st = s.state()
        XCTAssertEqual(st["engine"] as? String, "fake")
        XCTAssertEqual(st["locale"] as? String, "en-US")
        XCTAssertEqual(st["listening"] as? Bool, false)
        XCTAssertEqual(st["onDevice"] as? Bool, true)
    }

    // 真的 SFSpeechRecognizer：只问状态（不弹框），形状对；模拟器上有没有本机识别只记下来
    @MainActor
    func testRealEngineStateDoesNotPrompt() {
        let s = LocalSpeech(engine: AppleSpeechEngine()) { _ in }
        let st = s.state()
        XCTAssertTrue(["authorized", "notDetermined", "denied", "restricted"].contains(st["auth"] as? String ?? ""))
        XCTAssertNotNil(st["onDevice"] as? Bool)
        XCTAssertEqual(st["engine"] as? String, "SFSpeechRecognizer")
        print("EchoIsland tests: on-device speech on this simulator: \(st["onDevice"] ?? "?"), available: \(st["available"] ?? "?"), auth: \(st["auth"] ?? "?")")
    }
}

import XCTest
import AVFoundation
@testable import EchoIsland

// 口语题的本机识别（LocalSpeech.swift）里不碰真识别、不弹权限框的那一层：选项、出声 / 不出声、权限的顺序、回给网页的话。
// 真的识别准不准、快不快、权限框、问完以后声音从哪里出来，要在真 iPhone 上看（云上的模拟器多半没有本机识别）。

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

// 假引擎：权限、能不能用由测试定；问权限时当场答完（答完以后权限没变 = 没给）；开始时不真的识别
@MainActor
private final class FakeEngine: SpeechEngine {
    let name = "fake"
    var auth = "authorized"
    var onDevice = true
    var available = true
    var asked = 0
    var began = 0
    func authorization() -> String { return auth }
    func requestAuthorization(_ done: @escaping @MainActor @Sendable () -> Void) { asked += 1; done() }
    func check(locale: String) -> (onDevice: Bool, available: Bool) { return (onDevice, available) }
    func begin(locale: String, short: Bool, onText: @escaping SpeechText, onError: @escaping SpeechError) -> SpeechBegin {
        began += 1
        return SpeechBegin(sink: nil, error: "unavailable", message: "fake engine does not listen")
    }
    func end() {}
    func cancel() {}
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
        XCTAssertEqual(LocalSpeech.fail("mic", "x")["error"] as? String, "mic")
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
        // 语音识别给了：到麦克风那一步，或者开引擎（假引擎开不起来）——模拟器上麦克风的状态不一定，回的要是网页认得的
        eng.auth = "authorized"
        s.start(sid: 6, opts: #"{"ask":false}"#, reply: reply)
        let last = got.replies.last?.1["error"] as? String ?? ""
        XCTAssertTrue(["not-asked", "mic", "unavailable", "audio"].contains(last), "回的是网页认得的原因：" + last)
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

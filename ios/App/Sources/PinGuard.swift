import Foundation
import CryptoKit

// 家长密码的检查和「连续错 5 次锁 10 分钟」。和 android/…/PinGuard.java 一条一条对着写的，纯逻辑、不碰界面
// （ios/Tests/PinGuardTests.swift 在模拟器里跑，tests/ios.test.js 在电脑上核对常量和算法）。
// 密码从哪来（原文都不进 App、不存原文）：
// - 家庭版：打包时 ios/scripts/make-config.mjs 算出「盐 + 密码」的 SHA-256（BuildConfig.parentPinHash）；
// - 销售版（公开发的版本）：App 里没有（哈希是空的），家长在首次设置向导里设，set() 用这台手机自己的随机盐算哈希，存在原生（UserDefaults）。
//   打包时带了密码的 App 不许在手机上改（set 一律 false）。
// 输错的次数和锁定时间存在原生，网页改不了。

// 存状态的地方（手机上是 UserDefaults）。putLongs / putStrs 一次写完
protocol PinStore: AnyObject {
    func getLong(_ k: String, _ d: Int64) -> Int64
    func putLongs(_ keys: [String], _ vals: [Int64])
    func getStr(_ k: String, _ d: String) -> String
    func putStrs(_ keys: [String], _ vals: [String])
}

// 时间：wall 手机时钟（毫秒）；elapsed 开机以来的毫秒数（改手机时钟没用，睡着也照走）；boot 这是哪一次开机（拿不到就 -1）
protocol PinClock: AnyObject {
    func wall() -> Int64
    func elapsed() -> Int64
    func boot() -> Int64
}

final class PinGuard {
    static let TRIES: Int64 = 5                        // 连续错几次就锁
    static let LOCK_MS: Int64 = 10 * 60 * 1000         // 锁多久
    static let CHANGE_MS: Int64 = 2 * 60 * 1000        // 输对以后多久之内可以改密码
    static let SALT_V2 = "echo-island-parent-pin-v2:"  // 手机上设的密码：这个前缀 + 16 个随机字节

    private let salt: String
    private let hash: String
    private let st: PinStore
    private let ck: PinClock
    private let allowSet: Bool                         // 能不能在手机上设密码（只有销售版能）
    private var okAt: Int64 = -1                       // 最近一次输对的时间（开机以来的毫秒），只在内存里：重开 App 就要重新输
    private var okBoot: Int64 = -2

    init(salt: String, hash: String, store: PinStore, clock: PinClock, allowSet: Bool = false) {
        self.salt = salt
        self.hash = hash.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        self.st = store
        self.ck = clock
        self.allowSet = allowSet
    }

    // 打包时带了家长密码（家庭版）
    func baked() -> Bool { return hash.count == 64 }
    // 打包时带了的就只认打包的；不许在手机上设的版本从来不认手机上存的
    private func activeSalt() -> String { return baked() || !allowSet ? salt : st.getStr("pinSalt", "") }
    private func activeHash() -> String {
        return baked() || !allowSet ? hash : st.getStr("pinHash", "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    // 有没有家长密码：打包时带的，或者手机上设过的
    func has() -> Bool { return activeHash().count == 64 }

    // 「盐 + 密码」按 UTF-8 算 SHA-256，64 位小写十六进制（和 build.gradle、make-config.mjs 一样）
    static func sha256Hex(_ s: String) -> String {
        let digest = SHA256.hash(data: Data(s.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    // 两个字符串比对：不提前退出（和 Java 的 MessageDigest.isEqual 一个意思）
    private static func sameText(_ a: String, _ b: String) -> Bool {
        let x = Array(a.utf8), y = Array(b.utf8)
        if x.count != y.count { return false }
        var diff: UInt8 = 0
        for i in 0..<x.count { diff |= x[i] ^ y[i] }
        return diff == 0
    }

    private static func fourDigits(_ p: String) -> Bool {
        return p.count == 4 && p.allSatisfy { $0.isASCII && $0.isNumber }
    }

    // 还要锁多少毫秒（0 = 没锁）。同一次开机用「开机以来的时间」算，把手机时钟往后调也解不开；
    // 重启过就只能看手机时钟（时钟被往回调了，最多也只锁 10 分钟）
    func waitMs() -> Int64 {
        let until = st.getLong("pinLockWall", 0)
        if until == 0 { return 0 }
        let boot = ck.boot()
        let left: Int64
        if boot >= 0 && boot == st.getLong("pinLockBoot", -2) {
            left = st.getLong("pinLockElapsed", 0) - ck.elapsed()
        } else {
            left = until - ck.wall()
        }
        if left <= 0 {
            st.putLongs(["pinLockWall"], [0])
            return 0
        }
        return min(left, PinGuard.LOCK_MS)
    }

    // 对不对。没设密码、空的、锁着的时候一律 false（空的不算一次）；对了清零错的次数
    func check(_ pinIn: String?) -> Bool {
        let pin = (pinIn ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !has() || pin.isEmpty || waitMs() > 0 { return false }
        let ok = PinGuard.sameText(PinGuard.sha256Hex(activeSalt() + pin), activeHash())
        if ok {
            st.putLongs(["pinFails"], [0])
            okAt = ck.elapsed()
            okBoot = ck.boot()
            return true
        }
        okAt = -1
        let f = st.getLong("pinFails", 0) + 1
        if f >= PinGuard.TRIES {
            let w = ck.wall()
            st.putLongs(["pinFails", "pinLockWall", "pinLockElapsed", "pinLockBoot", "pinLockouts", "pinLastLock"],
                        [0, w + PinGuard.LOCK_MS, ck.elapsed() + PinGuard.LOCK_MS, ck.boot(), st.getLong("pinLockouts", 0) + 1, w])
        } else {
            st.putLongs(["pinFails"], [f])
        }
        return false
    }

    // 现在能不能在手机上设 / 改密码：打包时带了密码的、不许设的版本不行；还没有密码的可以（第一次设置）；
    // 已经有了的，要 2 分钟内刚输对过（同一次开机）
    func canSet() -> Bool {
        if !allowSet || baked() { return false }
        if !has() { return true }
        let now = ck.elapsed()
        return okAt >= 0 && okBoot == ck.boot() && now >= okAt && now - okAt <= PinGuard.CHANGE_MS
    }

    // 设 / 改密码（必须是 4 位数字）：每次换一个新的随机盐，只存哈希；错的次数、锁定清零
    func set(_ pinIn: String?) -> Bool {
        let pin = (pinIn ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !PinGuard.fourDigits(pin) || !canSet() { return false }
        var rng = SystemRandomNumberGenerator()
        var s = PinGuard.SALT_V2
        for _ in 0..<16 { s += String(format: "%02x", UInt8.random(in: 0...255, using: &rng)) }
        let h = PinGuard.sha256Hex(s + pin)
        if h.count != 64 { return false }
        st.putStrs(["pinSalt", "pinHash"], [s, h])
        st.putLongs(["pinFails", "pinLockWall"], [0, 0])
        okAt = -1
        return activeHash() == h
    }

    func triesLeft() -> Int64 {
        return waitMs() > 0 ? 0 : max(0, PinGuard.TRIES - st.getLong("pinFails", 0))
    }

    // 给网页的状态：{"has":true,"locked":false,"waitSec":0,"triesLeft":5,"lockouts":0,"lastLock":0,"canSet":false}
    // lockouts = 一共被锁过几次（周报用），lastLock = 最近一次被锁的时间（毫秒，0 = 没锁过），canSet = 现在能不能在手机上设 / 改密码
    func statusJson() -> String {
        let w = waitMs()
        return "{\"has\":\(has()),\"locked\":\(w > 0),\"waitSec\":\((w + 999) / 1000)" +
            ",\"triesLeft\":\(triesLeft()),\"lockouts\":\(st.getLong("pinLockouts", 0))" +
            ",\"lastLock\":\(st.getLong("pinLastLock", 0)),\"canSet\":\(canSet())}"
    }
}

// ---------- 手机上的实现 ----------

// 存在 UserDefaults 里（App 自己的私有空间，网页碰不到）
final class DefaultsPinStore: PinStore {
    private let d: UserDefaults
    init(_ defaults: UserDefaults = .standard) { d = defaults }

    func getLong(_ k: String, _ dflt: Int64) -> Int64 {
        guard let n = d.object(forKey: k) as? NSNumber else { return dflt }
        return n.int64Value
    }
    func putLongs(_ keys: [String], _ vals: [Int64]) {
        for i in 0..<min(keys.count, vals.count) { d.set(NSNumber(value: vals[i]), forKey: keys[i]) }
    }
    func getStr(_ k: String, _ dflt: String) -> String { return d.string(forKey: k) ?? dflt }
    func putStrs(_ keys: [String], _ vals: [String]) {
        for i in 0..<min(keys.count, vals.count) { d.set(vals[i], forKey: keys[i]) }
    }
}

final class SystemPinClock: PinClock {
    func wall() -> Int64 { return Int64(Date().timeIntervalSince1970 * 1000) }

    // 开机以来过了多久（手机睡着也照走，改手机时钟不影响）
    func elapsed() -> Int64 { return Int64(clock_gettime_nsec_np(CLOCK_MONOTONIC_RAW) / 1_000_000) }

    // 这是哪一次开机：系统每次开机换一个编号（kern.bootsessionuuid），折成一个正数。读不到就 -1（那就只能按手机时钟算）
    func boot() -> Int64 {
        var size = 0
        if sysctlbyname("kern.bootsessionuuid", nil, &size, nil, 0) != 0 || size <= 1 || size > 128 { return -1 }
        var buf = [CChar](repeating: 0, count: size)
        if sysctlbyname("kern.bootsessionuuid", &buf, &size, nil, 0) != 0 { return -1 }
        let id = String(cString: buf)
        if id.isEmpty { return -1 }
        var h: UInt64 = 0xcbf29ce484222325               // FNV-1a
        for b in id.utf8 { h = (h ^ UInt64(b)) &* 0x100000001b3 }
        return Int64(h & 0x7fffffffffffffff)
    }
}

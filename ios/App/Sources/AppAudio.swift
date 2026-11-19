import AVFoundation

// App 的声音会话（AVAudioSession）：一开始就设成「边录边放」——
//   · playAndRecord：随时能开麦克风（口语打分、和岛民聊天），开麦克风时不用切类别、不会卡一下；静音键关不掉它（配音、岛民说话照样出声）；
//   · defaultToSpeaker：没插耳机时从下面的扬声器出声（不然 playAndRecord 默认走听筒，声音很小）；
//   · 蓝牙：A2DP（只听的耳机、音箱）和 HFP（带麦克风的耳机，比如 AirPods 开口说话）都可以。
// 网页那一层（echo-native.js）另外用 navigator.audioSession 告诉 WebKit 平时是「播放」、开麦克风时是「边录边放」：
// WebKit 自己也会按网页在放什么改声音类别，两层是一个意思，谁后设都不会让声音变小或被静音键关掉。
// 来电、闹钟、Siri 打断声音以后：GameViewController 收到「打断结束」再调一次 configure()，并让网页把被打断的声音接上。
enum AppAudio {
    // 「允许蓝牙耳机的麦克风」（HFP）：老 SDK 里叫 allowBluetooth，iOS 26 的 SDK 改名叫 allowBluetoothHFP，值都是 0x4。
    // 直接用这个值，新老 Xcode 都能编译、不出过时警告
    static let bluetoothHFP = AVAudioSession.CategoryOptions(rawValue: 0x4)
    static let options: AVAudioSession.CategoryOptions = [.defaultToSpeaker, .allowBluetoothA2DP, bluetoothHFP]

    // 设好并打开。返回成没成（失败只记一行日志：声音由 WebKit 照它自己的默认来，游戏照样能玩）
    @discardableResult
    static func configure() -> Bool {
        let s = AVAudioSession.sharedInstance()
        do {
            try s.setCategory(.playAndRecord, mode: .default, options: options)
            try s.setActive(true)
            return true
        } catch {
            NSLog("EchoIsland: audio session setup failed: %@", String(describing: error))
            return false
        }
    }
}

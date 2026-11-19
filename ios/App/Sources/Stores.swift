import Foundation
import Security

// 百炼密钥：家长在手机上填的那把，放在钥匙串里（只在这台手机上、不进 iCloud、不跟着备份走），网页读不回来。
// 钥匙串里的东西删掉 App 也可能还在，所以每次全新安装第一次打开时先清一遍（Bridge 的 init）。
// 调试包在模拟器上钥匙串用不了时（没签名），退回存在 UserDefaults 里——只有调试包这样，正式包存不进钥匙串就是没存上。
enum KeyStore {
    private static let service = (Bundle.main.bundleIdentifier ?? "echo-island") + ".dashscope"
    private static let account = "key"
    private static let debugFallback = "debugKeyFallback"     // 只有调试包用：没签名的模拟器包钥匙串用不了时放这里

    private static func base() -> [String: Any] {
        return [kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: account]
    }

    static func read() -> String {
        var q = base()
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        if SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data, let s = String(data: d, encoding: .utf8) {
            return s
        }
        #if DEBUG
        return UserDefaults.standard.string(forKey: debugFallback) ?? ""
        #else
        return ""
        #endif
    }

    // 存（空字符串 = 清掉）。返回存没存上
    @discardableResult
    static func write(_ value: String) -> Bool {
        SecItemDelete(base() as CFDictionary)
        #if DEBUG
        UserDefaults.standard.removeObject(forKey: debugFallback)
        #endif
        if value.isEmpty { return true }
        var q = base()
        q[kSecValueData as String] = Data(value.utf8)
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        if SecItemAdd(q as CFDictionary, nil) == errSecSuccess { return true }
        #if DEBUG
        UserDefaults.standard.set(value, forKey: debugFallback)
        return true
        #else
        return false
        #endif
    }
}

// 存档备份：App 的「文稿」文件夹（在手机的「文件」App →「我的 iPhone」→「回声岛」里看得到、拷得走），
// echo-save-YYYYMMDD.json，同一天覆盖同一份，只留最新的 7 份（规则在 BackupNames）。
// 和安卓不一样的地方：安卓写在公共的「下载/EchoIsland」，卸载也不删；iPhone 上删掉 App 这个文件夹跟着没了
// （所以家长设置里的「导出存档」更要紧）。
final class BackupStore {
    static let pickMax = 32 * 1024 * 1024               // 读一份备份 / 从文件恢复：最大 32MB

    let dir: URL
    private let fm = FileManager.default

    init() {
        let m = FileManager.default
        let d = m.urls(for: .documentDirectory, in: .userDomainMask).first ?? m.temporaryDirectory
        try? m.createDirectory(at: d, withIntermediateDirectories: true)
        dir = d
    }

    // 今天 "20261007"（公历，不跟着手机的日历 / 语言设置变）
    static func today() -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyyMMdd"
        return f.string(from: Date())
    }

    func list() -> [BackupNames.Item] {
        let keys: [URLResourceKey] = [.fileSizeKey, .contentModificationDateKey, .isRegularFileKey]
        guard let files = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: keys, options: [.skipsHiddenFiles]) else { return [] }
        var out: [BackupNames.Item] = []
        for (i, f) in files.enumerated() {
            let name = f.lastPathComponent
            guard BackupNames.valid(name), let v = try? f.resourceValues(forKeys: Set(keys)), v.isRegularFile == true else { continue }
            let time = Int64((v.contentModificationDate ?? Date(timeIntervalSince1970: 0)).timeIntervalSince1970 * 1000)
            out.append(BackupNames.Item(id: Int64(i), name: name, size: Int64(v.fileSize ?? 0), time: time))
        }
        return out
    }

    // 写今天这一份（先写到临时文件再换上去，写到一半被杀也不会留下半份），再把多出来的旧备份删掉
    func write(_ json: String, excludeFromBackup: Bool) -> Bool {
        let name = BackupNames.forDay(BackupStore.today())
        var file = dir.appendingPathComponent(name, isDirectory: false)
        do {
            try Data(json.utf8).write(to: file, options: [.atomic])
        } catch {
            return false
        }
        if excludeFromBackup {
            var rv = URLResourceValues()
            rv.isExcludedFromBackup = true
            try? file.setResourceValues(rv)
        }
        for it in BackupNames.toDelete(list(), keepName: name) {
            try? fm.removeItem(at: dir.appendingPathComponent(it.name, isDirectory: false))
        }
        return true
    }

    func read(_ name: String?) -> String {
        guard let name = name, BackupNames.valid(name) else { return "" }
        let file = dir.appendingPathComponent(name, isDirectory: false)
        guard let size = (try? file.resourceValues(forKeys: [.fileSizeKey]))?.fileSize, size <= BackupStore.pickMax,
              let d = try? Data(contentsOf: file), let s = String(data: d, encoding: .utf8) else { return "" }
        return s
    }
}

import Foundation

// 存档备份的文件名规则：echo-save-YYYYMMDD.json，每天一份，只留最新的 7 份。
// 和 android/…/BackupNames.java 一条一条对着写的，纯逻辑（ios/Tests/BackupNamesTests.swift 在模拟器里跑）。
// 同一天可能有「echo-save-20261007 (1).json」：从别处拷进来的、系统加了编号的，照样认。
enum BackupNames {
    static let KEEP = 7

    // 一个备份文件：time 是修改时间（毫秒）
    struct Item: Equatable {
        let id: Int64
        let name: String
        let size: Int64
        let time: Int64
    }

    static func forDay(_ yyyymmdd: String) -> String { return "echo-save-" + yyyymmdd + ".json" }

    private static func digits(_ s: Substring) -> Bool {
        return !s.isEmpty && s.allSatisfy { $0.isASCII && $0.isNumber }
    }

    // 文件名里的日期 "20261007"；不合规就 nil。只认 echo-save-<8 位数字>.json 和 echo-save-<8 位数字> (<1–4 位数字>).json
    static func day(_ n: String?) -> String? {
        guard let n = n else { return nil }
        let pre = "echo-save-", suf = ".json"
        guard n.hasPrefix(pre), n.hasSuffix(suf), n.count >= pre.count + 8 + suf.count else { return nil }
        let mid = n.dropFirst(pre.count).dropLast(suf.count)
        let d = mid.prefix(8)
        guard d.count == 8, digits(d) else { return nil }
        let rest = mid.dropFirst(8)
        if rest.isEmpty { return String(d) }
        guard rest.hasPrefix(" ("), rest.hasSuffix(")"), rest.count >= 4 else { return nil }
        let num = rest.dropFirst(2).dropLast(1)
        guard num.count >= 1, num.count <= 4, digits(num) else { return nil }
        return String(d)
    }

    static func valid(_ n: String?) -> Bool { return day(n) != nil }

    // 新的在前：先比文件名里的日期，同一天再比修改时间
    static func sorted(_ items: [Item]) -> [Item] {
        return items.filter { valid($0.name) }.sorted { a, b in
            let da = day(a.name) ?? "", db = day(b.name) ?? ""
            if da != db { return da > db }
            return a.time > b.time
        }
    }

    // 要删掉哪些：新的留 KEEP 份，其余删。keepName（刚写的那份）永远不删、占一个名额
    // （手机日期被往后调过时，它不一定排在最前面）
    static func toDelete(_ items: [Item], keepName: String) -> [Item] {
        let all = sorted(items)
        let keepIn = all.contains { $0.name == keepName }
        var slots = keepIn ? KEEP - 1 : KEEP
        var del: [Item] = []
        for it in all {
            if keepIn && it.name == keepName { continue }
            if slots > 0 { slots -= 1; continue }
            del.append(it)
        }
        return del
    }

    // [{"name":"echo-save-20261007.json","date":"2026-10-07","size":12345,"time":1791234567890}, …]，新的在前
    static func listJson(_ items: [Item]) -> String {
        var parts: [String] = []
        for it in sorted(items) {
            let d = Array(day(it.name) ?? "00000000")
            let date = String(d[0..<4]) + "-" + String(d[4..<6]) + "-" + String(d[6..<8])
            parts.append("{\"name\":\"\(it.name)\",\"date\":\"\(date)\",\"size\":\(it.size),\"time\":\(it.time)}")
        }
        return "[" + parts.joined(separator: ",") + "]"
    }
}

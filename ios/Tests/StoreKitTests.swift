import XCTest
import StoreKit
import StoreKitTest
@testable import EchoIsland

// 订阅的真流程（StoreKit 2 + Xcode 的本地 App Store，App/Store.storekit）：商品、买、等家长批准、恢复、续费、过期、退款。
// 用的是 Store.swift 本身（和原生桥给网页的一样），不弹界面（disableDialogs）、不花钱、不连苹果。
// 云上单独一步跑（.github/workflows/ios-simulator.yml「StoreKit tests」）：iOS 26.5 的模拟器上 SKTestSession 存不进配置
// （苹果的已知问题，开发者论坛 FB22237318），所以那一步挑 26.2 / 26.1 的模拟器；别的单元测试那一步跳过这个类。
// 交易签名（jws）是 Xcode 本地证书签的：手机这边算核对过，服务器那边（只认 Apple Root CA）会拒，这是对的。

@MainActor
private final class Events {
    var items: [[String: Any]] = []
}

// JWS 中间那段（交易本身）解出来看：服务器看到的就是它
private func jwsPayload(_ jws: String) -> [String: Any] {
    let parts = jws.split(separator: ".")
    guard parts.count == 3 else { return [:] }
    var b = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
    while b.count % 4 != 0 { b += "=" }
    guard let d = Data(base64Encoded: b) else { return [:] }
    return (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] ?? [:]
}

final class StoreKitTests: XCTestCase {
    private let monthly = BuildConfig.iapMonthly
    private let yearly = BuildConfig.iapYearly

    // 每个测试一个干净的本地 App Store（Store.storekit 由 project.yml 放进测试包）
    @MainActor
    private func makeSession() throws -> SKTestSession {
        let url = try XCTUnwrap(Bundle(for: StoreKitTests.self).url(forResource: "Store", withExtension: "storekit"),
                                "Store.storekit 打包进了测试包（project.yml 的 EchoIslandTests）")
        let s = try SKTestSession(contentsOf: url)
        s.resetToDefaultState()
        s.disableDialogs = true
        s.clearTransactions()
        return s
    }

    // 等到条件成立（每 0.2 秒看一次），等不到就算没过
    @MainActor
    @discardableResult
    private func waitFor(_ what: String, seconds: Double = 20, _ ok: () async -> Bool) async -> Bool {
        let end = Date().addingTimeInterval(seconds)
        while Date() < end {
            if await ok() { return true }
            try? await Task.sleep(nanoseconds: 200_000_000)
        }
        XCTFail("等了 \(Int(seconds)) 秒还没到：" + what)
        return false
    }

    @MainActor
    private func buy(_ store: Store, _ id: String, _ token: UUID = UUID()) async -> StoreReply {
        return await store.buy(id, token: token.uuidString, confirmIn: nil)
    }

    // ---------- 商品 ----------

    @MainActor
    func testProductsLoad() async throws {
        let session = try makeSession()
        defer { session.clearTransactions() }
        let store = Store(monthly: monthly, yearly: yearly)
        let r = await store.products("")
        XCTAssertTrue(r.ok, r.json)
        let list = r.body["products"] as? [[String: Any]] ?? []
        XCTAssertEqual(list.map { $0["id"] as? String ?? "" }, [monthly, yearly], "空的 = 月度、年度两个，按这个顺序")
        let mo = list.first ?? [:], yr = list.last ?? [:]
        XCTAssertEqual(mo["kind"] as? String, "monthly"); XCTAssertEqual(yr["kind"] as? String, "yearly")
        XCTAssertTrue((mo["displayPrice"] as? String ?? "").contains("8.99"), "\(mo)")
        XCTAssertTrue((yr["displayPrice"] as? String ?? "").contains("59.99"), "\(yr)")
        XCTAssertEqual(mo["price"] as? String, "8.99"); XCTAssertEqual(mo["currency"] as? String, "USD")
        XCTAssertFalse((mo["title"] as? String ?? "").isEmpty)
        XCTAssertEqual((mo["period"] as? [String: Any])?["unit"] as? String, "month")
        XCTAssertEqual((yr["period"] as? [String: Any])?["unit"] as? String, "year")
        XCTAssertEqual(mo["groupId"] as? String, yr["groupId"] as? String, "两个在同一个订阅组（换档不会两份钱）")
        XCTAssertTrue(mo["introOffer"] is NSNull, "月度没有首次优惠")
        let intro = yr["introOffer"] as? [String: Any] ?? [:]
        XCTAssertEqual(intro["paymentMode"] as? String, "freeTrial", "年度的例子：7 天免费试用")
        let ip = intro["period"] as? [String: Any] ?? [:]
        let unit = ip["unit"] as? String, value = ip["value"] as? Int
        XCTAssertTrue((unit == "week" && value == 1) || (unit == "day" && value == 7), "\(ip)")
        XCTAssertEqual(yr["introEligible"] as? Bool, true, "没买过：能用首次优惠")
        XCTAssertEqual(yr["trial"] as? Bool, true)
        XCTAssertEqual(r.body["missing"] as? [String], [])
        let none = await store.products("com.echoisland.app.none")
        XCTAssertTrue(none.ok)
        XCTAssertEqual(none.body["missing"] as? [String], ["com.echoisland.app.none"], "App Store 里没有的写在 missing")
    }

    // ---------- 买：带着账号的 UUID，finish 要等网页说服务器存好了 ----------

    @MainActor
    func testBuyMonthlyCarriesTheAccountToken() async throws {
        let session = try makeSession()
        defer { session.clearTransactions() }
        let store = Store(monthly: monthly, yearly: yearly)
        let token = UUID()
        let r = await buy(store, monthly, token)
        XCTAssertTrue(r.ok, r.json)
        XCTAssertEqual(r.body["status"] as? String, "purchased")
        XCTAssertEqual(r.body["verified"] as? Bool, true)
        XCTAssertEqual(r.body["productId"] as? String, monthly)
        XCTAssertEqual(r.body["appAccountToken"] as? String, token.uuidString.lowercased())
        XCTAssertGreaterThan(r.body["expires"] as? Int64 ?? 0, Store.ms(Date()), "订阅有到期时间、在以后")
        print("EchoIsland StoreKit: environment = \(r.body["environment"] ?? "?")")
        let jws = r.body["jws"] as? String ?? ""
        XCTAssertEqual(jws.split(separator: ".").count, 3, "JWS 是三段")
        let p = jwsPayload(jws)
        XCTAssertEqual((p["appAccountToken"] as? String)?.lowercased(), token.uuidString.lowercased(), "服务器从 JWS 里看得到账号的 UUID")
        XCTAssertEqual(p["bundleId"] as? String, Bundle.main.bundleIdentifier)
        XCTAssertEqual(p["productId"] as? String, monthly)
        let tx = try XCTUnwrap(r.body["transactionId"] as? String)
        XCTAssertNotNil(UInt64(tx), "编号是数字写成的字符串")

        // 还没 finish：iapPending 列得出来（App 被杀了下次从这里补）
        var pend = await store.pending()
        XCTAssertTrue((pend.body["transactions"] as? [[String: Any]] ?? []).contains { $0["transactionId"] as? String == tx }, pend.json)
        // 网页说服务器存好了：finish；再来一次说没有这一笔（不算错）
        let f = await store.finish(tx)
        XCTAssertEqual(f.body["finished"] as? Bool, true, f.json)
        let again = await store.finish(tx)
        XCTAssertTrue(again.ok); XCTAssertEqual(again.body["finished"] as? Bool, false)
        pend = await store.pending()
        XCTAssertFalse((pend.body["transactions"] as? [[String: Any]] ?? []).contains { $0["transactionId"] as? String == tx })
        // 有效的订阅里有它
        let cur = await store.current()
        let ent = cur.body["entitlements"] as? [[String: Any]] ?? []
        XCTAssertTrue(ent.contains { $0["productId"] as? String == monthly && ($0["jws"] as? String ?? "").count > 100 }, cur.json)
    }

    // ---------- 请求购买（家长批准）：先回 pending，批准以后从 Transaction.updates 来 ----------

    @MainActor
    func testAskToBuyIsPendingThenArrivesAsAnEvent() async throws {
        let session = try makeSession()
        defer { session.clearTransactions() }
        session.askToBuyEnabled = true
        let store = Store(monthly: monthly, yearly: yearly)
        let events = Events()
        store.onEvent = { events.items.append($0) }
        store.start()
        defer { store.stop() }
        let token = UUID()
        let r = await buy(store, monthly, token)
        XCTAssertTrue(r.ok, r.json)
        XCTAssertEqual(r.body["status"] as? String, "pending", "要等家长批准")
        let waiting = session.allTransactions().first { $0.pendingAskToBuyConfirmation }
        try session.approveAskToBuyTransaction(identifier: try XCTUnwrap(waiting, "本地 App Store 里有一笔等批准的").identifier)
        await waitFor("家长批准以后，这一笔从 Transaction.updates 发给网页（echo-iap）") {
            events.items.contains { $0["productId"] as? String == self.monthly && $0["kind"] as? String == "purchase" }
        }
        let e = events.items.first { $0["productId"] as? String == monthly } ?? [:]
        XCTAssertEqual(e["appAccountToken"] as? String, token.uuidString.lowercased(), "批准以后还是这个账号的")
        XCTAssertEqual(e["verified"] as? Bool, true)
        if let tx = e["transactionId"] as? String { _ = await store.finish(tx) }
    }

    // ---------- 恢复购买 ----------

    @MainActor
    func testRestoreListsTheSubscription() async throws {
        let session = try makeSession()
        defer { session.clearTransactions() }
        let store = Store(monthly: monthly, yearly: yearly)
        let r = await buy(store, yearly)
        XCTAssertEqual(r.body["status"] as? String, "purchased", r.json)
        if let tx = r.body["transactionId"] as? String { _ = await store.finish(tx) }
        let back = await store.restore()
        XCTAssertTrue(back.ok, back.json)
        print("EchoIsland StoreKit: AppStore.sync() in the test store: synced = \(back.body["synced"] ?? "?") \(back.body["syncError"] ?? "")")
        let ent = back.body["entitlements"] as? [[String: Any]] ?? []
        XCTAssertTrue(ent.contains { $0["productId"] as? String == yearly }, "恢复以后列得出年度订阅：\(back.json)")
    }

    // ---------- 续费、过期（本地 App Store 的时间控制） ----------

    @MainActor
    func testRenewalThenExpiry() async throws {
        let session = try makeSession()
        defer { session.clearTransactions() }
        let store = Store(monthly: monthly, yearly: yearly)
        let events = Events()
        store.onEvent = { events.items.append($0) }
        store.start()
        defer { store.stop() }
        let r = await buy(store, monthly)
        XCTAssertEqual(r.body["status"] as? String, "purchased", r.json)
        let first = try XCTUnwrap(r.body["transactionId"] as? String), original = try XCTUnwrap(r.body["originalId"] as? String)
        _ = await store.finish(first)

        try session.forceRenewalOfSubscription(productIdentifier: monthly)
        await waitFor("续费的那一笔从 Transaction.updates 来") {
            events.items.contains { $0["originalId"] as? String == original && $0["transactionId"] as? String != first }
        }
        let renewal = events.items.first { $0["originalId"] as? String == original && $0["transactionId"] as? String != first } ?? [:]
        XCTAssertEqual(renewal["kind"] as? String, "renewal", "\(renewal)")
        let second = renewal["transactionId"] as? String ?? ""
        XCTAssertFalse((renewal["jws"] as? String ?? "").isEmpty, "续费的 jws 也交给服务器")
        if !second.isEmpty { _ = await store.finish(second) }
        await waitFor("有效的订阅换成续费的那一笔") {
            let ent = await store.entitlements()
            return ent.contains { $0["productId"] as? String == self.monthly && $0["transactionId"] as? String == second }
        }

        try session.expireSubscription(productIdentifier: monthly)
        await waitFor("过期以后不再算有效") {
            let ent = await store.entitlements()
            return !ent.contains { $0["productId"] as? String == self.monthly }
        }
    }

    // ---------- 退款（撤销）：从 Transaction.updates 来，kind = revoked ----------

    @MainActor
    func testRefundArrivesAsRevokedEvent() async throws {
        let session = try makeSession()
        defer { session.clearTransactions() }
        let store = Store(monthly: monthly, yearly: yearly)
        let events = Events()
        store.onEvent = { events.items.append($0) }
        store.start()
        defer { store.stop() }
        let r = await buy(store, monthly)
        XCTAssertEqual(r.body["status"] as? String, "purchased", r.json)
        let tx = try XCTUnwrap(r.body["transactionId"] as? String)
        _ = await store.finish(tx)
        let local = try XCTUnwrap(session.allTransactions().filter { $0.productIdentifier == monthly }.max { $0.purchaseDate < $1.purchaseDate },
                                  "本地 App Store 里有这一笔")
        try session.refundTransaction(identifier: local.identifier)
        await waitFor("退款从 Transaction.updates 发给网页，kind = revoked") {
            events.items.contains { $0["productId"] as? String == self.monthly && $0["kind"] as? String == "revoked" }
        }
        let e = events.items.first { $0["kind"] as? String == "revoked" } ?? [:]
        XCTAssertGreaterThan(e["revoked"] as? Int64 ?? 0, 0, "带撤销时间")
        XCTAssertFalse((e["jws"] as? String ?? "").isEmpty, "服务器按 jws 把订阅标成 revoked")
        await waitFor("退了款不再算有效") {
            let ent = await store.entitlements()
            return !ent.contains { $0["productId"] as? String == self.monthly }
        }
    }
}

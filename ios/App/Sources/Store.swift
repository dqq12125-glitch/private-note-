import UIKit
import StoreKit

// 订阅（App 内购买，StoreKit 2）。iPhone 才有；安卓以后接 Google Play 结算，现在没有对应的方法。
// 给网页的几个异步方法（Bridge.callAsync → 这里 → window.__echoNative(id, 'ok' / 'fail', JSON 文字)）：
//   iapProducts  两个订阅的名字、价格、周期、首次优惠（免费试用）和这个账号还能不能用首次优惠
//   iapBuy       买：带上服务器给这个账号的 UUID（appAccountToken），苹果的服务器通知按它找到账号
//   iapRestore   恢复购买：AppStore.sync() 再列出现在有效的订阅
//   iapCurrent   现在有效的订阅（不弹任何界面）
//   iapPending   还没 finish 的交易（App 被杀、网页还没来得及交给服务器的，下次打开从这里补）
//   iapFinish    网页说「服务器已经存好了这笔」以后才调 finish()
//   iapManage    系统的「管理订阅」面板（取消、换档）
// 另外一开 App 就听 Transaction.updates（续费、退款、家长批准了「请求购买」、别的设备上买的），
// 来一笔就发事件 echo-iap 给网页（detail 和 iapPending 里的每一项一样）。
// **finish() 只在 iapFinish 里调**：网页把签名的交易（jws）交给服务器、服务器回了 200 才调。没 finish 的交易苹果下次打开 App 会再给一次。
// 交易的签名（jws）由服务器核对（cloud/API.md §7 POST /v1/iap/apple），这里的 verified 只是手机这一侧看的。
// 全部在主线程上（@MainActor），和 Bridge 一样。

// 回给网页的一次结果：ok = 'ok' / 'fail'，body 是 JSON 对象
struct StoreReply {
    let ok: Bool
    let body: [String: Any]

    static func ok(_ body: [String: Any]) -> StoreReply { return StoreReply(ok: true, body: body) }
    // 出错：{"error":"短代号","message":"英文说明"}
    static func fail(_ error: String, _ message: String) -> StoreReply { return StoreReply(ok: false, body: ["error": error, "message": message]) }

    var json: String { return Bridge.json(body) }
}

@MainActor
final class Store {
    // App 里只有一个（AppDelegate 一开 App 就 start()，Bridge 设 onEvent）
    static let shared = Store(monthly: BuildConfig.iapMonthly, yearly: BuildConfig.iapYearly)

    let monthly: String
    let yearly: String
    // 有交易从 Transaction.updates 来了（续费、退款……）：交给网页。detail 见 eventBody
    var onEvent: (@MainActor (_ detail: [String: Any]) -> Void)?
    private var listener: Task<Void, Never>?
    // 听 Transaction.updates 的那个任务已经跑起来了（马上就在等下一笔）。测试等它再买，和 App 里一样（一打开就听，买的时候早就在听了）
    private(set) var listening = false
    private var waiting: [UInt64: Transaction] = [:]      // 还没 finish 的（等网页说服务器存好了）
    private var buying = false

    init(monthly: String, yearly: String) {
        self.monthly = monthly
        self.yearly = yearly
    }

    // ---------- 小工具（纯逻辑，测试直接调） ----------

    // 商品编号：字母、数字、点、下划线（App Store Connect 的规矩），最长 100
    nonisolated static func okId(_ id: String) -> Bool {
        let ok = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._")
        return !id.isEmpty && id.count <= 100 && id.unicodeScalars.allSatisfy { ok.contains($0) }
    }

    // 时间 → 毫秒（和原生桥别的时间一样）
    nonisolated static func ms(_ d: Date) -> Int64 { return Int64((d.timeIntervalSince1970 * 1000).rounded()) }
    nonisolated static func msOrNull(_ d: Date?) -> Any {
        if let d = d { return ms(d) }
        return NSNull()
    }

    // 出错的英文说明和短代号（网页按代号分：没网 / 这个地区买不了 / 系统……）
    nonisolated static func text(_ error: Error) -> String { return String(describing: error) }
    nonisolated static func code(_ error: Error) -> String {
        if let e = error as? StoreKitError {
            switch e {
            case .userCancelled: return "cancelled"
            case .networkError: return "network"
            case .notAvailableInStorefront: return "storefront"
            case .notEntitled: return "not-entitled"
            case .systemError: return "system"
            default: return "store"
            }
        }
        if error is Product.PurchaseError { return "purchase" }
        return "store"
    }

    // 周期：{"unit":"month","value":1}
    nonisolated static func period(_ p: Product.SubscriptionPeriod) -> [String: Any] {
        let unit: String
        switch p.unit {
        case .day: unit = "day"
        case .week: unit = "week"
        case .month: unit = "month"
        case .year: unit = "year"
        @unknown default: unit = "unknown"
        }
        return ["unit": unit, "value": p.value]
    }

    nonisolated static func paymentMode(_ m: Product.SubscriptionOffer.PaymentMode) -> String {
        if m == .freeTrial { return "freeTrial" }
        if m == .payAsYouGo { return "payAsYouGo" }
        if m == .payUpFront { return "payUpFront" }
        return String(describing: m)
    }

    // 交易里那一笔（没核对过的也拿得到；用不用由服务器定）
    nonisolated static func payload(_ r: VerificationResult<Transaction>) -> Transaction {
        switch r {
        case .verified(let t): return t
        case .unverified(let t, _): return t
        }
    }

    // 这一笔是什么：revoked 退款 / 撤销，expired 已经过期，upgraded 换了更高的档，renewal 续费，purchase 第一次买（包括家长批准了的「请求购买」、优惠码）
    nonisolated static func kind(_ t: Transaction, now: Date = Date()) -> String {
        return kind(revoked: t.revocationDate, expires: t.expirationDate, upgraded: t.isUpgraded, id: t.id, originalId: t.originalID, now: now)
    }

    // 同一条规则，只看那几个字段（Transaction 没有公开的构造方法，单元测试从这里喂：退了款的、过期的、换档的……）。
    // 退款最先判：退了款的订阅可能同时也过期了、换过档，网页要按「撤销」收回会员
    nonisolated static func kind(revoked: Date?, expires: Date?, upgraded: Bool, id: UInt64, originalId: UInt64, now: Date = Date()) -> String {
        if revoked != nil { return "revoked" }
        if let e = expires, e < now { return "expired" }
        if upgraded { return "upgraded" }
        return id == originalId ? "purchase" : "renewal"
    }

    // 一笔交易给网页的样子。jws = 苹果签名的整笔交易，原样交给服务器（POST /v1/iap/apple 的 signedTransaction）。
    // 编号都写成字符串（UInt64，JavaScript 的数字放不下全部）。时间是毫秒，没有就是 null
    nonisolated static func describe(_ r: VerificationResult<Transaction>) -> [String: Any] {
        let t = payload(r)
        var o: [String: Any] = [:]
        switch r {
        case .verified: o["verified"] = true
        case .unverified(_, let e): o["verified"] = false; o["verifyError"] = String(describing: e)
        }
        o["jws"] = r.jwsRepresentation
        o["transactionId"] = String(t.id)
        o["originalId"] = String(t.originalID)
        o["productId"] = t.productID
        o["purchaseDate"] = ms(t.purchaseDate)
        o["expires"] = msOrNull(t.expirationDate)
        o["revoked"] = msOrNull(t.revocationDate)
        if let why = t.revocationReason { o["revocationReason"] = why.rawValue }
        o["upgraded"] = t.isUpgraded
        o["appAccountToken"] = t.appAccountToken.map { $0.uuidString.lowercased() as Any } ?? NSNull()
        o["environment"] = t.environment.rawValue
        o["ownership"] = t.ownershipType.rawValue
        return o
    }

    // 事件 echo-iap 和 iapPending 里的一项：describe + kind
    nonisolated static func eventBody(_ r: VerificationResult<Transaction>) -> [String: Any] {
        var o = describe(r)
        o["kind"] = kind(payload(r))
        return o
    }

    // 买的结果 → 回给网页的话。四种都是 ok（status 分开），真出错才是 fail：
    //   purchased 买到了（签名核对过）/ unverified 买到了但手机这一侧核对没过（照样交给服务器，由服务器定）/
    //   pending 等家长批准（请求购买）或者要先处理付款问题，批准以后从 echo-iap 事件来 / cancelled 自己点了取消
    nonisolated static func outcome(_ r: Product.PurchaseResult) -> StoreReply {
        switch r {
        case .success(let v):
            var o = describe(v)
            o["status"] = (o["verified"] as? Bool) == true ? "purchased" : "unverified"
            return .ok(o)
        case .userCancelled:
            return .ok(["status": "cancelled"])
        case .pending:
            return .ok(["status": "pending"])
        @unknown default:
            return .fail("unknown", "unknown purchase result")
        }
    }

    // 买的时候抛出来的错：取消的也按 cancelled 回（有的系统版本是抛 StoreKitError.userCancelled，不是回 .userCancelled）
    nonisolated static func outcome(error: Error) -> StoreReply {
        if let e = error as? StoreKitError, case .userCancelled = e { return .ok(["status": "cancelled"]) }
        return .fail(code(error), text(error))
    }

    // ---------- 一开 App 就听 ----------

    // StoreKit 只把新来的交易（家长批准了「请求购买」、退款、续费、刚打开 App 时没 finish 的）交给**当时正在听**的人，
    // 晚一步开始听的拿不到。所以：
    //   · 优先级用 userInitiated，不用 background。background 的任务系统忙时可以一直排不上：2026-11-19 云上的 StoreKit 测试里，
    //     App 打开 9 秒后买东西，StoreKit 还报「Making a purchase without listening for transaction updates」，
    //     140 毫秒后家长批准的那一笔交到了 App，却没有人在听，事件就没发出去（run 44526910786 的系统日志）
    //   · 序列自己结束了（不是我们叫停的，比如 StoreKit 换了环境）：歇一秒再订阅一次，别把后面的漏了
    func start() {
        if listener != nil { return }
        listener = Task.detached(priority: .userInitiated) { [weak self] in
            while !Task.isCancelled {
                await self?.mark(true)
                for await r in Transaction.updates {
                    await self?.received(r)
                }
                await self?.mark(false)
                if Task.isCancelled { break }
                try? await Task.sleep(nanoseconds: 1_000_000_000)
            }
        }
    }

    func stop() {
        listener?.cancel()
        listener = nil
        listening = false
    }

    private func mark(_ on: Bool) {
        if listener != nil { listening = on }
    }

    private func received(_ r: VerificationResult<Transaction>) {
        let t = Store.payload(r)
        waiting[t.id] = t
        onEvent?(Store.eventBody(r))
    }

    // ---------- 给网页的方法 ----------

    // ids：逗号分开的商品编号（网页传数组也行，echo-native.js 转成 "a,b"）；空的 = 月度、年度两个
    func products(_ list: String) async -> StoreReply {
        var ids = list.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        if ids.isEmpty { ids = [monthly, yearly] }
        guard ids.count <= 20, ids.allSatisfy(Store.okId) else { return .fail("bad-product", "product ids are letters, digits, dots and underscores") }
        do {
            let found = try await Product.products(for: ids)
            var out: [[String: Any]] = []
            for id in ids {
                guard let p = found.first(where: { $0.id == id }) else { continue }
                out.append(await productBody(p))
            }
            let missing = ids.filter { id in !found.contains { $0.id == id } }
            return .ok(["products": out, "missing": missing, "canPay": AppStore.canMakePayments])
        } catch {
            return .fail(Store.code(error), Store.text(error))
        }
    }

    // 一个商品给网页的样子
    private func productBody(_ p: Product) async -> [String: Any] {
        var o: [String: Any] = [
            "id": p.id,
            "kind": p.id == monthly ? "monthly" : p.id == yearly ? "yearly" : "",
            "title": p.displayName,
            "description": p.description,
            "displayPrice": p.displayPrice,
            "price": NSDecimalNumber(decimal: p.price).stringValue,
            "currency": p.priceFormatStyle.currencyCode,
        ]
        guard let sub = p.subscription else { o["period"] = NSNull(); o["introOffer"] = NSNull(); o["introEligible"] = false; o["trial"] = false; return o }
        o["groupId"] = sub.subscriptionGroupID
        o["period"] = Store.period(sub.subscriptionPeriod)
        let eligible = await sub.isEligibleForIntroOffer
        o["introEligible"] = eligible
        if let intro = sub.introductoryOffer {
            let mode = Store.paymentMode(intro.paymentMode)
            o["introOffer"] = ["paymentMode": mode, "period": Store.period(intro.period), "periodCount": intro.periodCount,
                               "displayPrice": intro.displayPrice] as [String: Any]
            o["trial"] = eligible && mode == "freeTrial"
        } else {
            o["introOffer"] = NSNull()
            o["trial"] = false
        }
        return o
    }

    // 买。token = 服务器给这个账号的 UUID（GET /v1/me 的 iapToken），没有或者不是 UUID 就不买（买了也对不上账号）。
    // confirmIn：弹购买确认面板的画面（App 里是游戏画面；单元测试里没有，用不带画面的写法）
    func buy(_ productId: String, token: String, confirmIn vc: UIViewController?) async -> StoreReply {
        let id = productId.trimmingCharacters(in: .whitespaces)
        guard Store.okId(id) else { return .fail("bad-product", "product id is letters, digits, dots and underscores") }
        guard let uuid = UUID(uuidString: token.trimmingCharacters(in: .whitespaces)) else { return .fail("bad-token", "appAccountToken must be the account's UUID") }
        guard !buying else { return .fail("busy", "another purchase is still open") }
        guard AppStore.canMakePayments else { return .fail("payments-disabled", "this device does not allow purchases (Screen Time)") }
        buying = true
        defer { buying = false }
        do {
            guard let p = try await Product.products(for: [id]).first else { return .fail("not-found", "no such product in the App Store: " + id) }
            let opts: Set<Product.PurchaseOption> = [.appAccountToken(uuid)]
            let r: Product.PurchaseResult
            if let vc = vc {
                r = try await p.purchase(confirmIn: vc, options: opts)
            } else {
                r = try await p.purchase(options: opts)
            }
            if case .success(let v) = r {
                let t = Store.payload(v)
                waiting[t.id] = t                        // 等网页说服务器存好了再 finish
            }
            return Store.outcome(r)
        } catch {
            return Store.outcome(error: error)
        }
    }

    // 现在有效的订阅（每一项和 describe 一样，网页把每个 jws 交给服务器）
    func entitlements() async -> [[String: Any]] {
        var out: [[String: Any]] = []
        for await r in Transaction.currentEntitlements { out.append(Store.describe(r)) }
        return out
    }

    func current() async -> StoreReply {
        return .ok(["entitlements": await entitlements()])
    }

    // 恢复购买：先 AppStore.sync()（可能要输 Apple 账户密码），不管成没成都列出现在有效的订阅
    func restore() async -> StoreReply {
        var o: [String: Any] = ["synced": true]
        do {
            try await AppStore.sync()
        } catch {
            o["synced"] = false
            o["syncError"] = Store.text(error)
            if let e = error as? StoreKitError, case .userCancelled = e { o["cancelled"] = true }
        }
        o["entitlements"] = await entitlements()
        return .ok(o)
    }

    // 还没 finish 的交易（网页打开时问一次：上次被杀、没交给服务器的都在这里）
    func pending() async -> StoreReply {
        var seen = Set<UInt64>()
        var out: [[String: Any]] = []
        for await r in Transaction.unfinished {
            let t = Store.payload(r)
            waiting[t.id] = t
            if seen.insert(t.id).inserted { out.append(Store.eventBody(r)) }
        }
        return .ok(["transactions": out])
    }

    // 服务器存好了这一笔：finish。已经 finish 过的、没有这一笔的回 finished:false（网页不用当错）
    func finish(_ transactionId: String) async -> StoreReply {
        guard let id = UInt64(transactionId.trimmingCharacters(in: .whitespaces)) else { return .fail("bad-id", "transactionId is a number in a string") }
        var t = waiting[id]
        if t == nil {
            for await r in Transaction.unfinished {
                let x = Store.payload(r)
                if x.id == id { t = x; break }
            }
        }
        guard let tx = t else { return .ok(["finished": false, "transactionId": transactionId, "reason": "not-unfinished"]) }
        await tx.finish()
        waiting[id] = nil
        return .ok(["finished": true, "transactionId": transactionId])
    }

    // 系统的「管理订阅」面板；关掉以后才回（网页再 iapCurrent 看变了没有）
    func manage(in scene: UIWindowScene?) async -> StoreReply {
        guard let s = scene else { return .fail("no-scene", "the game screen is not on screen") }
        do {
            try await AppStore.showManageSubscriptions(in: s)
            return .ok(["shown": true])
        } catch {
            return .fail(Store.code(error), Store.text(error))
        }
    }
}

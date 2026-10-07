package com.echoisland.app;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

// 家长密码的检查和「连续错 5 次锁 10 分钟」。纯 Java、不依赖安卓（tests/native.test.js 用 JDK 直接编译了测）。
// 密码从哪来（原文都不进 APK、不存原文）：
// - 家庭版：打包时 build.gradle 从 echo.properties 的 PARENT_PIN 算出「盐 + 密码」的 SHA-256（BuildConfig.PARENT_PIN_HASH）；
// - 销售版：APK 里没有（哈希是空的），家长在首次设置向导里设，set() 用这台手机自己的随机盐算哈希，存在原生（SharedPreferences）。
//   打包时带了密码的 APK 不许在手机上改（set 一律 false）。
// 输错的次数和锁定时间存在原生，网页改不了。
final class PinGuard {
    static final int TRIES = 5;                       // 连续错几次就锁
    static final long LOCK_MS = 10 * 60 * 1000L;      // 锁多久
    static final long CHANGE_MS = 2 * 60 * 1000L;     // 输对以后多久之内可以改密码

    // 存状态的地方（手机上是 SharedPreferences）。putLongs / putStrs 一次写完、写到磁盘再返回（被杀进程也不丢次数）
    interface Store {
        long getLong(String k, long d);
        void putLongs(String[] keys, long[] vals);
        // 手机上设的密码（盐和哈希）。老的实现没有字符串：当成没设过
        default String getStr(String k, String d) { return d; }
        default void putStrs(String[] keys, String[] vals) { }
    }

    // 时间：wall 手机时钟（毫秒）；elapsed 开机以来的毫秒数（改手机时钟没用）；boot 第几次开机（拿不到就 -1）
    interface Clock {
        long wall();
        long elapsed();
        long boot();
    }

    private final String salt, hash;
    private final Store st;
    private final Clock ck;
    private final boolean allowSet;                   // 能不能在手机上设密码（只有销售版能）
    private long okAt = -1, okBoot = -2;              // 最近一次输对的时间（开机以来的毫秒、第几次开机），只在内存里：重开 App 就要重新输

    PinGuard(String salt, String hash, Store st, Clock ck) { this(salt, hash, st, ck, false); }

    PinGuard(String salt, String hash, Store st, Clock ck, boolean allowSet) {
        this.salt = salt == null ? "" : salt;
        this.hash = hash == null ? "" : hash.trim().toLowerCase();
        this.st = st;
        this.ck = ck;
        this.allowSet = allowSet;
    }

    // 打包时带了家长密码（家庭版）
    boolean baked() { return hash.length() == 64; }
    // 打包时带了的就只认打包的；家庭版（不许在手机上设）从来不认手机上存的
    private String activeSalt() { return baked() || !allowSet ? salt : st.getStr("pinSalt", ""); }
    private String activeHash() { return baked() || !allowSet ? hash : st.getStr("pinHash", "").trim().toLowerCase(); }

    // 有没有家长密码：打包时带的，或者手机上设过的
    boolean has() { return activeHash().length() == 64; }

    static String sha256Hex(String s) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder b = new StringBuilder(64);
            for (byte x : h) b.append(String.format("%02x", x & 0xff));
            return b.toString();
        } catch (Exception e) {
            return "";
        }
    }

    // 还要锁多少毫秒（0 = 没锁）。同一次开机用「开机以来的时间」算，把手机时钟往后调也解不开；
    // 重启过就只能看手机时钟（时钟被往回调了，最多也只锁 10 分钟）
    synchronized long waitMs() {
        long until = st.getLong("pinLockWall", 0);
        if (until == 0) return 0;
        long boot = ck.boot(), left;
        if (boot >= 0 && boot == st.getLong("pinLockBoot", -2)) left = st.getLong("pinLockElapsed", 0) - ck.elapsed();
        else left = until - ck.wall();
        if (left <= 0) {
            st.putLongs(new String[]{"pinLockWall"}, new long[]{0});
            return 0;
        }
        return Math.min(left, LOCK_MS);
    }

    // 对不对。没设密码、空的、锁着的时候一律 false（空的不算一次）；对了清零错的次数
    synchronized boolean check(String pin) {
        if (!has() || pin == null || pin.trim().isEmpty() || waitMs() > 0) return false;
        byte[] a = sha256Hex(activeSalt() + pin.trim()).getBytes(StandardCharsets.UTF_8);
        boolean ok = MessageDigest.isEqual(a, activeHash().getBytes(StandardCharsets.UTF_8));
        if (ok) {
            st.putLongs(new String[]{"pinFails"}, new long[]{0});
            okAt = ck.elapsed();
            okBoot = ck.boot();
            return true;
        }
        okAt = -1;
        long f = st.getLong("pinFails", 0) + 1;
        if (f >= TRIES) {
            long w = ck.wall();
            st.putLongs(new String[]{"pinFails", "pinLockWall", "pinLockElapsed", "pinLockBoot", "pinLockouts", "pinLastLock"},
                    new long[]{0, w + LOCK_MS, ck.elapsed() + LOCK_MS, ck.boot(), st.getLong("pinLockouts", 0) + 1, w});
        } else {
            st.putLongs(new String[]{"pinFails"}, new long[]{f});
        }
        return false;
    }

    // 现在能不能在手机上设 / 改密码：家庭版、打包时带了密码的不行；还没有密码的可以（销售版第一次设置）；
    // 已经有了的，要 2 分钟内刚输对过（同一次开机）
    synchronized boolean canSet() {
        if (!allowSet || baked()) return false;
        if (!has()) return true;
        long now = ck.elapsed();
        return okAt >= 0 && okBoot == ck.boot() && now >= okAt && now - okAt <= CHANGE_MS;
    }

    // 设 / 改密码（必须是 4 位数字）：每次换一个新的随机盐，只存哈希；错的次数、锁定清零
    synchronized boolean set(String pin) {
        if (pin == null || !pin.trim().matches("\\d{4}") || !canSet()) return false;
        byte[] r = new byte[16];
        new SecureRandom().nextBytes(r);
        StringBuilder b = new StringBuilder("echo-island-parent-pin-v2:");
        for (byte x : r) b.append(String.format("%02x", x & 0xff));
        String s = b.toString(), h = sha256Hex(s + pin.trim());
        if (h.length() != 64) return false;
        st.putStrs(new String[]{"pinSalt", "pinHash"}, new String[]{s, h});
        st.putLongs(new String[]{"pinFails", "pinLockWall"}, new long[]{0, 0});
        okAt = -1;
        return activeHash().equals(h);
    }

    synchronized int triesLeft() {
        return waitMs() > 0 ? 0 : (int) Math.max(0, TRIES - st.getLong("pinFails", 0));
    }

    // 给网页的状态：{"has":true,"locked":false,"waitSec":0,"triesLeft":5,"lockouts":0,"lastLock":0,"canSet":false}
    // lockouts = 一共被锁过几次（周报用），lastLock = 最近一次被锁的时间（毫秒，0 = 没锁过），canSet = 现在能不能在手机上设 / 改密码
    synchronized String statusJson() {
        long w = waitMs();
        return "{\"has\":" + has() + ",\"locked\":" + (w > 0) + ",\"waitSec\":" + ((w + 999) / 1000) +
                ",\"triesLeft\":" + triesLeft() + ",\"lockouts\":" + st.getLong("pinLockouts", 0) +
                ",\"lastLock\":" + st.getLong("pinLastLock", 0) + ",\"canSet\":" + canSet() + "}";
    }
}

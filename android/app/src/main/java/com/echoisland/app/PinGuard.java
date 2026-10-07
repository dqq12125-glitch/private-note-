package com.echoisland.app;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

// 家长密码的检查和「连续错 5 次锁 10 分钟」。纯 Java、不依赖安卓（tests/native.test.js 用 JDK 直接编译了测）。
// APK 里只有密码加盐后的 SHA-256（BuildConfig.PARENT_PIN_HASH，打包时由 build.gradle 从 echo.properties 的 PARENT_PIN 算出来），
// 原文不进 APK。输错的次数和锁定时间存在原生（SharedPreferences），网页改不了。
final class PinGuard {
    static final int TRIES = 5;                       // 连续错几次就锁
    static final long LOCK_MS = 10 * 60 * 1000L;      // 锁多久

    // 存状态的地方（手机上是 SharedPreferences）。putLongs 一次写完、写到磁盘再返回（被杀进程也不丢次数）
    interface Store {
        long getLong(String k, long d);
        void putLongs(String[] keys, long[] vals);
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

    PinGuard(String salt, String hash, Store st, Clock ck) {
        this.salt = salt == null ? "" : salt;
        this.hash = hash == null ? "" : hash.trim().toLowerCase();
        this.st = st;
        this.ck = ck;
    }

    // 打包时有没有设家长密码
    boolean has() { return hash.length() == 64; }

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
        byte[] a = sha256Hex(salt + pin.trim()).getBytes(StandardCharsets.UTF_8);
        boolean ok = MessageDigest.isEqual(a, hash.getBytes(StandardCharsets.UTF_8));
        if (ok) {
            st.putLongs(new String[]{"pinFails"}, new long[]{0});
            return true;
        }
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

    synchronized int triesLeft() {
        return waitMs() > 0 ? 0 : (int) Math.max(0, TRIES - st.getLong("pinFails", 0));
    }

    // 给网页的状态：{"has":true,"locked":false,"waitSec":0,"triesLeft":5,"lockouts":0,"lastLock":0}
    // lockouts = 一共被锁过几次（周报用），lastLock = 最近一次被锁的时间（毫秒，0 = 没锁过）
    synchronized String statusJson() {
        long w = waitMs();
        return "{\"has\":" + has() + ",\"locked\":" + (w > 0) + ",\"waitSec\":" + ((w + 999) / 1000) +
                ",\"triesLeft\":" + triesLeft() + ",\"lockouts\":" + st.getLong("pinLockouts", 0) +
                ",\"lastLock\":" + st.getLong("pinLastLock", 0) + "}";
    }
}

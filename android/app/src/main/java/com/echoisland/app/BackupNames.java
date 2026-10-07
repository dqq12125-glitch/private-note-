package com.echoisland.app;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// 存档备份的文件名规则：下载/EchoIsland/echo-save-YYYYMMDD.json，每天一份，只留最新的 7 份。
// 纯 Java、不依赖安卓（tests/native.test.js 用 JDK 直接编译了测）。
// 同一天可能有「echo-save-20261007 (1).json」：卸载重装后旧的那份不再归这个 App 管，系统会给新的加编号。
final class BackupNames {
    static final int KEEP = 7;
    static final Pattern NAME = Pattern.compile("echo-save-(\\d{8})(?: \\((\\d{1,4})\\))?\\.json");

    // 一个备份文件：id 是 MediaStore 的编号（旧安卓上是列表里的序号），time 是修改时间（毫秒）
    static final class Item {
        final long id, size, time;
        final String name;

        Item(long id, String name, long size, long time) {
            this.id = id;
            this.name = name;
            this.size = size;
            this.time = time;
        }
    }

    static String forDay(String yyyymmdd) { return "echo-save-" + yyyymmdd + ".json"; }

    static boolean valid(String n) { return n != null && NAME.matcher(n).matches(); }

    // 文件名里的日期 "20261007"，不合规就 null
    static String day(String n) {
        if (n == null) return null;
        Matcher m = NAME.matcher(n);
        return m.matches() ? m.group(1) : null;
    }

    // 新的在前：先比文件名里的日期，同一天再比修改时间
    static List<Item> sorted(List<Item> in) {
        List<Item> out = new ArrayList<>();
        for (Item it : in) if (valid(it.name)) out.add(it);
        Collections.sort(out, (a, b) -> {
            int c = day(b.name).compareTo(day(a.name));
            return c != 0 ? c : Long.compare(b.time, a.time);
        });
        return out;
    }

    // 要删掉哪些：新的留 KEEP 份，其余删。keepName（刚写的那份）永远不删、占一个名额
    // （手机日期被往后调过时，它不一定排在最前面）
    static List<Item> toDelete(List<Item> in, String keepName) {
        List<Item> all = sorted(in), del = new ArrayList<>();
        boolean keepIn = false;
        for (Item it : all) if (it.name.equals(keepName)) keepIn = true;
        int slots = keepIn ? KEEP - 1 : KEEP;
        for (Item it : all) {
            if (keepIn && it.name.equals(keepName)) continue;
            if (slots > 0) { slots--; continue; }
            del.add(it);
        }
        return del;
    }

    // [{"name":"echo-save-20261007.json","date":"2026-10-07","size":12345,"time":1791234567890}, …]，新的在前
    static String listJson(List<Item> in) {
        StringBuilder b = new StringBuilder("[");
        for (Item it : sorted(in)) {
            String d = day(it.name);
            if (b.length() > 1) b.append(',');
            b.append("{\"name\":\"").append(it.name).append("\",\"date\":\"")
                    .append(d, 0, 4).append('-').append(d, 4, 6).append('-').append(d, 6, 8)
                    .append("\",\"size\":").append(it.size).append(",\"time\":").append(it.time).append('}');
        }
        return b.append(']').toString();
    }
}

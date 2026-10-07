package com.echoisland.app;

import android.Manifest;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.SystemClock;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.WebSocketListener;

// 回声岛：全屏 WebView。游戏网页在 APK 的 assets/www 里，用 https://appassets.androidplatform.net 这个
// 虚拟的安全地址打开（这样麦克风、fetch 读模型和配音都能用，不能用 file://）。
// 原生桥 EchoNative 的每个方法在 android/README.md 里有说明（新加方法要同时改 README 和 tests/fake-native.js，tests/native.test.js 会查）。
public class MainActivity extends Activity {
    private static final String HOME = "https://appassets.androidplatform.net/assets/www/index.html";
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final int BG = Color.parseColor("#12304a");
    private static final int REQ_MIC = 7, REQ_STORAGE = 8, REQ_PICK = 9;
    private static final String BACKUP_REL = Environment.DIRECTORY_DOWNLOADS + "/EchoIsland";   // 下载/EchoIsland
    private static final long PICK_MAX = 32L << 20;        // 从文件恢复：最大 32MB
    private static final int SHARE_TEXT_MAX = 8000;        // 比这长的文字改成文件分享（微信的文字消息放不下整个存档）

    private FrameLayout root;
    private WebView web;
    private SharedPreferences prefs;
    private PinGuard pin;
    private boolean resumed;
    private volatile boolean recovered;                  // 渲染进程挂了、刚重建过 WebView（takeRecovered() 告诉网页一次）
    private volatile int gen;                            // 第几个 WebView：旧 WebView 的回调不发给新页面
    private final List<Long> goneAt = new ArrayList<>();
    // 麦克风权限
    private final List<PermissionRequest> pendingMic = new ArrayList<>();
    private boolean micAsking, micRationaleBefore;
    private long micAskAt;
    private String micLast = "";
    // 存档备份
    private final Object backupLock = new Object();
    private String pendingBackup;
    private boolean storageAsked;

    // 直连阿里云：带密钥的 WebSocket（实时语音）和 HTTPS（聊完打分）。只许连 dashscope.aliyuncs.com
    private final OkHttpClient http = new OkHttpClient.Builder().pingInterval(20, TimeUnit.SECONDS)
            .connectTimeout(15, TimeUnit.SECONDS).readTimeout(0, TimeUnit.SECONDS).build();
    private final Map<Integer, okhttp3.WebSocket> socks = new ConcurrentHashMap<>();

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = getSharedPreferences("echo", MODE_PRIVATE);
        pin = new PinGuard(BuildConfig.PARENT_PIN_SALT, BuildConfig.PARENT_PIN_HASH, new PinGuard.Store() {
            @Override public long getLong(String k, long d) { return prefs.getLong(k, d); }
            @Override public void putLongs(String[] ks, long[] vs) {
                SharedPreferences.Editor e = prefs.edit();
                for (int i = 0; i < ks.length; i++) e.putLong(ks[i], vs[i]);
                e.commit();
            }
        }, new PinGuard.Clock() {
            @Override public long wall() { return System.currentTimeMillis(); }
            @Override public long elapsed() { return SystemClock.elapsedRealtime(); }
            @Override public long boot() { return Settings.Global.getInt(getContentResolver(), Settings.Global.BOOT_COUNT, -1); }
        });
        applyOrientation(prefs.getString("orient", "portrait"));   // 上次在游戏设置里选的屏幕方向
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);   // 调试包：电脑上能用 Chrome 开发者工具看网页
        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        setContentView(root);
        hideBars();
        buildWebView();
        if (saved == null || web.restoreState(saved) == null) web.loadUrl(HOME);
        micLast = micState();
    }

    // 建一个 WebView 放进画面（启动时一次；渲染进程挂了以后再建一次）
    private void buildWebView() {
        final WebView w = new WebView(this);
        w.setBackgroundColor(BG);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                       // 存档在 localStorage
        s.setMediaPlaybackRequiresUserGesture(false);       // 配音自动播放
        s.setAllowFileAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setTextZoom(100);                                 // 不跟系统字体大小走，免得排版挤爆
        s.setUserAgentString(s.getUserAgentString() + " EchoIslandApp/" + BuildConfig.VERSION_NAME);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        // 页面一开始就告诉游戏：AI 对话服务的地址和家庭口令（打包时从 android/echo.properties 读进来）
        final String js = "window.ECHO_APP=1;window.ECHO_TALK_URL=" + jsStr(BuildConfig.TALK_URL) + ";" +
                "try{if(" + jsStr(BuildConfig.TALK_CODE) + "&&!localStorage.getItem('echo-talk-code'))localStorage.setItem('echo-talk-code'," + jsStr(BuildConfig.TALK_CODE) + ")}catch(e){}";
        final boolean docStart = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT);
        if (docStart) WebViewCompat.addDocumentStartJavaScript(w, js, Collections.singleton(ORIGIN));

        w.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (!docStart) view.evaluateJavascript(js, null);
            }
            // 网页的渲染进程崩了，或者在后台被系统杀了（内存不够）：不让整个 App 闪退，换一个新的 WebView
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail d) {
                renderGone(view, d != null && d.didCrash());
                return true;
            }
        });
        w.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest r) {
                runOnUiThread(() -> micRequest(r));
            }
        });
        w.addJavascriptInterface(new Native(), "EchoNative");
        root.addView(w, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web = w;
    }

    // 渲染进程没了：扔掉旧 WebView、重建、重新打开首页。存档在 localStorage（App 进程保管、写在磁盘上），重建后还在。
    // 2 分钟里挂了 3 次就别死循环了：显示一句话，等孩子点一下再开
    private void renderGone(WebView view, boolean crashed) {
        prefs.edit().putLong("goneCount", prefs.getLong("goneCount", 0) + 1)
                .putLong("goneLast", System.currentTimeMillis()).putBoolean("goneCrash", crashed).apply();
        root.removeView(view);
        view.destroy();
        if (view != web) return;
        web = null;
        gen++;
        closeSockets();
        for (PermissionRequest r : pendingMic) { try { r.deny(); } catch (Exception ignored) { } }
        pendingMic.clear();
        long now = SystemClock.elapsedRealtime();
        goneAt.add(now);
        while (!goneAt.isEmpty() && now - goneAt.get(0) > 120_000) goneAt.remove(0);
        if (goneAt.size() >= 3) { showCrashScreen(); return; }
        reopen();
    }

    private void reopen() {
        recovered = true;
        buildWebView();
        web.loadUrl(HOME);
        if (!resumed) web.onPause();
    }

    private void showCrashScreen() {
        final TextView t = new TextView(this);
        t.setText("画面出了点问题 😵\n\n点这里重新打开\n（存档还在）");
        t.setTextColor(Color.WHITE);
        t.setTextSize(22);
        t.setGravity(Gravity.CENTER);
        t.setOnClickListener(v -> { root.removeView(t); goneAt.clear(); reopen(); });
        root.addView(t, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void closeSockets() {
        for (okhttp3.WebSocket w : socks.values()) { try { w.cancel(); } catch (Exception ignored) { } }
        socks.clear();
    }

    // 屏幕方向：portrait 竖屏 / landscape 横屏（两个横向都行）/ auto 跟着手机转（尊重系统的「锁定旋转」）
    private void applyOrientation(String m) {
        setRequestedOrientation("landscape".equals(m) ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                : "auto".equals(m) ? ActivityInfo.SCREEN_ORIENTATION_FULL_USER
                : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
    }

    // 密钥：手机上「设置 → AI」家长粘贴的优先（存在 SharedPreferences）；没有就用打包时 KEY_FILE 里的
    // （家长 2026-10-07 定的：密钥照旧打进 APK，BuildConfig.DASHSCOPE_KEY）。两个都空时连接一律按「没有密钥」回
    private String key() {
        String k = prefs.getString("key", "");
        return k.isEmpty() ? BuildConfig.DASHSCOPE_KEY : k;
    }

    // 回调网页：window.__echoNative(id, 类型, 数据)。g = 发起时是第几个 WebView，WebView 重建过就不发了
    private void cb(final int g, int id, String type, String data) {
        final String js = "window.__echoNative&&window.__echoNative(" + id + "," + jsStr(type) + "," + jsStr(data) + ")";
        runOnUiThread(() -> { if (g == gen && web != null) web.evaluateJavascript(js, null); });
    }

    // 给网页发一个事件：window.dispatchEvent(new CustomEvent(名字, {detail: …}))。detailJs 是一段 JS 表达式
    private void emit(String event, String detailJs) {
        final String js = "window.dispatchEvent(new CustomEvent(" + jsStr(event) + ",{detail:" + detailJs + "}))";
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(js, null); });
    }

    // ---------- 麦克风权限 ----------

    private boolean micGranted() {
        return checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    // granted 允许了 / denied 还没允许（再问会弹系统框）/ blocked 永久拒绝了（系统不再弹框，只能去设置里打开）
    private String micState() {
        if (micGranted()) return "granted";
        if (prefs.getBoolean("micBlocked", false) && !shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO)) return "blocked";
        return "denied";
    }

    // 麦克风状态变了（比如从设置里打开回来）就告诉网页：事件 echo-mic，detail 是 granted / denied / blocked
    private void notifyMic() {
        String s = micState();
        if ("granted".equals(s) && prefs.getBoolean("micBlocked", false)) prefs.edit().remove("micBlocked").apply();
        boolean changed = !micLast.isEmpty() && !micLast.equals(s);
        micLast = s;
        if (changed) emit("echo-mic", jsStr(s));
    }

    // 网页要用麦克风（getUserMedia）：有权限就放行，没有就弹系统框（同时来的几个请求一起等结果）
    private void micRequest(PermissionRequest r) {
        boolean wantsMic = false;
        for (String res : r.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) wantsMic = true;
        if (!wantsMic) { r.deny(); return; }
        if (micGranted()) { r.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE}); return; }
        pendingMic.add(r);
        if (micAsking) return;
        micAsking = true;
        micRationaleBefore = shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO);
        micAskAt = SystemClock.elapsedRealtime();
        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        boolean ok = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        if (code == REQ_MIC) {
            micAsking = false;
            if (ok) prefs.edit().remove("micBlocked").apply();
            else {
                // 系统还肯再弹框 = 这次拒绝；不肯了 = 永久拒绝（勾了「不再询问」，或安卓 11 起拒绝了两次）。
                // 第一次弹框被点到外面关掉时前后都是 false，但框真的弹过；系统根本没弹框就拒绝 = 早就永久拒绝了。
                // 弹没弹框只能看快慢：模拟器实测没弹框 0.4–0.6 秒就回来，弹了框人看完再点至少 1 秒左右
                // （窗口焦点不行：没弹框时系统也会短暂抢走焦点）。判错了也只是让孩子去设置里打开，照样能用。
                // 已经是永久拒绝的，在允许之前一直算永久拒绝
                boolean after = shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO);
                long ms = SystemClock.elapsedRealtime() - micAskAt;
                boolean blocked = !after && (micRationaleBefore || prefs.getBoolean("micBlocked", false) || ms < 900);
                prefs.edit().putBoolean("micBlocked", blocked)
                        .putString("micLastAsk", "{\"ms\":" + ms + ",\"before\":" + micRationaleBefore +
                                ",\"after\":" + after + ",\"blocked\":" + blocked + "}").apply();
            }
            for (PermissionRequest r : pendingMic) {
                try { if (ok) r.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE}); else r.deny(); } catch (Exception ignored) { }
            }
            pendingMic.clear();
            notifyMic();
        } else if (code == REQ_STORAGE) {
            final String p;
            synchronized (backupLock) { p = pendingBackup; pendingBackup = null; }
            if (ok && p != null) new Thread(() -> writeBackup(p)).start();
        }
    }

    // ---------- 存档备份（下载/EchoIsland/echo-save-YYYYMMDD.json，留最新 7 份，卸载 App 也不会删） ----------

    private static String today() { return new SimpleDateFormat("yyyyMMdd", Locale.US).format(new Date()); }

    private boolean writeBackup(String json) {
        synchronized (backupLock) {
            try {
                String name = BackupNames.forDay(today());
                byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
                if (Build.VERSION.SDK_INT >= 29) return writeBackupQ(name, bytes);
                // 安卓 9 及以下：要「存储」权限才能写公共的下载目录。第一次先问，问完补写这一份
                if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    pendingBackup = json;
                    if (!storageAsked) {
                        storageAsked = true;
                        runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE));
                    }
                    return false;
                }
                return writeBackupLegacy(name, bytes);
            } catch (Exception e) {
                return false;
            }
        }
    }

    private List<BackupNames.Item> listBackups() {
        if (Build.VERSION.SDK_INT >= 29) return listQ();
        if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) return new ArrayList<>();
        return listLegacy();
    }

    // 安卓 10 起：用 MediaStore 写进公共的「下载」，不用任何权限。只看得到、删得掉自己写的文件
    // （卸载重装以后，以前的备份要用 backupPick() 让家长在文件选择器里点）
    @TargetApi(29)
    private Uri downloads() { return MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY); }

    @TargetApi(29)
    private List<BackupNames.Item> listQ() {
        List<BackupNames.Item> out = new ArrayList<>();
        String[] proj = {MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.SIZE, MediaStore.MediaColumns.DATE_MODIFIED};
        String sel = MediaStore.MediaColumns.RELATIVE_PATH + " IN (?,?) AND " + MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ?";
        String[] args = {BACKUP_REL + "/", BACKUP_REL, "echo-save-%"};
        try (Cursor c = getContentResolver().query(downloads(), proj, sel, args, null)) {
            while (c != null && c.moveToNext()) {
                String n = c.getString(1);
                if (BackupNames.valid(n)) out.add(new BackupNames.Item(c.getLong(0), n, c.getLong(2), c.getLong(3) * 1000));
            }
        } catch (Exception ignored) { }
        return out;
    }

    @TargetApi(29)
    private boolean writeBackupQ(String name, byte[] bytes) throws IOException {
        ContentResolver cr = getContentResolver();
        String day = BackupNames.day(name);
        BackupNames.Item same = null;   // 今天已经写过的那份（可能被系统起名「… (1).json」）
        for (BackupNames.Item it : BackupNames.sorted(listQ())) if (day.equals(BackupNames.day(it.name))) { same = it; break; }
        Uri u;
        if (same != null) u = ContentUris.withAppendedId(downloads(), same.id);
        else {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, BACKUP_REL);
            v.put(MediaStore.MediaColumns.IS_PENDING, 1);
            u = cr.insert(downloads(), v);
            if (u == null) return false;
        }
        try (OutputStream o = cr.openOutputStream(u, "wt")) {
            if (o == null) throw new IOException("no stream");
            o.write(bytes);
        } catch (IOException e) {
            if (same == null) { try { cr.delete(u, null, null); } catch (Exception ignored) { } }
            throw e;
        }
        String actual = same != null ? same.name : name;
        if (same == null) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.IS_PENDING, 0);
            cr.update(u, v, null, null);
            try (Cursor c = cr.query(u, new String[]{MediaStore.MediaColumns.DISPLAY_NAME}, null, null, null)) {
                if (c != null && c.moveToFirst()) actual = c.getString(0);
            } catch (Exception ignored) { }
        }
        for (BackupNames.Item it : BackupNames.toDelete(listQ(), actual)) {
            try { cr.delete(ContentUris.withAppendedId(downloads(), it.id), null, null); } catch (Exception ignored) { }
        }
        return true;
    }

    @TargetApi(29)
    private String readQ(String name) throws IOException {
        for (BackupNames.Item it : listQ()) {
            if (!it.name.equals(name)) continue;
            try (InputStream in = getContentResolver().openInputStream(ContentUris.withAppendedId(downloads(), it.id))) {
                String t = in == null ? null : readAll(in, PICK_MAX);
                return t == null ? "" : t;
            }
        }
        return "";
    }

    @SuppressWarnings("deprecation")
    private File legacyDir() {
        return new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "EchoIsland");
    }

    private List<BackupNames.Item> listLegacy() {
        List<BackupNames.Item> out = new ArrayList<>();
        File[] fs = legacyDir().listFiles();
        if (fs != null) for (int i = 0; i < fs.length; i++) {
            if (fs[i].isFile() && BackupNames.valid(fs[i].getName())) out.add(new BackupNames.Item(i, fs[i].getName(), fs[i].length(), fs[i].lastModified()));
        }
        return out;
    }

    private boolean writeBackupLegacy(String name, byte[] bytes) throws IOException {
        File d = legacyDir();
        if (!d.isDirectory() && !d.mkdirs()) return false;
        File tmp = new File(d, name + ".tmp"), f = new File(d, name);
        try (OutputStream o = new FileOutputStream(tmp)) { o.write(bytes); }
        if (f.exists() && !f.delete()) return false;
        if (!tmp.renameTo(f)) return false;
        for (BackupNames.Item it : BackupNames.toDelete(listLegacy(), name)) new File(d, it.name).delete();
        return true;
    }

    // 读完一个流（超过 max 字节就返回 null）
    private static String readAll(InputStream in, long max) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[65536];
        long total = 0;
        for (int n; (n = in.read(buf)) > 0; ) {
            total += n;
            if (total > max) return null;
            b.write(buf, 0, n);
        }
        return new String(b.toByteArray(), StandardCharsets.UTF_8);
    }

    // 家长在系统的文件选择器里点了一个文件（恢复存档）：把内容交给网页，事件 echo-backup-picked
    @Override
    protected void onActivityResult(int code, int res, Intent data) {
        super.onActivityResult(code, res, data);
        if (code != REQ_PICK) return;
        if (res != RESULT_OK || data == null || data.getData() == null) { emitPicked(false, "", null, "cancel"); return; }
        final Uri u = data.getData();
        new Thread(() -> {
            String name = "";
            try (Cursor c = getContentResolver().query(u, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                if (c != null && c.moveToFirst() && c.getString(0) != null) name = c.getString(0);
            } catch (Exception ignored) { }
            try (InputStream in = getContentResolver().openInputStream(u)) {
                String t = in == null ? null : readAll(in, PICK_MAX);
                if (t == null) emitPicked(false, name, null, "too big");
                else emitPicked(true, name, t, null);
            } catch (Exception e) {
                emitPicked(false, name, null, "read");
            }
        }).start();
    }

    private void emitPicked(boolean ok, String name, String text, String error) {
        try {
            JSONObject o = new JSONObject().put("ok", ok).put("name", name == null ? "" : name);
            if (text != null) o.put("text", text);
            if (error != null) o.put("error", error);
            emit("echo-backup-picked", "JSON.parse(" + jsStr(o.toString()) + ")");
        } catch (Exception ignored) { }
    }

    // ---------- 分享（导出存档发微信） ----------

    private void chooser(Intent send, String title) {
        final Intent c = Intent.createChooser(send, title == null || title.isEmpty() ? "分享" : title);
        c.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        runOnUiThread(() -> { try { startActivity(c); } catch (Exception ignored) { } });
    }

    private boolean shareAsFile(String title, String name, String text) {
        try {
            File d = ShareProvider.dir(this);
            File[] old = d.listFiles();
            if (old != null) for (File f : old) f.delete();     // 只留这一份
            try (OutputStream o = new FileOutputStream(new File(d, name))) { o.write(text.getBytes(StandardCharsets.UTF_8)); }
            Uri u = ShareProvider.uriFor(this, name);
            Intent send = new Intent(Intent.ACTION_SEND).setType(ShareProvider.mime(name)).putExtra(Intent.EXTRA_STREAM, u);
            if (title != null && !title.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, title);
            send.setClipData(android.content.ClipData.newRawUri(name, u));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            chooser(send, title);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    // ---------- 给网页用的原生桥 ----------
    // 网页拿不到密钥本身，只能请这里带着密钥去连阿里云。每个方法的说明见 android/README.md
    private class Native {
        @JavascriptInterface public boolean hasKey() { return !key().isEmpty(); }
        @JavascriptInterface public void setKey(String k) { prefs.edit().putString("key", k == null ? "" : k.trim()).apply(); }
        @JavascriptInterface public void setOrientation(String m) {
            final String v = "landscape".equals(m) || "auto".equals(m) ? m : "portrait";
            prefs.edit().putString("orient", v).apply();
            runOnUiThread(() -> applyOrientation(v));
        }
        @JavascriptInterface public void wsOpen(final int id, String url) {
            final int g = gen;
            if (url == null || !url.startsWith("wss://dashscope.aliyuncs.com/")) { cb(g, id, "error", "bad url"); return; }
            String k = key();
            // 没有密钥：不用连了，直接按「密钥失效」回（网页认 401，提示「请家长在设置里粘贴 AI 密钥」）
            if (k.isEmpty()) { cb(g, id, "error", "HTTP 401 no key"); return; }
            Request r = new Request.Builder().url(url).header("Authorization", "Bearer " + k).build();
            socks.put(id, http.newWebSocket(r, new WebSocketListener() {
                @Override public void onOpen(okhttp3.WebSocket ws, Response res) { cb(g, id, "open", ""); }
                @Override public void onMessage(okhttp3.WebSocket ws, String text) { cb(g, id, "message", text); }
                @Override public void onClosing(okhttp3.WebSocket ws, int code, String reason) { ws.close(1000, null); }
                @Override public void onClosed(okhttp3.WebSocket ws, int code, String reason) { socks.remove(id, ws); cb(g, id, "closed", reason); }
                @Override public void onFailure(okhttp3.WebSocket ws, Throwable t, Response res) {
                    socks.remove(id, ws);
                    cb(g, id, "error", (res != null ? "HTTP " + res.code() + " " : "") + (t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage()));
                }
            }));
        }
        @JavascriptInterface public void wsSend(int id, String text) { okhttp3.WebSocket w = socks.get(id); if (w != null) w.send(text); }
        @JavascriptInterface public void wsClose(int id) { okhttp3.WebSocket w = socks.remove(id); if (w != null) w.close(1000, "bye"); }
        @JavascriptInterface public void post(final int id, String url, String body) {
            final int g = gen;
            if (url == null || !url.startsWith("https://dashscope.aliyuncs.com/")) { cb(g, id, "fail", "bad url"); return; }
            String k = key();
            if (k.isEmpty()) { cb(g, id, "fail", "{\"code\":\"InvalidApiKey\",\"message\":\"no key\",\"status\":401}"); return; }
            Request r = new Request.Builder().url(url).header("Authorization", "Bearer " + k)
                    .post(RequestBody.create(body == null ? "" : body, MediaType.get("application/json"))).build();
            http.newCall(r).enqueue(new Callback() {
                @Override public void onFailure(Call call, IOException e) { cb(g, id, "fail", String.valueOf(e.getMessage())); }
                @Override public void onResponse(Call call, Response res) throws IOException {
                    String t = res.body() != null ? res.body().string() : "";
                    if (!res.isSuccessful() && t.isEmpty()) t = "HTTP " + res.code();
                    cb(g, id, res.isSuccessful() ? "ok" : "fail", t);
                }
            });
        }

        // ---- 版本和诊断 ----
        @JavascriptInterface public String version() {
            try { return new JSONObject().put("code", BuildConfig.VERSION_CODE).put("name", BuildConfig.VERSION_NAME).toString(); }
            catch (Exception e) { return "{}"; }
        }
        @JavascriptInterface public String diag() {
            try {
                PackageInfo wv = WebView.getCurrentWebViewPackage();
                return new JSONObject().put("renderGone", prefs.getLong("goneCount", 0)).put("lastGone", prefs.getLong("goneLast", 0))
                        .put("lastCrash", prefs.getBoolean("goneCrash", false)).put("sdk", Build.VERSION.SDK_INT)
                        .put("android", Build.VERSION.RELEASE).put("webview", wv != null ? wv.versionName : "")
                        .put("debug", BuildConfig.DEBUG)
                        .put("micLastDeny", new JSONObject(prefs.getString("micLastAsk", "{}"))).toString();
            } catch (Exception e) { return "{}"; }
        }
        @JavascriptInterface public boolean takeRecovered() { boolean r = recovered; recovered = false; return r; }

        // ---- 家长密码 ----
        @JavascriptInterface public boolean hasPin() { return pin.has(); }
        @JavascriptInterface public boolean checkPin(String p) { return pin.check(p); }
        @JavascriptInterface public String pinStatus() { return pin.statusJson(); }

        // ---- 麦克风 ----
        @JavascriptInterface public String micPermission() { return micState(); }
        @JavascriptInterface public boolean openAppSettings() {
            final Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getPackageName(), null));
            runOnUiThread(() -> {
                try { startActivity(i); }
                catch (Exception e) { try { startActivity(new Intent(Settings.ACTION_SETTINGS)); } catch (Exception ignored) { } }
            });
            return true;
        }

        // ---- 存档备份和导出 ----
        @JavascriptInterface public boolean backupWrite(String json) {
            if (json == null || !json.trim().startsWith("{")) return false;
            return writeBackup(json);
        }
        @JavascriptInterface public String backupList() {
            synchronized (backupLock) { return BackupNames.listJson(listBackups()); }
        }
        @JavascriptInterface public String backupRead(String name) {
            if (!BackupNames.valid(name)) return "";
            synchronized (backupLock) {
                try {
                    if (Build.VERSION.SDK_INT >= 29) return readQ(name);
                    File f = new File(legacyDir(), name);
                    if (!f.isFile()) return "";
                    try (InputStream in = new FileInputStream(f)) { String t = readAll(in, PICK_MAX); return t == null ? "" : t; }
                } catch (Exception e) { return ""; }
            }
        }
        @JavascriptInterface public boolean backupPick() {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                // 先打开「下载/EchoIsland」文件夹（有的手机不认就从别处开始，家长自己点进去）
                i.putExtra(DocumentsContract.EXTRA_INITIAL_URI, Uri.parse("content://com.android.externalstorage.documents/document/primary%3ADownload%2FEchoIsland"));
                try { startActivityForResult(i, REQ_PICK); } catch (Exception e) { emitPicked(false, "", null, "no picker"); }
            });
            return true;
        }
        @JavascriptInterface public boolean shareText(String title, String text) {
            if (text == null || text.isEmpty()) return false;
            if (text.length() > SHARE_TEXT_MAX) {   // 太长（整个存档）：改成发文件
                String t = text.trim();
                return shareAsFile(title, (t.startsWith("{") || t.startsWith("[") ? "echo-save-" + today() + ".json" : "echo-island-" + today() + ".txt"), text);
            }
            Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
            if (title != null && !title.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, title);
            chooser(send, title);
            return true;
        }
        @JavascriptInterface public boolean shareFile(String title, String name, String text) {
            if (text == null || !ShareProvider.okName(name) || !(name.endsWith(".json") || name.endsWith(".txt"))) return false;
            return shareAsFile(title, name, text);
        }
    }

    private static String jsStr(String v) {
        StringBuilder b = new StringBuilder("\"");
        for (char c : (v == null ? "" : v).toCharArray()) {
            if (c == '"' || c == '\\') b.append('\\').append(c);
            else if (c < 0x20 || c == '<' || c == 0x2028 || c == 0x2029) b.append(String.format("\\u%04x", (int) c));
            else b.append(c);
        }
        return b.append('"').toString();
    }

    private void hideBars() {
        // 沉浸式全屏：状态栏和导航条藏起来，从边上划一下会临时出来
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    // 返回键：先交给游戏（关弹窗、退出对话、回首页），游戏说没处理就退到后台
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web == null) { moveTaskToBack(true); return; }
        web.evaluateJavascript("(window.EchoBack&&window.EchoBack())?'1':'0'", v -> {
            if (!"\"1\"".equals(v)) moveTaskToBack(true);
        });
    }

    @Override protected void onPause() { super.onPause(); resumed = false; if (web != null) web.onPause(); }
    @Override protected void onResume() { super.onResume(); resumed = true; if (web != null) web.onResume(); hideBars(); notifyMic(); }
    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); if (web != null) web.saveState(out); }
    @Override protected void onDestroy() {
        closeSockets();
        if (web != null) { root.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }
}

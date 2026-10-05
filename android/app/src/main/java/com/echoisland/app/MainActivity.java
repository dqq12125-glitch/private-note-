package com.echoisland.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.IOException;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;

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
public class MainActivity extends Activity {
    private static final String HOME = "https://appassets.androidplatform.net/assets/www/index.html";
    private static final int REQ_MIC = 7;
    private WebView web;
    private PermissionRequest pendingMic;
    private SharedPreferences prefs;
    // 直连阿里云：带密钥的 WebSocket（实时语音）和 HTTPS（聊完打分）。只许连 dashscope.aliyuncs.com
    private final OkHttpClient http = new OkHttpClient.Builder().pingInterval(20, TimeUnit.SECONDS)
            .connectTimeout(15, TimeUnit.SECONDS).readTimeout(0, TimeUnit.SECONDS).build();
    private final Map<Integer, okhttp3.WebSocket> socks = new ConcurrentHashMap<>();

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = getSharedPreferences("echo", MODE_PRIVATE);
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);   // 调试包：电脑上能用 Chrome 开发者工具看网页
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#12304a"));
        setContentView(web);
        hideBars();

        WebSettings s = web.getSettings();
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
        String js = "window.ECHO_APP=1;window.ECHO_TALK_URL=" + jsStr(BuildConfig.TALK_URL) + ";" +
                "try{if(" + jsStr(BuildConfig.TALK_CODE) + "&&!localStorage.getItem('echo-talk-code'))localStorage.setItem('echo-talk-code'," + jsStr(BuildConfig.TALK_CODE) + ")}catch(e){}";
        final boolean docStart = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT);
        if (docStart) WebViewCompat.addDocumentStartJavaScript(web, js, Collections.singleton("https://appassets.androidplatform.net"));

        web.setWebViewClient(new WebViewClient() {
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
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest r) {
                runOnUiThread(() -> {
                    boolean wantsMic = false;
                    for (String res : r.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) wantsMic = true;
                    if (!wantsMic) { r.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        r.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        pendingMic = r;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
                    }
                });
            }
        });
        web.addJavascriptInterface(new Native(), "EchoNative");
        if (saved != null) web.restoreState(saved); else web.loadUrl(HOME);
    }

    // 密钥：手机上「设置服务」填的优先，没有就用打包时 KEY_FILE 里的
    private String key() {
        String k = prefs.getString("key", "");
        return k.isEmpty() ? BuildConfig.DASHSCOPE_KEY : k;
    }

    // 回调网页：window.__echoNative(id, 类型, 数据)
    private void cb(int id, String type, String data) {
        final String js = "window.__echoNative&&window.__echoNative(" + id + "," + jsStr(type) + "," + jsStr(data) + ")";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    // 给网页用的原生桥（talk.js 的 directSocket）。网页拿不到密钥本身，只能请这里带着密钥去连阿里云
    private class Native {
        @JavascriptInterface public boolean hasKey() { return !key().isEmpty(); }
        @JavascriptInterface public void setKey(String k) { prefs.edit().putString("key", k == null ? "" : k.trim()).apply(); }
        @JavascriptInterface public void wsOpen(final int id, String url) {
            if (url == null || !url.startsWith("wss://dashscope.aliyuncs.com/")) { cb(id, "error", "bad url"); return; }
            Request r = new Request.Builder().url(url).header("Authorization", "Bearer " + key()).build();
            socks.put(id, http.newWebSocket(r, new WebSocketListener() {
                @Override public void onOpen(okhttp3.WebSocket ws, Response res) { cb(id, "open", ""); }
                @Override public void onMessage(okhttp3.WebSocket ws, String text) { cb(id, "message", text); }
                @Override public void onClosing(okhttp3.WebSocket ws, int code, String reason) { ws.close(1000, null); }
                @Override public void onClosed(okhttp3.WebSocket ws, int code, String reason) { socks.remove(id); cb(id, "closed", reason); }
                @Override public void onFailure(okhttp3.WebSocket ws, Throwable t, Response res) {
                    socks.remove(id);
                    cb(id, "error", (res != null ? "HTTP " + res.code() + " " : "") + (t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage()));
                }
            }));
        }
        @JavascriptInterface public void wsSend(int id, String text) { okhttp3.WebSocket w = socks.get(id); if (w != null) w.send(text); }
        @JavascriptInterface public void wsClose(int id) { okhttp3.WebSocket w = socks.remove(id); if (w != null) w.close(1000, "bye"); }
        @JavascriptInterface public void post(final int id, String url, String body) {
            if (url == null || !url.startsWith("https://dashscope.aliyuncs.com/")) { cb(id, "fail", "bad url"); return; }
            Request r = new Request.Builder().url(url).header("Authorization", "Bearer " + key())
                    .post(RequestBody.create(body == null ? "" : body, MediaType.get("application/json"))).build();
            http.newCall(r).enqueue(new Callback() {
                @Override public void onFailure(Call call, IOException e) { cb(id, "fail", String.valueOf(e.getMessage())); }
                @Override public void onResponse(Call call, Response res) throws IOException {
                    String t = res.body() != null ? res.body().string() : "";
                    cb(id, res.isSuccessful() ? "ok" : "fail", t);
                }
            });
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

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code != REQ_MIC || pendingMic == null) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) pendingMic.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        else pendingMic.deny();
        pendingMic = null;
    }

    // 返回键：先交给游戏（关弹窗、退出对话、回首页），游戏说没处理就退到后台
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("(window.EchoBack&&window.EchoBack())?'1':'0'", v -> {
            if (!"\"1\"".equals(v)) moveTaskToBack(true);
        });
    }

    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); hideBars(); }
    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
}

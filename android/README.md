# 回声岛 安卓版（APK）

一个全屏 WebView 壳：游戏网页（`index.html`、各个 `.js`、`assets/` 里的怪兽模型和配音）在打包时整个复制进 APK，
用 `https://appassets.androidplatform.net/assets/www/index.html` 这个虚拟安全地址打开，所以：

- **离线能玩**：冒险、闯关、课本同步、每日复习都不用联网（有道在线发音只在没有配音的句子上兜底）。
- **麦克风能用**：第一次和岛民聊天时弹系统权限框（`RECORD_AUDIO`），WebView 里 `getUserMedia` 自动放行。
- **AI 聊天要联网**：连 `TALK_URL`（中转服务，见 `server/README.md`）。地址和家庭口令打包时写进 APK。
- 返回键交给游戏处理（`window.EchoBack`：关弹窗 → 关聊天 → 回首页），首页再按就退到后台。
- 竖屏、沉浸式全屏、不跟系统字体缩放、玩的时候屏幕常亮。

## 打包

需要 JDK 17、Android SDK（platform 35、build-tools）、Gradle 8.9+。

```bash
cd android
cp echo.properties.example echo.properties   # 填 TALK_URL / TALK_CODE，release 签名可选
gradle assembleRelease                         # 输出 app/build/outputs/apk/release/app-release.apk
```

`echo.properties` 和签名文件（`*.jks`）不进仓库。签名文件丢了以后就不能「覆盖安装」升级，只能卸载重装（存档会丢），要备份好。

## 装到手机（REDMI Turbo 5 / HyperOS）

把 APK 发到手机（微信文件传输、QQ、数据线都行）→ 点开 → 允许「安装未知应用」→ 安装。
HyperOS 可能提示「未经安全检测」，选继续安装即可。

# YouTube 字幕 TTS 配音

中文版 | [**English**](README.md)

一个油猴脚本（Tampermonkey/Greasemonkey），自动检测并朗读 YouTube 字幕，使用浏览器文本转语音（TTS）功能。专为多行翻译字幕场景设计。

## 功能特性

- **自定义类名选择器**：通过指定 CSS 类名解析字幕（支持多个类名）
- **自动朗读模式**：自动检测字幕变化并朗读
- **TTS 控制**：调节音量、语速和语音选择
- **视频音量控制**：独立控制视频音量
- **智能检测**：仅在字幕文本变化时朗读（避免重复）
- **自动停止**：可选择在视频播放时暂停朗读
- **Shadow DOM 支持**：可搜索 Shadow DOM 元素

## TTS 推荐

> **💡 提示：建议使用本地 TTS 获得更好体验**
>
> 远程 TTS 服务通常会引入延迟，可能会影响您的听觉体验。我们建议使用本地浏览器 TTS（本脚本默认使用）或其他本地 TTS 解决方案，以获得最佳性能和最小延迟。
>
> **🎤 发现好用的 TTS？欢迎分享！**
>
> 如果您找到了优秀的 TTS 服务或解决方案，欢迎与社区分享！请提交 Issue 或 PR 告诉大家您的发现。您的推荐可能帮助许多用户找到他们完美的语音解决方案。

## 安装方法

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)（Chrome/Edge）或 [Greasemonkey](https://www.greasespot.net/)（Firefox）
2. 点击 `gogogo.js` 的 "Raw" 按钮安装脚本
3. 打开任意 YouTube 视频页面

## 使用方法

### 获取字幕类名

1. 安装翻译插件（如 "Language Reactor" 或类似插件）

   我推荐：

   ![image-20260225224419077](assets/image1.png)

2. 打开带字幕的 YouTube 视频

3. 按 F12 打开开发者工具

   ![image-20260225225046863](assets/image2.png)

4. 使用元素选择器选择字幕元素

5. 右键 → Copy → Copy selector，或手动复制类名

6. 示例类名：`translated_subtitle-AHVt79 has_corner-hLvKLd`

### 配置步骤

1. 点击 YouTube 播放器控制栏中的 📢 按钮
2. 勾选 "启用自定义类名"
3. 粘贴字幕类名（空格分隔）
4. 配置 TTS 设置：
   - 视频音量
   - 朗读音量
   - 朗读速度
   - 语音选择（中文语音）
5. 根据需要启用自动朗读模式

### 自动朗读模式

- 勾选 "自动朗读功能" 复选框
- 设置检测间隔（推荐 500-2000ms）
- 可选设置："视频播放时暂停自动朗读"

## 按钮说明

| 按钮 | 功能 |
|------|------|
| 📢 | 打开/关闭字幕 TTS 面板 |
| 🔍 测试解析 | 手动解析字幕以验证配置 |
| 🎤 解析并朗读 | 解析当前字幕并朗读 |
| ▶️ 启动自动朗读 | 开启自动字幕朗读 |
| 🛑 停止自动朗读 | 关闭自动字幕朗读 |

## 技术细节

- 使用 `window.speechSynthesis` API 进行 TTS
- 过滤语音列表，仅显示中文/中文相关语音
- 配置存储在 Tampermonkey 存储中（`GM_setValue`/`GM_getValue`）
- 在 `document-idle` 时运行，确保页面元素已加载
- 支持普通 DOM 和 Shadow DOM 元素查询

## 常见问题

- **无法解析文本**：使用开发者工具验证类名是否正确
- **自动朗读不工作**：确保已勾选 "启用自定义类名" 且类名有效
- **语音不可用**：检查浏览器语言设置是否支持中文语音
- **Shadow DOM 元素**：脚本会自动尝试搜索 Shadow DOM

## 版本信息

当前版本：`0.2.0-alpha`

## 许可证

MIT License

## 作者

NameZH131 - [GitHub](https://github.com/NameZH131)

## 支持

- [问题反馈](https://github.com/NameZH131/youtube TTS/issues)
- [项目主页](https://github.com/NameZH131/youtube TTS)
> 社区插件正式名称 **Publisher Workbench**（ID publisher-workbench），项目仓库仍为 Obsidian Publisher。正式版 0.5.1 安装说明和第三方工具披露请参阅 [English README](./README.md)。旧版 ID obsidian-publisher 与社区版不能同时运行。

> 最新验收：微信公众号完整图文富文本与 X Articles 五图草稿均已在真实编辑器保存并刷新复核。公众号请手动选择「保存为草稿」，不要仅依赖自动保存。社区插件不会自动安装 X Bridge 或 Wechatsync。

# Obsidian Publisher

Obsidian Publisher 是一个桌面端 Obsidian 多平台发布插件。

目标不是让你在不同平台之间反复复制文章，而是把 Obsidian 作为唯一写作源。

    Obsidian 当前文章
          |
          v
       发布面板
          |
          +-- 微信公众号
          +-- X Articles
          +-- 小红书（次要）
          |
          v
    各平台草稿 / 待检查内容

MVP 坚持几个原则：

- Obsidian Markdown 是唯一内容源。
- 只生成草稿或待检查内容，不自动点击平台最终发布按钮。
- 核心发布目标是微信公众号和 X Articles。
- 微信公众号复用 Wechatsync；小红书保留为次要可选平台。
- X Articles 使用随插件提供的 X Bridge，绝不把普通 X 帖子冒充成长文章发布。
- 每个平台都是独立 Adapter，后续可增加知乎、掘金、CSDN。

## 使用方式

1. 在 Obsidian 中写完文章。
2. 保持该 Markdown 文章处于当前打开状态。
3. 点击左侧发布图标，或从命令面板运行 Publish current note。
4. 在 Publisher Workbench 中选择目标平台。
5. 公众号可直接在中栏调整字体、字号、行距、正文色、主题色和章节样式，右栏实时查看最终效果。
6. 需要时使用 Focus preview 全屏检查，或 Copy to WeChat 复制富文本。
7. 点击 Generate selected drafts / handoffs。
8. 查看每个平台独立的成功/失败状态；失败平台可以单独重试。
9. 打开对应平台检查草稿，最后由你本人确认发布。

插件默认开启 Dry run。第一次使用时不会调用外部发布命令，只会准备内容并展示实际会执行的命令。

## 微信公众号

0.3.0 起，公众号内置了一套本地微排工作台，不再要求先跳到外部排版网页。0.4.0 使用 /ui_design 重新设计了整个工作台的信息架构和视觉层级。
0.4.1 修复 Copy to WeChat：复制前会把本地图片嵌入富文本 HTML，写入系统剪贴板后再读回验证 text/html、text/plain、内联样式和图片数据；验证失败时不会再提示复制成功。
0.4.2 将 Copy to WeChat 改为与 Punk 微排同类的浏览器富文本链路：用户点击后优先使用 ClipboardItem 写入 text/html + text/plain，失败时回退到 contenteditable + Range + execCommand('copy')；本地图片复制前会压缩为最长边 1280px 的 JPEG，并限制整篇富文本不超过约 10MB。Electron clipboard 不再负责主写入，只用于读回验证。
0.4.3 修复真实粘贴仍降级为纯文本的问题：富文本 fragment、computed style 和图片压缩会在按钮可点击前后台预热完成；用户点击 Copy to WeChat 时第一时间同步执行 contenteditable + Range + execCommand('copy')，不再先 await 文件读取或图片处理，避免 Chromium transient user activation 失效。ClipboardItem 仅作为 fallback。系统级验证要求 macOS public.html 存在、真实图片和 inline style 保留、且复制内容不是完整 HTML 文档。
0.4.4 修复三项验收漏洞：X Bridge 0.1.7 在第五张图片等多图处理时等待挂起上传，并循环确认清除 __XPOSTER_ 图片占位符，不再将部分成功报告为成功；Wechatsync 在服务已启动但 Chrome 同步桥接未连接时提前报出具体原因，并限制子进程运行时长；Copy to WeChat 读取 macOS 原生 NSPasteboard public.html，客观验证 HTML/图片数量，不再把待复制字符串伪装成剪贴板验证成功。注意：系统剪贴板通过不代表微信公众号最终粘贴成功，仍须在真实编辑器验证。
0.4.5 修复了真实 Obsidian 1.14.4 / Electron 37 渲染进程内超时保护调用 `unref()` 的运行时崩溃。显式使用 Node `node:timers`，并增加数字型 DOM 定时器环境的回归测试及真实 Electron 渲染进程烟测。Wechatsync 浏览器扩展 WebSocket 连接稳定性与最终平台草稿仍需真实验收。
X Bridge 0.1.8 修复真实 X 草稿保存后重新出现 `XPOSTER_` 标记的竞态：完成写入后等待自动保存状态稳定，对延迟重新出现的标记重复清理，并要求媒体实体数量达到本次导入预期；相关延迟回写与残留失败回归已新增。注意仍需在 X 草稿重新打开后核查，不将本地状态通过等同于云端保存成功。

当前支持：

- 字体选择
- 14–20px 正文字号
- 1.4–2.4 行距
- 正文颜色
- 主题强调色
- 粗下划线、左竖线、方框、方括号四种章节样式
- 公众号实时预览
- Focus preview 专注预览
- Copy to WeChat 富文本复制
- Editorial、Tech Blue、Warm Paper、Forest 四套主题预设

预览与实际推送使用同一份内联样式 HTML。点击发布时，插件会把排版结果写入临时 .html 文件，再交给 Wechatsync：

    wechatsync sync <临时文章.html> -p <平台代码>

本地图片会在 HTML 导出阶段恢复成本机绝对路径，随后由 Wechatsync 现有本地图片上传流程处理。小红书仍使用原 Markdown/图片链路，不会套用公众号排版。

真实同步还需要在 Wechatsync Chrome 扩展中开启 MCP 连接，并把扩展生成的本地 Token 填入 Obsidian Publisher 设置。插件只通过子进程环境变量 WECHATSYNC_TOKEN 传递该 Token，不把它拼进命令行参数。

如果某个平台失败，工作台会展示退出码和 stderr/stdout，并只为失败平台显示 Retry only this platform，不需要整轮重新发布。

## Publisher Workbench

0.4.0 起发布窗口改为更接近桌面编辑器的双栏结构：

- 左侧 Inspector：主题、字体、字号、行距、章节样式、颜色、发布目标、平台状态和失败重试
- 右侧 Preview Canvas：公众号 / 小红书实时预览、Focus preview、Copy to WeChat
- 顶部 Header：当前文件上下文、Dry run / Draft mode 状态和唯一主发布按钮

四套主题预设会一次应用完整排版参数，之后仍可继续细调。公众号微排设置会保存到插件设置中，下次打开继续使用上次的排版参数。

## X Articles

X Articles 不走普通 X 发布逻辑。默认使用随项目提供的 **Obsidian Publisher X Bridge**。它基于 MIT 许可的 xPoster，并保留 xPoster 的原始 MIT 许可和上游版本记录。

主流程：

    Obsidian 当前文章
          |
          v
    OBSIDIAN_PUBLISHER_X_V1 剪贴板交接
          |
          v
    打开 X Articles
          |
          v
    Chrome 后台 Offscreen Clipboard 读取 handoff
          |
          v
    X Bridge 自动创建/进入新 X Article 草稿
          |
          v
    自动写入标题、正文、排版与图片
          |
          v
    用户最终确认 Publish

Obsidian 的 ![[image]] 会在 X handoff 中转换成标准 Markdown 图片引用，保留相对路径。X Bridge 继续使用 xPoster 已有的本地图片目录能力上传图片。

第一次使用本地图片时，Chrome 可能要求你选择一次包含图片的目录。xPoster 会把目录 Handle 保存在浏览器 IndexedDB 中；权限仍有效时后续文章可以复用。

X Articles 页面加载完成后，X Bridge 后台通过 Chrome Offscreen Clipboard API 自动读取新的 OBSIDIAN_PUBLISHER_X_V1 handoff，并且按 handoff id 去重，然后把 Markdown 直接交给 xPoster 已有的编辑器导入链路。日常流程不再要求手动打开 Side Panel。

Side Panel 仍然保留，用于诊断、查看状态和手动重试。

X Bridge 只把内容写入 X Articles 草稿编辑器，不点击 X 的最终 Publish 按钮。Obsidian 侧的 handoff 成功只报告为 PREPARED，不会伪装成已经发布成功。

### 备用模式

设置中仍保留 Prepare only 和 External command，便于后续替换 X Articles Adapter。

## 开发

    npm install
    npm test
    npm run typecheck
    npm run build

构建产物：

    main.js
    manifest.json
    styles.css
    x-extension/

复制到：

    <Vault>/.obsidian/plugins/obsidian-publisher/

然后在 Obsidian 设置中启用插件。

X Articles 还需要在 Chrome 开发者模式中“加载已解压的扩展”，选择：

    <Vault>/.obsidian/plugins/obsidian-publisher/x-extension

## 当前 MVP 限制

- 仅支持 Obsidian Desktop。
- frontmatter 当前只处理 MVP 所需的简单字段，例如 title、cover、image。
- 不保存平台密码或 Cookie。
- 不自动公开发布。
- X Bridge 需要 Chrome 桌面版和已登录的 X Articles 账号。
- 本地图片第一次可能需要一次目录授权。
- X handoff 与草稿写入不会被当成最终公开发布成功。
- 还没有发布历史和定时发布。
- 后续平台通过 Adapter 接入，不修改主 UI 和文章解析层。

详细架构见 docs/architecture.md，客观验收条件见 docs/MVP_ACCEPTANCE.md。

<p align="center">
  <picture style="width: 320px">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/logo/logo_drawnix_h.svg?raw=true" />
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/logo/logo_drawnix_h_dark.svg?raw=true" />
    <img src="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/logo/logo_drawnix_h.svg?raw=true" width="360" alt="Drawnix logo and name" />
  </picture>
</p>
<div align="center">
  <h2>
    Drawnix 桌面版 —— 基于 Tauri 的开源白板桌面应用，包含思维导图、流程图、自由画等
  <br />
  </h2>
</div>

<div align="center">
  <figure>
    <a target="_blank" rel="noopener">
      <img src="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/product_showcase/case-2.png" alt="Product showcase" width="80%" />
    </a>
    <figcaption>
      <p align="center">
        All in one 白板，思维导图、流程图、自由画等
      </p>
    </figcaption>
  </figure>
  <a href="https://hellogithub.com/repository/plait-board/drawnix" target="_blank">
    <picture style="width: 250">
      <source media="(prefers-color-scheme: light)" srcset="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=4dcea807fab7468a962c153b07ae4e4e&claim_uid=zmFSY5k8EuZri43&theme=neutral" />
      <source media="(prefers-color-scheme: dark)" srcset="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=4dcea807fab7468a962c153b07ae4e4e&claim_uid=zmFSY5k8EuZri43&theme=dark" />
      <img src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=4dcea807fab7468a962c153b07ae4e4e&claim_uid=zmFSY5k8EuZri43&theme=neutral" alt="Featured｜HelloGitHub" style="width: 250px; height: 54px;" width="250" height="54"/>
    </picture>
  </a>

  <br />

  <a href="https://trendshift.io/repositories/13979" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13979" alt="plait-board%2Fdrawnix | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</div>

[*English README*](README_en.md)

## 项目简介

本项目（**drawnix-desktop**）是在开源白板工具 [plait-board/drawnix](https://github.com/plait-board/drawnix) 基础上修改而来的 **桌面版项目**：引入 [Tauri](https://tauri.app) 框架，将原来的 Web 应用打包为跨平台桌面应用，并在原有能力之上新增了卡片插件与本地文件管理等功能。

相比上游项目的主要变更：

- **桌面化**：基于 Tauri 2.x（Rust 后端 + WebView 前端）打包为桌面应用，Windows 下产出 NSIS / MSI 安装包；
- **卡片插件（Card Plugin）**：支持在白板中插入卡片元素，卡片支持标题、正文、填充色与描边样式，并可作为箭头连线的绑定对象；
- **本地文件管理**：基于 Tauri 文件系统实现文件树侧边栏（TauriFilePanel），白板内容以 `.drawnix` 文件的形式保存在本地数据目录中，不再依赖浏览器缓存。

## 特性

继承自上游 drawnix 的特性：

- 💯 免费 + 开源
- ⚒️ 思维导图、流程图
- 🖌 画笔
- 😀 插入图片
- 🚀 基于插件机制
- 🖼️ 📃 导出为 PNG, JSON(`.drawnix`)
- ⚡ 编辑特性：撤销、重做、复制、粘贴等
- 🌌 无限画布：缩放、滚动
- 🎨 主题模式
- 📱 移动设备适配
- 📈 支持 mermaid 语法转流程图
- ✨ 支持 markdown 文本转思维导图

本项目新增的特性：

- 🖥 **桌面应用**：基于 Tauri 打包，开箱即用，无需部署
- 🗂 **卡片插件**：可插入带有标题、正文与插图的卡片元素，支持填充色、描边样式，可被箭头连线绑定
- 📁 **本地文件管理**：文件树侧边栏，支持新建 / 重命名 / 删除 `.drawnix` 文件与文件夹（分组、子分组）
- 🔀 **目录分组与移动**：文件与分组可拖拽移动到任意分组下，支持自定义排序
- ♻️ **回收站**：删除的文件进入回收站，支持恢复与清空，并可配置保留天数，过期自动清理
- 💾 **保存与自动保存**：顶部工具栏保存按钮、`Cmd/Ctrl+S` 快捷键保存；切换文件、另存为、导出图片前自动保存当前文件的未保存修改
- 📌 **未保存标记**：当前文件存在未保存修改时，在文件面板与标题处显示 dirty 标记
- ⚙️ **数据目录设置**：可自定义 `.drawnix` 文件的本地存储目录，切换时自动迁移已有文件
- 🧭 **桌面端欢迎页**：未打开文件时展示欢迎页，快速开始创作

## 关于名称

***Drawnix***  ，源于绘画(  ***Draw***  )与凤凰(  ***Phoenix***  )的灵感交织。

凤凰象征着生生不息的创造力，而 *Draw* 代表着人类最原始的表达方式。在这里，每一次创作都是一次艺术的涅槃，每一笔绘画都是灵感的重生。

创意如同凤凰，浴火方能重生，而  ***Drawnix***  要做技术与创意之火的守护者。

*Draw Beyond, Rise Above.*


## 与上游项目及 Plait 画图框架

*Drawnix* 的定位是一个开箱即用、开源、免费的工具产品，它的底层是 *Plait* 框架——一款开源画图框架，代表着 PingCode 团队在知识库产品([PingCode Wiki](https://pingcode.com/product/wiki?utm_source=drawnix))上的重要技术沉淀。

*Drawnix* 采用插件架构，能够支持多种 UI 框架（*Angular、React*），能够集成不同富文本框架（当前支持 *Slate* 框架），在开发上可以很好地实现业务的分层，开发各种细粒度的可复用插件，扩展更多的画板应用场景。

本项目（drawnix-desktop）在此基础上：

- 复用上游的 `packages/drawnix`、`packages/react-board`、`packages/react-text` 三个包构成的白板核心，并新增了卡片插件与桌面端文件管理相关代码；
- 通过 `src-tauri` 目录下的 Rust 代码（基于 Tauri 2.x 与 tauri-plugin-dialog）实现本地文件的读写、回收站、数据目录等系统能力，前端通过 Tauri command 调用。

感谢上游项目 [plait-board/drawnix](https://github.com/plait-board/drawnix) 与 [Plait](https://github.com/worktile/plait) 框架的持续开源。

## 仓储结构

```
drawnix-desktop/
├── apps/
│   ├── web                   # Web 应用入口（Vite 构建，桌面端与 Web 版共用）
│   └── web-e2e               # Playwright 端到端测试
├── src-tauri/                # Tauri 桌面端（Rust）
│   ├── src/                  #   本地文件、回收站、数据目录等 Tauri command 实现
│   ├── capabilities/         #   Tauri 权限配置
│   ├── icons/                #   应用图标
│   └── tauri.conf.json       #   Tauri 配置（窗口、打包目标等）
├── packages/
│   ├── drawnix/              # 白板应用核心（含卡片插件、TauriFilePanel、欢迎页等）
│   ├── react-board/          # 白板 React 视图层
│   └── react-text/           # 文本渲染模块
├── scripts/                  # 版本发布与 npm 包发布脚本
├── dist/                     # 构建产物
├── package.json
└── README.md / README_en.md
```

## 在线版本

本项目聚焦桌面端。上游项目的在线版本仍可通过 [*https://drawnix.com*](https://drawnix.com) 访问。

## 开发

### 环境要求

- Node.js（建议使用 [.nvmrc](.nvmrc) 中指定的版本）与 npm
- 本地开发 Web 版无需额外依赖；开发 / 打包桌面端需要安装 [Rust](https://www.rust-lang.org) 及 Tauri 所需的系统依赖（Windows 下为 WebView2、Visual Studio C++ 构建工具，详见 [Tauri 文档](https://tauri.app/start/prerequisites/)）

### Web 版开发

```bash
npm install

npm run start        # 启动 Web 版开发服务器（nx serve web）
```

### 桌面端开发

```bash
npm install

npm run tauri:dev    # 启动 Tauri 桌面端开发模式（自动先执行 nx serve web）
```

### 构建

```bash
npm run build:web    # 仅构建 Web 版（产物位于 dist/apps/web）

npm run tauri:build  # 构建 Web 版并打包桌面应用（Windows 下产出 NSIS / MSI 安装包）
```

桌面端安装包产物位于 `src-tauri/target/release/bundle/` 目录下。打包目标等配置见 [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json)。

### 其他常用命令

```bash
npm run lint         # 使用 oxlint 检查代码
npm run format       # 使用 oxfmt 格式化代码
npm run test         # 运行单元测试
npm run build        # 构建所有可构建项目
```

## Docker

仓库内提供 [Dockerfile](Dockerfile)，用于构建 Web 版静态站点镜像：

```bash
docker build -t drawnix-web .
docker run -p 80:80 drawnix-web
```

## 依赖

- [plait](https://github.com/worktile/plait) - 开源画图框架
- [slate](https://github.com/ianstormtaylor/slate)  - 富文本编辑器框架
- [floating-ui](https://github.com/floating-ui/floating-ui)  - 一个超级好用的创建弹出层基础库
- [tauri](https://github.com/tauri-apps/tauri) - 跨平台桌面应用框架

## 贡献

欢迎任何形式的贡献：

提交 Issue 或 Pull Request 前，请先阅读 [贡献指南](CONTRIBUTING.md)。

- 提 Bug

- 贡献代码

## 感谢支持

特别感谢 [plait-board/drawnix](https://github.com/plait-board/drawnix) 上游团队及 PingCode 公司对开源项目的持续投入，也感谢为本项目贡献代码、提供建议的朋友。

<p align="left">
  <a href="https://pingcode.com?utm_source=drawnix" target="_blank">
      <img src="https://cdn-aliyun.pingcode.com/static/site/img/pingcode-logo.4267e7b.svg" width="120" alt="PingCode" />
  </a>
</p>

## License

[MIT License](LICENSE)

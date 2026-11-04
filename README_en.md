<p align="center">
  <picture style="width: 320px">
    <source media="(prefers-color-scheme: light)" srcset="apps/web/public/logo/logo.svg" />
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/logo/logo.svg" />
    <img src="apps/web/public/logo/logo.svg" width="360" alt="Drawnix logo and name" />
  </picture>
</p>
<div align="center">
  <h2>
    Drawnix Desktop — an open-source whiteboard desktop app built with Tauri, featuring mind mapping, flowcharts, freehand drawing and more.
  <br />
  </h2>
</div>


[*中文 README*](README.md)

## About

**drawnix-desktop** is a **desktop application** derived from the open-source whiteboard tool [plait-board/drawnix](https://github.com/plait-board/drawnix). It wraps the original web app into a cross-platform desktop app with the [Tauri](https://tauri.app) framework, and adds Markdown / table editing, a card plugin and local file management on top of the existing feature set.

Main changes compared to the upstream project:

- **Desktop**: packaged as a desktop app with Tauri 2.x (Rust backend + webview frontend), producing NSIS / MSI installers on Windows;
- **Card Plugin**: insert card elements on the whiteboard. Cards support a title, body text, an image, fill color and stroke styles, and can serve as endpoints for arrow lines;
- **Multi-type local file management**: a file-tree sidebar (TauriFilePanel) built on the Tauri file system, supporting three file types — whiteboard `.drawnix`, Markdown `.md` and table `.table` — stored in a local data directory instead of browser storage;
- **Doc editors and file-reference cards**: Markdown / table files come with dedicated editors (DocEditor), and cards on the whiteboard can reference files to preview their content live.

## Features

Inherited from upstream drawnix:

- 💯 Free and Open Source
- ⚒️ Mind Maps and Flowcharts
- 🖌 Freehand
- 😀 Image Support
- 🚀 Plugin-based Architecture - Extensible
- 🖼️ 📃 Export to PNG, JSON(.drawnix)
- ⚡ Edit Features: Undo, Redo, Copy, Paste, etc.
- 🌌 Infinite Canvas: Zoom, Pan
- 🎨 Theme Support
- 📱 Mobile-friendly
- 📈 Support mermaid syntax conversion to flowchart
- ✨ Support markdown text conversion to mind map

Added by this project:

- 🖥 **Desktop app**: packaged with Tauri, ready to use out of the box, no deployment required
- 📝 **Multiple file types**: the file tree supports creating / opening / editing whiteboard `.drawnix`, Markdown `.md` and table `.table` files
- 📖 **Markdown editor**: source / split / preview view modes, a formatting toolbar, list prefixes continued automatically on Enter, task lists checkable right in the preview, with debounced auto-save
- 📊 **Table editor**: insert / delete rows and columns, merge cells, border styles, font size and text color, cell background color, drag to adjust row heights and column widths, with debounced auto-save
- 🔗 **File-reference cards**: insert a card on the whiteboard that references a `.md` / `.table` file and renders its content live (including task-checkbox interaction); double-click the card to open the editor, and it syncs automatically when the source file changes
- 🗂 **Card plugin**: insert card elements with a title, body text and an image; supports fill color and stroke styles, and can be bound by arrow lines
- 📁 **Local file management**: file-tree sidebar with create / rename / delete for files and folders (groups and sub-groups)
- 🔀 **Groups and moving**: files and groups can be dragged into any group, with custom ordering
- ♻️ **Trash**: deleted files go to the trash, where they can be restored or purged; retention days are configurable and expired items are cleaned up automatically
- 💾 **Save and auto-save**: save via the toolbar button or `Cmd/Ctrl+S`; unsaved changes are saved automatically before switching files, saving a copy, or exporting images
- 📌 **Unsaved-changes marker**: when the current file has unsaved changes, a dirty marker is shown in the file panel and next to the file title
- ⚙️ **Data directory setting**: customize the local data directory where `.drawnix` / `.md` / `.table` files are stored; existing files are migrated when the directory changes
- 🧭 **Desktop welcome page**: a welcome page is shown when no file is open, so you can start creating right away

## About the Name

***Drawnix*** is born from the interweaving of ***Draw*** and ***Phoenix***, a fusion of artistic inspiration.

The *Phoenix* symbolizes endless creativity, while *Draw* represents humanity's most fundamental form of expression. Here, each creation is an artistic rebirth, every stroke a renaissance of inspiration.

Like a Phoenix, creativity must rise from the flames to be reborn, and ***Drawnix*** stands as the guardian of both technical and creative fire.

*Draw Beyond, Rise Above.*

## Relationship with the Upstream Project and the Plait Framework

*Drawnix* is positioned as an out-of-the-box, *open-source*, and free tool product. It is built on top of the *Plait* framework, an *open-source* drawing framework that represents the technical accumulation of the PingCode team in knowledge base products ([PingCode Wiki](https://pingcode.com/product/wiki?utm_source=drawnix)).

*Drawnix* uses a *plugin architecture*: it supports multiple *UI frameworks* (*Angular*, *React*), integrates with different *rich text frameworks* (currently *Slate*), enables clean separation of concerns in development, and allows fine-grained reusable plugins that expand the whiteboard to more scenarios.

Building on that, this project (drawnix-desktop):

- reuses the whiteboard core made up of the `packages/drawnix`, `packages/react-board` and `packages/react-text` packages, and adds the card plugin (including file-reference cards), the Markdown/table doc editors plus desktop-side file management code;
- implements local file read/write, trash and data-directory capabilities for `.drawnix` / `.md` / `.table` files in Rust under `src-tauri` (based on Tauri 2.x and tauri-plugin-dialog), which the frontend calls through Tauri commands.

Many thanks to the upstream project [plait-board/drawnix](https://github.com/plait-board/drawnix) and the [Plait](https://github.com/worktile/plait) framework for keeping their work open source.

## Repository Structure

```
drawnix-desktop/
├── apps/
│   ├── web                   # Web app entry point (built with Vite, shared by desktop and web)
│   └── web-e2e               # Playwright end-to-end tests
├── src-tauri/                # Tauri desktop app (Rust)
│   ├── src/                  #   Tauri commands for local files, trash, data directory, etc.
│   ├── capabilities/         #   Tauri permission configuration
│   ├── icons/                #   App icons
│   └── tauri.conf.json       #   Tauri configuration (window, bundle targets, etc.)
├── packages/
│   ├── drawnix/              # Whiteboard app core (card plugin, doc editors, TauriFilePanel, welcome page, etc.)
│   ├── react-board/          # Whiteboard React view layer
│   └── react-text/           # Text rendering module
├── scripts/                  # Release and npm publishing scripts
├── dist/                     # Build artifacts
├── package.json
└── README.md / README_en.md
```

## Web Version

This project focuses on the desktop app. The upstream project's web version is still available at [*https://drawnix.com*](https://drawnix.com).

## Development

### Prerequisites

- Node.js (preferably the version pinned in [.nvmrc](.nvmrc)) and npm
- Developing the web version requires no extra dependencies; developing or bundling the desktop app requires [Rust](https://www.rust-lang.org) and the system dependencies required by Tauri (WebView2 and the Visual Studio C++ build tools on Windows, see the [Tauri docs](https://tauri.app/start/prerequisites/))

### Developing the Web Version

```bash
npm install

npm run start        # Start the web dev server (nx serve web)
```

### Developing the Desktop App

```bash
npm install

npm run tauri:dev    # Start the Tauri desktop dev mode (runs nx serve web first)
```

### Building

```bash
npm run build:web    # Build the web version only (output in dist/apps/web)

npm run tauri:build  # Build the web version and bundle the desktop app (NSIS / MSI installers on Windows)
```

The desktop installers are emitted to `src-tauri/target/release/bundle/`. Bundle targets and other settings live in [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json).

### Other Useful Commands

```bash
npm run lint         # Lint with oxlint
npm run format       # Format with oxfmt
npm run test         # Run unit tests
npm run build        # Build all buildable projects
```

## Docker

The repo ships a [Dockerfile](Dockerfile) for building a static-site image of the web version:

```bash
docker build -t drawnix-web .
docker run -p 80:80 drawnix-web
```

## Dependencies

- [plait](https://github.com/worktile/plait) - Open source drawing framework
- [slate](https://github.com/ianstormtaylor/slate) - Rich text editor framework
- [floating-ui](https://github.com/floating-ui/floating-ui) - An awesome library for creating floating UI elements
- [tauri](https://github.com/tauri-apps/tauri) - Cross-platform desktop app framework
- [marked](https://github.com/markedjs/marked) - Markdown parser and renderer
- [dompurify](https://github.com/cure53/DOMPurify) - HTML sanitizing library

## Contributing

Any form of contribution is welcome:

Before opening an issue or pull request, please read the [Contributing Guide](CONTRIBUTING.md).

- Report bugs

- Contribute code

## Thank you for supporting

Special thanks to the [plait-board/drawnix](https://github.com/plait-board/drawnix) upstream team and PingCode for their continued investment in open source, and to everyone who contributed code and suggestions to this project.

<p align="left">
  <a href="https://pingcode.com?utm_source=drawnix" target="_blank">
      <img src="https://cdn-aliyun.pingcode.com/static/site/img/pingcode-logo.4267e7b.svg" width="120" alt="PingCode" />
  </a>
</p>

## License

[MIT License](LICENSE)

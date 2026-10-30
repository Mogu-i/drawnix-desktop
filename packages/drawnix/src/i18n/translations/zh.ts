import { Translations } from '../types';

const zhTranslations: Translations = {
  // Toolbar items
  'toolbar.hand': '手形工具 — H',
  'toolbar.selection': '选择 — V',
  'toolbar.mind': '思维导图 — M',
  'toolbar.text': '文本 — T',
  'toolbar.arrow': '箭头 — A',
  'toolbar.shape': '形状',
  'toolbar.image': '图片 — Cmd+U',
  'toolbar.extraTools': '更多工具',
  'toolbar.card': '卡片',
  'card.insertImage': '插入图片',

  'toolbar.pen': '画笔 — P',
  'toolbar.eraser': '橡皮擦 — E',

  'toolbar.arrow.straight': '直线',
  'toolbar.arrow.elbow': '肘线',
  'toolbar.arrow.curve': '曲线',

  'toolbar.shape.rectangle': '长方形 — R',
  'toolbar.shape.ellipse': '圆 — O',
  'toolbar.shape.triangle': '三角形',
  'toolbar.shape.terminal': '开始/结束',
  'toolbar.shape.noteCurlyLeft': '左花括注释',
  'toolbar.shape.noteCurlyRight': '右花括注释',
  'toolbar.shape.diamond': '菱形',
  'toolbar.shape.parallelogram': '平行四边形',
  'toolbar.shape.roundRectangle': '圆角矩形',

  // Zoom controls
  'zoom.in': '放大 — Cmd++',
  'zoom.out': '缩小 — Cmd+-',
  'zoom.fit': '自适应',
  'zoom.100': '缩放至 100%',
  'zoom.fullscreen': '全屏',
  'zoom.exitFullscreen': '退出全屏',

  // Themes
  'theme.default': '默认',
  'theme.colorful': '缤纷',
  'theme.soft': '柔和',
  'theme.retro': '复古',
  'theme.dark': '暗夜',
  'theme.starry': '星空',

  // Colors
  'color.none': '主题颜色',
  'color.unknown': '其他颜色',
  'color.default': '黑色',
  'color.white': '白色',
  'color.gray': '灰色',
  'color.deepBlue': '深蓝色',
  'color.red': '红色',
  'color.green': '绿色',
  'color.yellow': '黄色',
  'color.purple': '紫色',
  'color.orange': '橙色',
  'color.pastelPink': '淡粉色',
  'color.cyan': '青色',
  'color.brown': '棕色',
  'color.forestGreen': '森绿色',
  'color.lightGray': '浅灰色',

  // General
  'general.undo': '撤销',
  'general.redo': '重做',
  'general.menu': '应用菜单',
  'general.moreOptions': '更多选项',
  'general.duplicate': '重复',
  'general.delete': '删除',

  'general.copyToClipboard': '复制到剪贴板',
  'general.copyToClipboard.svg': 'SVG',
  'general.copyToClipboard.png': 'PNG',
  'general.copyToClipboard.transparent': '透明背景',
  'toast.copyToClipboard.svg': '已将所选项作为 SVG 复制到剪贴板',
  'toast.copyToClipboard.png': '已将所选项作为 PNG 复制到剪贴板',
  'toast.copyToClipboard.mode.transparent': '（透明背景）',
  'toast.tauriFile.saved': '已保存',
  'toast.tauriFile.saveFailed': '保存失败',
  'toast.tauriFile.loadFailed': '文件加载失败',
  'toast.tauriFile.renameFailed': '重命名失败，目标文件名可能已存在',
  'toast.tauriFile.exportFailed': '导出失败',
  'toast.tauriFile.deleteFailed': '删除失败',
  'toast.tauriFile.restoreFailed': '恢复失败',

  // Language
  'language.switcher': 'Language',
  'language.chinese': '中文',
  'language.english': 'English',
  'language.russian': 'Русский',
  'language.arabic': 'عربي',
  'language.vietnamese': 'Tiếng Việt',
  // Menu items
  'menu.open': '打开',
  'menu.saveFile': '保存到当前文件',
  'menu.saveTauriFile': '保存到文件',
  'menu.saveAsFile': '另存为',
  'menu.exportImage': '导出图片',
  'menu.exportImage.svg': 'SVG',
  'menu.exportImage.png': 'PNG',
  'menu.exportImage.jpg': 'JPG',
  'menu.cleanBoard': '清除画布',
  'menu.github': 'GitHub',

  // Dialog translations
  'dialog.mermaid.title': 'Mermaid 转 Drawnix',
  'dialog.mermaid.description': '目前仅支持',
  'dialog.mermaid.flowchart': '流程图',
  'dialog.mermaid.sequence': '序列图',
  'dialog.mermaid.class': '类图',
  'dialog.mermaid.otherTypes': '。其他类型在 Drawnix 中将以图片呈现。',
  'dialog.mermaid.syntax': 'Mermaid 语法',
  'dialog.mermaid.placeholder': '在此处编写 Mermaid 图表定义…',
  'dialog.mermaid.preview': '预览',
  'dialog.mermaid.insert': '插入',
  'dialog.markdown.description': '支持 Markdown 语法自动转换为思维导图。',
  'dialog.markdown.syntax': 'Markdown 语法',
  'dialog.markdown.placeholder': '在此处编写 Markdown 文本定义…',
  'dialog.markdown.preview': '预览',
  'dialog.markdown.insert': '插入',
  'dialog.error.loadMermaid': '加载 Mermaid 库失败',

  // Extra tools menu items
  'extraTools.mermaidToDrawnix': 'Mermaid 到 Drawnix',
  'extraTools.markdownToDrawnix': 'Markdown 到 Drawnix',

  // Clean confirm dialog
  'cleanConfirm.title': '清除画布',
  'cleanConfirm.description': '这将会清除整个画布。你是否要继续?',
  'cleanConfirm.cancel': '取消',
  'cleanConfirm.ok': '确认',

  // Tauri file panel
  'filePanel.title': '文件',
  'filePanel.newFile': '新建',
  'filePanel.newFilePlaceholder': '输入文件名…',
  'filePanel.empty': '暂无 .drawnix 文件',
  'filePanel.rename': '重命名',
  'filePanel.trash': '回收站',
  'filePanel.trashEmpty': '回收站为空',
  'filePanel.newFolder': '新建分组',
  'filePanel.newSubFolder': '新建子分组',
  'filePanel.newFolderPlaceholder': '输入分组名…',
  'filePanel.folderLocation': '所在分组',
  'filePanel.defaultLocation': '根目录',
  'filePanel.saveAs': '另存为',
  'filePanel.exportImage': '导出图片',
  'filePanel.restore': '恢复',
  'filePanel.delete': '删除',
  'filePanel.move': '移动到…',
  'filePanel.emptyTrash': '清空回收站',

  // Delete confirm dialog (move to trash)
  'deleteConfirm.title': '删除文件',
  'deleteConfirm.description': '文件将被移入回收站，超过保留天数后自动清除。是否继续？',
  'deleteConfirm.ok': '删除',

  // Delete folder confirm dialog
  'folderDeleteConfirm.title': '删除分组',
  'folderDeleteConfirm.description':
    '分组内的所有文件将移入回收站，超过保留天数后自动清除。是否继续？',

  // Move entry dialog
  'moveDialog.title': '选择目标分组',

  // Empty trash confirm dialog
  'emptyTrashConfirm.title': '清空回收站',
  'emptyTrashConfirm.description': '回收站中的所有文件将被永久删除，此操作不可恢复。是否继续？',
  'emptyTrashConfirm.ok': '清空',

  // Settings dialog
  'settings.title': '设置',
  'settings.language': '语言',
  'settings.dataDir': '数据存储路径',
  'settings.dataDirBrowse': '浏览…',
  'settings.dataDirHint':
    '修改路径后，现有 .drawnix 文件会自动迁移到新路径（原文件保留作为备份）。',
  'settings.dataDirMigrating': '迁移中…',
  'settings.dataDirMigratedFiles': '个文件已迁移至新路径',
  'settings.dataDirSamePath': '新路径与当前路径相同',
  'settings.dataDirMigrateFailed': '数据迁移失败',
  'settings.trashRetentionDays': '回收站保留天数',
  'settings.trashRetentionUnit': '天',

  // Login
  'login.button': '登录',
  'login.notAvailable': '登录功能暂未开放',

  // Welcome page (Tauri desktop)
  'welcome.title': '欢迎使用 Drawnix',
  'welcome.description': '一体化白板：思维导图、流程图、自由画笔，数据保存在本地文件中',
  'welcome.newFile': '新建文件',
  'welcome.sidebarHint': '或从左侧列表打开已有文件',

  // Link popup items
  'popupLink.delLink': '移除连结',

  // Tool popup items
  'popupToolbar.fillColor': '填充颜色',
  'popupToolbar.fontSize': '字号',
  'popupToolbar.fontColor': '字体颜色',
  'popupToolbar.link': '链接',
  'popupToolbar.stroke': '边框',
  'popupToolbar.opacity': '不透明度',

  // Text placeholders
  'textPlaceholders.link': '链接',
  'textPlaceholders.text': '文本',

  // Line tool
  'line.source': '起点',
  'line.target': '终点',
  'line.arrow': '箭头',
  'line.none': '无',

  // Stroke style
  'stroke.solid': '实线',
  'stroke.dashed': '虚线',
  'stroke.dotted': '点线',

  // Draw elements text
  'draw.lineText': '文本',
  'draw.geometryText': '文本',

  // Mind map elements text
  'mind.centralText': '中心主题',
  'mind.abstractNodeText': '摘要',

  //markdown example
  'markdown.example': `# 我开始了

  - 让我看看是谁搞出了这个 bug 🕵️ ♂️ 🔍
    - 😯 💣
      - 原来是我 👈 🎯 💘

  - 竟然不可以运行，为什么呢 🚫 ⚙️ ❓
    - 竟然可以运行了，为什么呢？🎢 ✨
      - 🤯 ⚡ ➡️ 🎉

  - 能运行起来的 🐞 🚀
    - 就不要去动它 🛑 ✋
      - 👾 💥 🏹 🎯

  ## 男孩还是女孩 👶 ❓ 🤷 ♂️ ♀️

  ### Hello world 👋 🌍 ✨ 💻

  #### 哇 是个程序员 🤯 ⌨️ 💡 👩 💻`,

  'tutorial.title': 'Drawnix',
  'tutorial.description': 'All-in-one 白板，包含思维导图、流程图、自由画笔等',
  'tutorial.dataDescription': '所有数据被存在你的浏览器本地',
  'tutorial.appToolbar': '导出，语言设置，...',
  'tutorial.creationToolbar': '选择一个工具开始你的创作',
  'tutorial.themeDescription': '在明亮和黑暗主题之间切换',
};

export default zhTranslations;

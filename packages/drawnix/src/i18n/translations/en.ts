import { Translations } from '../types';

const enTranslations: Translations = {
  // Toolbar items
  'toolbar.hand': 'Hand — H',
  'toolbar.selection': 'Selection — V',
  'toolbar.mind': 'Mind — M',
  'toolbar.text': 'Text — T',
  'toolbar.arrow': 'Arrow — A',
  'toolbar.shape': 'Shape',
  'toolbar.image': 'Image — Cmd+U',
  'toolbar.extraTools': 'Extra Tools',
  'toolbar.card': 'Card',
  'card.insertImage': 'Insert Image',
  'card.fileRef.loading': 'Loading…',
  'card.fileRef.missing': 'File not found or has been moved/deleted',
  'card.fileRef.openHint': 'Double-click to edit',

  'toolbar.pen': 'Pen — P',
  'toolbar.eraser': 'Eraser — E',

  'toolbar.arrow.straight': 'Straight Arrow Line',
  'toolbar.arrow.elbow': 'Elbow Arrow Line',
  'toolbar.arrow.curve': 'Curve Arrow Line',

  'toolbar.shape.rectangle': 'Rectangle — R',
  'toolbar.shape.ellipse': 'Ellipse — O',
  'toolbar.shape.triangle': 'Triangle',
  'toolbar.shape.terminal': 'Terminal',
  'toolbar.shape.noteCurlyLeft': 'Curly Note — Left',
  'toolbar.shape.noteCurlyRight': 'Curly Note — Right',
  'toolbar.shape.diamond': 'Diamond',
  'toolbar.shape.parallelogram': 'Parallelogram',
  'toolbar.shape.roundRectangle': 'Round Rectangle',

  // Zoom controls
  'zoom.in': 'Zoom In — Cmd++',
  'zoom.out': 'Zoom Out — Cmd+-',
  'zoom.fit': 'Fit to Screen',
  'zoom.100': 'Zoom to 100%',
  'zoom.fullscreen': 'Fullscreen',
  'zoom.exitFullscreen': 'Exit Fullscreen',
  'zoom.showToolbar': 'Show toolbar',
  'zoom.hideToolbar': 'Hide toolbar',

  // Themes
  'theme.default': 'Default',
  'theme.colorful': 'Colorful',
  'theme.soft': 'Soft',
  'theme.retro': 'Retro',
  'theme.dark': 'Dark',
  'theme.starry': 'Starry',

  // Colors
  'color.none': 'Topic Color',
  'color.unknown': 'Other Color',
  'color.default': 'Basic Black',
  'color.white': 'White',
  'color.gray': 'Grey',
  'color.deepBlue': 'Deep Blue',
  'color.red': 'Red',
  'color.green': 'Green',
  'color.yellow': 'Yellow',
  'color.purple': 'Purple',
  'color.orange': 'Orange',
  'color.pastelPink': 'Paster Pink',
  'color.cyan': 'Cyan',
  'color.brown': 'Brown',
  'color.forestGreen': 'Forest Green',
  'color.lightGray': 'Light Grey',

  // General
  'general.undo': 'Undo',
  'general.redo': 'Redo',
  'general.menu': 'App Menu',
  'general.moreOptions': 'More Options',
  'general.duplicate': 'Duplicate',
  'general.delete': 'Delete',
  'general.copyToClipboard': 'Copy to Clipboard',
  'general.copyToClipboard.svg': 'SVG',
  'general.copyToClipboard.png': 'PNG',
  'general.copyToClipboard.transparent': 'Transparent',
  'toast.copyToClipboard.svg': 'Copied selected items as SVG to clipboard',
  'toast.copyToClipboard.png': 'Copied selected items as PNG to clipboard',
  'toast.copyToClipboard.mode.transparent': '(Transparent background)',
  'toast.tauriFile.saved': 'Saved',
  'toast.tauriFile.saveFailed': 'Save failed',
  'toast.tauriFile.loadFailed': 'Failed to load file',
  'toast.tauriFile.renameFailed': 'Rename failed, target name may already exist',
  'toast.tauriFile.exportFailed': 'Export failed',
  'toast.tauriFile.deleteFailed': 'Delete failed',
  'toast.tauriFile.restoreFailed': 'Restore failed',
  'toast.tauriFile.createFolderFailed':
    'Failed to create folder. A folder with the same name may already exist',
  // Language
  'language.switcher': 'Language',
  'language.chinese': '中文',
  'language.english': 'English',
  'language.russian': 'Русский',
  'language.arabic': 'عربي',
  'language.vietnamese': 'Tiếng Việt',
  // Menu items
  'menu.open': 'Open',
  'menu.saveFile': 'Save to current file',
  'menu.saveTauriFile': 'Save to file',
  'menu.saveAsFile': 'Save As',
  'menu.exportImage': 'Export Image',
  'menu.exportImage.svg': 'SVG',
  'menu.exportImage.png': 'PNG',
  'menu.exportImage.jpg': 'JPG',
  'menu.cleanBoard': 'Clear Board',
  'menu.github': 'GitHub',

  // Dialog translations
  'dialog.mermaid.title': 'Mermaid to Drawnix',
  'dialog.mermaid.description': 'Currently supports',
  'dialog.mermaid.flowchart': 'flowcharts',
  'dialog.mermaid.sequence': 'sequence diagrams',
  'dialog.mermaid.class': 'class diagrams',
  'dialog.mermaid.otherTypes': ', and other diagram types (rendered as images).',
  'dialog.mermaid.syntax': 'Mermaid Syntax',
  'dialog.mermaid.placeholder': 'Write your Mermaid chart definition here…',
  'dialog.mermaid.preview': 'Preview',
  'dialog.mermaid.insert': 'Insert',
  'dialog.markdown.description': 'Supports automatic conversion of Markdown syntax to mind map.',
  'dialog.markdown.syntax': 'Markdown Syntax',
  'dialog.markdown.placeholder': 'Write your Markdown text definition here...',
  'dialog.markdown.preview': 'Preview',
  'dialog.markdown.insert': 'Insert',
  'dialog.error.loadMermaid': 'Failed to load Mermaid library',

  // Extra tools menu items
  'extraTools.mermaidToDrawnix': 'Mermaid to Drawnix',
  'extraTools.markdownToDrawnix': 'Markdown to Drawnix',

  // Clean confirm dialog
  'cleanConfirm.title': 'Clear Board',
  'cleanConfirm.description': 'This will clear the entire board. Do you want to continue?',
  'cleanConfirm.cancel': 'Cancel',
  'cleanConfirm.ok': 'OK',

  // Tauri file panel
  'filePanel.title': 'Files',
  'filePanel.newFile': 'New',
  'filePanel.newFilePlaceholder': 'New file name…',
  'filePanel.empty': 'No files yet',
  'filePanel.rename': 'Rename',
  'filePanel.trash': 'Trash',
  'filePanel.trashEmpty': 'Trash is empty',
  'filePanel.newFolder': 'New group',
  'filePanel.newSubFolder': 'New subgroup',
  'filePanel.newFolderPlaceholder': 'Group name…',
  'filePanel.folderLocation': 'Folder',
  'filePanel.defaultLocation': 'Top level',
  'filePanel.saveAs': 'Save as',
  'filePanel.exportImage': 'Export image',
  'filePanel.restore': 'Restore',
  'filePanel.delete': 'Delete',
  'filePanel.move': 'Move to…',
  'filePanel.emptyTrash': 'Empty trash',

  // New file dialog: file types
  'filePanel.fileName': 'File name',
  'filePanel.fileType': 'File type',
  'filePanel.fileType.drawnix': 'Board',
  'filePanel.fileType.md': 'Markdown',
  'filePanel.fileType.table': 'Table',
  'filePanel.tableRows': 'Rows',
  'filePanel.tableCols': 'Columns',

  // Table editor
  'table.insertRow': 'Insert row',
  'table.deleteRow': 'Delete row',
  'table.insertCol': 'Insert column',
  'table.deleteCol': 'Delete column',
  'table.merge': 'Merge cells',
  'table.unmerge': 'Unmerge',
  'table.border': 'Border',
  'table.borderAll': 'All borders',
  'table.borderNone': 'No border',
  'table.borderOuter': 'Outer border',
  'table.selectionHint':
    'Click to select, drag or Shift+click for multi-select, double-click or Enter to edit, drag table edges to resize rows and columns; Tab/arrow keys to navigate cells',
  'table.alignLeft': 'Align left',
  'table.alignCenter': 'Align center',
  'table.alignRight': 'Align right',
  'table.alignTop': 'Align top',
  'table.alignMiddle': 'Align middle',
  'table.alignBottom': 'Align bottom',
  'table.bold': 'Bold',
  'table.underline': 'Underline',
  'table.strikethrough': 'Strikethrough',

  // Markdown editor
  'markdown.placeholder': 'Type Markdown here…',
  'markdown.mode.label': 'View mode',
  'markdown.mode.code': 'Code',
  'markdown.mode.split': 'Split',
  'markdown.mode.preview': 'Preview',
  'markdown.toolbar.bold': 'Bold',
  'markdown.toolbar.italic': 'Italic',
  'markdown.toolbar.strikethrough': 'Strikethrough',
  'markdown.toolbar.heading1': 'Heading 1',
  'markdown.toolbar.heading2': 'Heading 2',
  'markdown.toolbar.heading3': 'Heading 3',
  'markdown.toolbar.unorderedList': 'Bulleted list',
  'markdown.toolbar.orderedList': 'Numbered list',
  'markdown.toolbar.taskList': 'Task list',
  'markdown.toolbar.quote': 'Quote',
  'markdown.toolbar.inlineCode': 'Inline code',
  'markdown.toolbar.codeBlock': 'Code block',
  'markdown.toolbar.link': 'Link',
  'markdown.toolbar.image': 'Image',
  'markdown.toolbar.table': 'Table',
  'markdown.toolbar.horizontalRule': 'Horizontal rule',
  'markdown.tableTemplate': '| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n|  |  |  |',
  'markdown.linkPlaceholder': 'link text',
  'markdown.imagePlaceholder': 'image alt',

  // Delete confirm dialog (move to trash)
  'deleteConfirm.title': 'Delete file',
  'deleteConfirm.description':
    'The file will be moved to the trash and permanently removed after the retention period. Continue?',
  'deleteConfirm.ok': 'Delete',

  // Delete folder confirm dialog
  'folderDeleteConfirm.title': 'Delete folder',
  'folderDeleteConfirm.description':
    'The folder will be deleted. Files and subfolders inside will be moved to the top level. Continue?',

  // Move entry dialog
  'moveDialog.title': 'Choose destination folder',

  // Empty trash confirm dialog
  'emptyTrashConfirm.title': 'Empty trash',
  'emptyTrashConfirm.description':
    'All files in the trash will be permanently deleted. This cannot be undone. Continue?',
  'emptyTrashConfirm.ok': 'Empty',

  // Settings dialog
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.dataDir': 'Data storage path',
  'settings.dataDirBrowse': 'Browse…',
  'settings.dataDirHint':
    'After changing the path, existing files (boards/Markdown/tables) are migrated to the new location automatically (original files are kept as backup).',
  'settings.dataDirMigrating': 'Migrating…',
  'settings.dataDirMigratedFiles': 'files migrated to the new path',
  'settings.dataDirSamePath': 'New path is the same as the current one',
  'settings.dataDirMigrateFailed': 'Failed to migrate data',
  'settings.trashRetentionDays': 'Trash retention (days)',
  'settings.trashRetentionUnit': 'days',

  // Login
  'login.button': 'Log in',
  'login.notAvailable': 'Login is not available yet',

  // Workbench chrome (tab bar / right file panel / window controls)
  'workbench.brand.name': '思画',
  'workbench.brand.en': 'DRAWNIX',
  'workbench.tab.more': 'More actions',
  'workbench.tab.dirtySuffix': 'Unsaved changes',
  'workbench.tab.closeTab': 'Close tab',
  'workbench.tab.collapsePanel': 'Collapse file panel',
  'workbench.tab.windowMenu': 'Window',
  'workbench.window.group': 'Window',
  'workbench.window.minimize': 'Minimize',
  'workbench.window.maximize': 'Maximize',
  'workbench.window.restore': 'Restore down',
  'workbench.window.close': 'Close',
  'workbench.window.minimizeWindow': 'Minimize window',
  'workbench.window.maximizeWindow': 'Maximize window',
  'workbench.window.restoreWindow': 'Restore window',
  'workbench.window.closeWindow': 'Close window',
  'workbench.window.maximizedToast': 'Maximized',
  'workbench.window.restoredToast': 'Restored to window',
  'workbench.window.recoveredToast': 'Window restored',
  'workbench.panel.newBoard': 'New board',
  'workbench.panel.newTable': 'New table',
  'workbench.panel.newMd': 'New Markdown',
  'workbench.panel.newFolder': 'New folder',
  'workbench.panel.newMore': 'Choose what to create',
  'workbench.panel.folderItems': '{count} items',
  'workbench.create.nameEmpty': 'Please enter a file name',
  'workbench.create.nameDuplicate': 'A file with this name already exists. Please choose another one.',
  'workbench.create.folderLocation': 'Folder',
  'workbench.save.success': 'Saved "{name}" to local file',
  'workbench.save.noFile': 'Open a file first',
  'workbench.exit.title': 'Exit Drawnix',
  'workbench.exit.dirtyDescription':
    '{count} files still have unsaved changes. Your content stays on this device, and you can continue editing after reopening.',
  'workbench.exit.cleanDescription': 'All files are saved. You can reopen and continue editing anytime.',
  'workbench.exit.cancel': 'Cancel',
  'workbench.exit.confirm': 'Exit',

  // Welcome page (Tauri desktop)
  'welcome.title': 'Welcome to Drawnix',
  'welcome.description':
    'All-in-one whiteboard with mind maps, flowcharts and freehand drawing. Your data is stored in local files.',
  'welcome.newFile': 'New file',
  'welcome.sidebarHint': 'Or open an existing file from the sidebar',
  'welcome.emptyTitle': 'No file open',
  'welcome.emptyDescription':
    'Create a board, table or Markdown, or pick a file from the tab bar above to continue editing.',

  // Link popup items
  'popupLink.delLink': 'Delete Link',

  // Tool popup items
  'popupToolbar.fillColor': 'Fill Color',
  'popupToolbar.fontSize': 'Font Size',
  'popupToolbar.fontColor': 'Font Color',
  'popupToolbar.link': 'Insert Link',
  'popupToolbar.stroke': 'Stroke',
  'popupToolbar.opacity': 'Opacity',

  // Text placeholders
  'textPlaceholders.link': 'Link',
  'textPlaceholders.text': 'Text',

  // Line tool
  'line.source': 'Start',
  'line.target': 'End',
  'line.arrow': 'Arrow',
  'line.none': 'None',

  // Stroke style
  'stroke.solid': 'Solid',
  'stroke.dashed': 'Dashed',
  'stroke.dotted': 'Dotted',

  //markdown example
  'markdown.example': `# I have started

  - Let me see who made this bug 🕵️ ♂️ 🔍
    - 😯 💣
      - Turns out it was me 👈 🎯 💘

  - Unexpectedly, it cannot run; why is that 🚫 ⚙️ ❓
    - Unexpectedly, it can run now; why is that? 🎢 ✨
      - 🤯 ⚡ ➡️ 🎉

  - What can run 🐞 🚀
    - then do not touch it 🛑 ✋
      - 👾 💥 🏹 🎯

  ## Boy or girl 👶 ❓ 🤷 ♂️ ♀️

  ### Hello world 👋 🌍 ✨ 💻

  #### Wow, a programmer 🤯 ⌨️ 💡 👩 💻`,

  // Draw elements text
  'draw.lineText': 'Text',
  'draw.geometryText': 'Text',

  // Mind map elements text
  'mind.centralText': 'Central Topic',
  'mind.abstractNodeText': 'Summary',

  'tutorial.title': 'Drawnix',
  'tutorial.description':
    'All-in-one whiteboard, including mind maps, flowcharts, free drawing, and more',
  'tutorial.dataDescription': 'All data is stored locally in your browser',
  'tutorial.appToolbar': 'Export, language settings, ...',
  'tutorial.creationToolbar': 'Select a tool to start your creation',
  'tutorial.themeDescription': 'Switch between light and dark themes',
};

export default enTranslations;

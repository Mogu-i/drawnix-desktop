import { ReactNode } from 'react';

// Define supported languages
export type Language = 'zh' | 'en' | 'ru' | 'ar' | 'vi';

// Define translation keys and their corresponding values
export interface Translations {
  // Toolbar items
  'toolbar.hand': string;
  'toolbar.selection': string;
  'toolbar.mind': string;
  'toolbar.text': string;
  'toolbar.arrow': string;
  'toolbar.shape': string;
  'toolbar.image': string;
  'toolbar.extraTools': string;
  'toolbar.card': string;
  'card.insertImage': string;

  'toolbar.pen': string;
  'toolbar.eraser': string;

  'toolbar.arrow.straight': string;
  'toolbar.arrow.elbow': string;
  'toolbar.arrow.curve': string;

  'toolbar.shape.rectangle': string;
  'toolbar.shape.ellipse': string;
  'toolbar.shape.triangle': string;
  'toolbar.shape.terminal': string;
  'toolbar.shape.noteCurlyLeft': string;
  'toolbar.shape.noteCurlyRight': string;
  'toolbar.shape.diamond': string;
  'toolbar.shape.parallelogram': string;
  'toolbar.shape.roundRectangle': string;

  // Zoom controls
  'zoom.in': string;
  'zoom.out': string;
  'zoom.fit': string;
  'zoom.100': string;
  'zoom.fullscreen': string;
  'zoom.exitFullscreen': string;

  // Themes
  'theme.default': string;
  'theme.colorful': string;
  'theme.soft': string;
  'theme.retro': string;
  'theme.dark': string;
  'theme.starry': string;

  // Colors
  'color.none': string;
  'color.unknown': string;
  'color.default': string;
  'color.white': string;
  'color.gray': string;
  'color.deepBlue': string;
  'color.red': string;
  'color.green': string;
  'color.yellow': string;
  'color.purple': string;
  'color.orange': string;
  'color.pastelPink': string;
  'color.cyan': string;
  'color.brown': string;
  'color.forestGreen': string;
  'color.lightGray': string;

  // General
  'general.undo': string;
  'general.redo': string;
  'general.menu': string;
  'general.moreOptions': string;
  'general.duplicate': string;
  'general.delete': string;
  'general.copyToClipboard': string;
  'general.copyToClipboard.svg': string;
  'general.copyToClipboard.png': string;
  'general.copyToClipboard.transparent': string;
  'toast.copyToClipboard.svg': string;
  'toast.copyToClipboard.png': string;
  'toast.copyToClipboard.mode.transparent': string;
  'toast.tauriFile.saved': string;
  'toast.tauriFile.saveFailed': string;
  'toast.tauriFile.loadFailed': string;
  'toast.tauriFile.renameFailed': string;
  'toast.tauriFile.exportFailed': string;
  'toast.tauriFile.deleteFailed': string;
  'toast.tauriFile.restoreFailed': string;

  // Language
  'language.switcher': string;
  'language.chinese': string;
  'language.english': string;
  'language.russian': string;
  'language.arabic': string;
  'language.vietnamese': string;

  // Menu items
  'menu.open': string;
  'menu.saveFile': string;
  'menu.saveTauriFile': string;
  'menu.saveAsFile': string;
  'menu.exportImage': string;
  'menu.exportImage.svg': string;
  'menu.exportImage.png': string;
  'menu.exportImage.jpg': string;
  'menu.cleanBoard': string;
  'menu.github': string;

  // Dialog translations
  'dialog.mermaid.title': string;
  'dialog.mermaid.description': string;
  'dialog.mermaid.flowchart': string;
  'dialog.mermaid.sequence': string;
  'dialog.mermaid.class': string;
  'dialog.mermaid.otherTypes': string;
  'dialog.mermaid.syntax': string;
  'dialog.mermaid.placeholder': string;
  'dialog.mermaid.preview': string;
  'dialog.mermaid.insert': string;
  'dialog.markdown.description': string;
  'dialog.markdown.syntax': string;
  'dialog.markdown.placeholder': string;
  'dialog.markdown.preview': string;
  'dialog.markdown.insert': string;
  'dialog.error.loadMermaid': string;

  // Extra tools menu items
  'extraTools.mermaidToDrawnix': string;
  'extraTools.markdownToDrawnix': string;

  // Clean confirm dialog
  'cleanConfirm.title': string;
  'cleanConfirm.description': string;
  'cleanConfirm.cancel': string;
  'cleanConfirm.ok': string;

  // Tauri file panel
  'filePanel.title': string;
  'filePanel.newFile': string;
  'filePanel.newFilePlaceholder': string;
  'filePanel.empty': string;
  'filePanel.rename': string;
  'filePanel.trash': string;
  'filePanel.trashEmpty': string;
  'filePanel.newFolder': string;
  'filePanel.newSubFolder': string;
  'filePanel.newFolderPlaceholder': string;
  'filePanel.folderLocation': string;
  'filePanel.defaultLocation': string;
  'filePanel.saveAs': string;
  'filePanel.exportImage': string;
  'filePanel.restore': string;
  'filePanel.delete': string;
  'filePanel.move': string;
  'filePanel.emptyTrash': string;

  // Delete confirm dialog (move to trash)
  'deleteConfirm.title': string;
  'deleteConfirm.description': string;
  'deleteConfirm.ok': string;

  // Delete folder confirm dialog
  'folderDeleteConfirm.title': string;
  'folderDeleteConfirm.description': string;

  // Move entry dialog
  'moveDialog.title': string;

  // Empty trash confirm dialog
  'emptyTrashConfirm.title': string;
  'emptyTrashConfirm.description': string;
  'emptyTrashConfirm.ok': string;

  // Settings dialog
  'settings.title': string;
  'settings.language': string;
  'settings.dataDir': string;
  'settings.dataDirBrowse': string;
  'settings.dataDirHint': string;
  'settings.dataDirMigrating': string;
  'settings.dataDirMigratedFiles': string;
  'settings.dataDirSamePath': string;
  'settings.dataDirMigrateFailed': string;
  'settings.trashRetentionDays': string;
  'settings.trashRetentionUnit': string;

  // Login
  'login.button': string;
  'login.notAvailable': string;

  // Welcome page (Tauri desktop)
  'welcome.title': string;
  'welcome.description': string;
  'welcome.newFile': string;
  'welcome.sidebarHint': string;

  // Link popup items
  'popupLink.delLink': string;

  // Tool popup items
  'popupToolbar.fillColor': string;
  'popupToolbar.fontSize': string;
  'popupToolbar.fontColor': string;
  'popupToolbar.link': string;
  'popupToolbar.stroke': string;
  'popupToolbar.opacity': string;

  // Text placeholders
  'textPlaceholders.link': string;
  'textPlaceholders.text': string;

  // Line tool
  'line.source': string;
  'line.target': string;
  'line.arrow': string;
  'line.none': string;

  // Stroke style
  'stroke.solid': string;
  'stroke.dashed': string;
  'stroke.dotted': string;

  //markdown example
  'markdown.example': string;

  // Draw elements text
  'draw.lineText': string;
  'draw.geometryText': string;

  // Mind map elements text
  'mind.centralText': string;
  'mind.abstractNodeText': string;

  'tutorial.title': string;
  'tutorial.description': string;
  'tutorial.dataDescription': string;
  'tutorial.appToolbar': string;
  'tutorial.creationToolbar': string;
  'tutorial.themeDescription': string;
}

// I18n context interface
export interface I18nContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: keyof Translations) => string;
}

// Provider props
export interface I18nProviderProps {
  children: ReactNode;
  defaultLanguage?: Language;
  initialLanguage?: Language;
  onLanguageChange?: (language: Language) => void;
}

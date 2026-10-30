import { Translations } from '../types';

const arTranslations: Translations = {
  // Toolbar items
  'toolbar.hand': 'اليد — H',
  'toolbar.selection': 'التحديد — V',
  'toolbar.mind': 'خريطة ذهنية — M',
  'toolbar.eraser': 'ممحاة — E',
  'toolbar.text': 'نص — T',
  'toolbar.pen': 'قلم — P',
  'toolbar.arrow': 'سهم — A',
  'toolbar.shape': 'أشكال',
  'toolbar.image': 'صورة — Cmd+U',
  'toolbar.extraTools': 'أدوات إضافية',
  "toolbar.card": "بطاقة",
  "card.insertImage": "إدراج صورة",

  'toolbar.arrow.straight': 'سهم مستقيم',
  'toolbar.arrow.elbow': 'سهم بزوايا',
  'toolbar.arrow.curve': 'سهم منحني',

  'toolbar.shape.rectangle': 'مستطيل — R',
  'toolbar.shape.ellipse': 'بيضاوي — O',
  'toolbar.shape.triangle': 'مثلث',
  'toolbar.shape.terminal': 'نهائي',
  'toolbar.shape.noteCurlyLeft': 'ملاحظة معقوفة — يسار',
  'toolbar.shape.noteCurlyRight': 'ملاحظة معقوفة — يمين',
  'toolbar.shape.diamond': 'معين',
  'toolbar.shape.parallelogram': 'متوازي أضلاع',
  'toolbar.shape.roundRectangle': 'مستطيل دائري الحواف',

  // Zoom controls
  'zoom.in': 'تكبير — Cmd++',
  'zoom.out': 'تصغير — Cmd+-',
  'zoom.fit': 'ملاءمة الشاشة',
  'zoom.100': 'تكبير إلى 100%',
  'zoom.fullscreen': 'ملء الشاشة',
  'zoom.exitFullscreen': 'إنهاء ملء الشاشة',

  // Themes
  'theme.default': 'افتراضي',
  'theme.colorful': 'ملون',
  'theme.soft': 'ناعم',
  'theme.retro': 'كلاسيكي',
  'theme.dark': 'داكن',
  'theme.starry': 'ليلي',

  // Colors
  'color.none': 'لون الموضوع',
  'color.unknown': 'لون آخر',
  'color.default': 'أسود أساسي',
  'color.white': 'أبيض',
  'color.gray': 'رمادي',
  'color.deepBlue': 'أزرق غامق',
  'color.red': 'أحمر',
  'color.green': 'أخضر',
  'color.yellow': 'أصفر',
  'color.purple': 'بنفسجي',
  'color.orange': 'برتقالي',
  'color.pastelPink': 'وردي فاتح',
  'color.cyan': 'سماوي',
  'color.brown': 'بني',
  'color.forestGreen': 'أخضر غامق (غابة)',
  'color.lightGray': 'رمادي فاتح',

  // General
  'general.undo': 'تراجع',
  'general.redo': 'إعادة',
  'general.menu': 'قائمة التطبيق',
  'general.moreOptions': 'خيارات إضافية',
  'general.duplicate': 'تكرار',
  'general.delete': 'حذف',

  // Language
  'language.switcher': 'اللغة',
  'language.chinese': '中文',
  'language.english': 'English',
  'language.russian': 'Русский',
  'language.arabic': 'عربي',
  'language.vietnamese': 'Tiếng Việt',
  'general.copyToClipboard': 'نسخ إلى الحافظة',
  'general.copyToClipboard.svg': 'SVG',
  'general.copyToClipboard.png': 'PNG',
  'general.copyToClipboard.transparent': 'خلفية شفافة',
  'toast.copyToClipboard.svg': 'تم نسخ العناصر المحددة كـ SVG إلى الحافظة',
  'toast.copyToClipboard.png': 'تم نسخ العناصر المحددة كـ PNG إلى الحافظة',
  'toast.copyToClipboard.mode.transparent': '(خلفية شفافة)',
  'toast.tauriFile.saved': 'تم الحفظ',
  'toast.tauriFile.saveFailed': 'فشل الحفظ',
  'toast.tauriFile.loadFailed': 'فشل تحميل الملف',
  'toast.tauriFile.renameFailed': 'فشلت إعادة التسمية، قد يكون الاسم مستخدماً بالفعل',
  'toast.tauriFile.exportFailed': 'فشل التصدير',
  'toast.tauriFile.deleteFailed': 'فشل الحذف',
  'toast.tauriFile.restoreFailed': 'فشل الاستعادة',

  // Menu items
  'menu.open': 'فتح',
  'menu.saveFile': 'حفظ إلى الملف الحالي',
  'menu.saveTauriFile': 'حفظ إلى ملف',
  'menu.saveAsFile': 'حفظ باسم',
  'menu.exportImage': 'تصدير صورة',
  'menu.exportImage.svg': 'SVG',
  'menu.exportImage.png': 'PNG',
  'menu.exportImage.jpg': 'JPG',
  'menu.cleanBoard': 'مسح اللوحة',
  'menu.github': 'غيت هب',

  // Dialog translations
  'dialog.mermaid.title': 'من Mermaid إلى Drawnix',
  'dialog.mermaid.description': 'يدعم حاليًا',
  'dialog.mermaid.flowchart': 'المخططات الانسيابية',
  'dialog.mermaid.sequence': 'مخططات التسلسل',
  'dialog.mermaid.class': 'مخططات الفئات',
  'dialog.mermaid.otherTypes': '، وأنواع أخرى من المخططات (تُعرض كصور).',
  'dialog.mermaid.syntax': 'صيغة Mermaid',
  'dialog.mermaid.placeholder': 'اكتب تعريف المخطط هنا...',
  'dialog.mermaid.preview': 'معاينة',
  'dialog.mermaid.insert': 'إدراج',
  'dialog.markdown.description': 'يدعم التحويل التلقائي من Markdown إلى خريطة ذهنية.',
  'dialog.markdown.syntax': 'صيغة Markdown',
  'dialog.markdown.placeholder': 'اكتب نص Markdown هنا...',
  'dialog.markdown.preview': 'معاينة',
  'dialog.markdown.insert': 'إدراج',
  'dialog.error.loadMermaid': 'فشل في تحميل مكتبة Mermaid',

  // Extra tools menu items
  'extraTools.mermaidToDrawnix': 'من Mermaid إلى Drawnix',
  'extraTools.markdownToDrawnix': 'من Markdown إلى Drawnix',

  // Clean confirm dialog
  'cleanConfirm.title': 'مسح اللوحة',
  'cleanConfirm.description': 'سيؤدي هذا إلى مسح اللوحة بالكامل. هل تريد المتابعة؟',
  'cleanConfirm.cancel': 'إلغاء',
  'cleanConfirm.ok': 'موافق',

  // Tauri file panel
  'filePanel.title': 'الملفات',
  'filePanel.newFile': 'جديد',
  'filePanel.newFilePlaceholder': 'اسم الملف الجديد…',
  'filePanel.empty': 'لا توجد ملفات .drawnix',
  'filePanel.rename': 'إعادة تسمية',
  'filePanel.trash': 'المحذوفات',
  'filePanel.trashEmpty': 'المحذوفات فارغة',
  'filePanel.newFolder': 'مجموعة جديدة',
  'filePanel.newSubFolder': 'مجموعة فرعية جديدة',
  'filePanel.newFolderPlaceholder': 'اسم المجموعة…',
  'filePanel.folderLocation': 'المجموعة',
  'filePanel.defaultLocation': 'المجلد الرئيسي',
  'filePanel.saveAs': 'حفظ باسم',
  'filePanel.exportImage': 'تصدير صورة',
  'filePanel.restore': 'استعادة',
  'filePanel.delete': 'حذف',
  'filePanel.move': 'نقل إلى…',
  'filePanel.emptyTrash': 'تفريغ المحذوفات',

  // Delete confirm dialog (move to trash)
  'deleteConfirm.title': 'حذف الملف',
  'deleteConfirm.description':
    'سيتم نقل الملف إلى المحذوفات وإزالته نهائياً بعد انتهاء مدة الحفظ. هل تريد المتابعة؟',
  'deleteConfirm.ok': 'حذف',

  // Delete folder confirm dialog
  'folderDeleteConfirm.title': 'حذف المجموعة',
  'folderDeleteConfirm.description':
    'سيتم نقل جميع الملفات في المجموعة إلى المحذوفات وإزالتها نهائيًا بعد انتهاء مدة الحفظ. هل تريد المتابعة؟',

  // Move entry dialog
  'moveDialog.title': 'اختر المجلد الهدف',

  // Empty trash confirm dialog
  'emptyTrashConfirm.title': 'تفريغ المحذوفات',
  'emptyTrashConfirm.description':
    'ستتم إزالة جميع الملفات في المحذوفات نهائيًا. لا يمكن التراجع عن هذا الإجراء. هل تريد المتابعة؟',
  'emptyTrashConfirm.ok': 'تفريغ',

  // Settings dialog
  'settings.title': 'الإعدادات',
  'settings.language': 'اللغة',
  'settings.dataDir': 'مسار تخزين البيانات',
  'settings.dataDirBrowse': 'استعراض…',
  'settings.dataDirHint':
    'بعد تغيير المسار، سيتم نقل ملفات .drawnix الحالية تلقائيًا إلى المسار الجديد (تبقى الملفات الأصلية كنسخة احتياطية).',
  'settings.dataDirMigrating': 'جارٍ النقل…',
  'settings.dataDirMigratedFiles': 'ملفًا تم نقلها إلى المسار الجديد',
  'settings.dataDirSamePath': 'المسار الجديد مطابق للمسار الحالي',
  'settings.dataDirMigrateFailed': 'فشل نقل البيانات',
  'settings.trashRetentionDays': 'مدة الحفظ في المحذوفات (أيام)',
  'settings.trashRetentionUnit': 'أيام',

  // Login
  'login.button': 'تسجيل الدخول',
  'login.notAvailable': 'تسجيل الدخول غير متاح بعد',

  // Welcome page (Tauri desktop)
  'welcome.title': 'مرحبًا بك في Drawnix',
  'welcome.description':
    'سبورة شاملة تتضمن الخرائط الذهنية والمخططات الانسيابية والرسم الحر، وتُحفظ بياناتك في ملفات محلية.',
  'welcome.newFile': 'ملف جديد',
  'welcome.sidebarHint': 'أو افتح ملفًا موجودًا من القائمة الجانبية',

  // Link popup items
  'popupLink.delLink': 'حذف الرابط',

  // Tool popup items
  'popupToolbar.fillColor': 'لون التعبئة',
  'popupToolbar.fontSize': 'حجم الخط',
  'popupToolbar.fontColor': 'لون الخط',
  'popupToolbar.link': 'إدراج رابط',
  'popupToolbar.stroke': 'الحد',
  'popupToolbar.opacity': 'مستوى شفافية',

  // Text placeholders
  'textPlaceholders.link': 'رابط',
  'textPlaceholders.text': 'نص',

  // Line tool
  'line.source': 'بداية',
  'line.target': 'نهاية',
  'line.arrow': 'سهم',
  'line.none': 'لا شيء',

  // Stroke style
  'stroke.solid': 'صلب',
  'stroke.dashed': 'متقطع',
  'stroke.dotted': 'منقط',

  //markdown example
  //   "markdown.example": "# لقد بدأت\n\n- دعني أرى من تسبب بهذا الخطأ 🕵️ ♂️ 🔍\n  - 😯 💣\n    - اتضح أنه أنا 👈 🎯 💘\n\n- بشكل غير متوقع، لا يعمل؛ لماذا 🚫 ⚙️ ❓\n  - بشكل غير متوقع، أصبح يعمل الآن؛ لماذا؟ 🎢 ✨\n    - 🤯 ⚡ ➡️ 🎉\n\n- ما الذي يمكن تشغيله 🐞 🚀\n  - إذًا لا تلمسه 🛑 ✋\n    - 👾 💥 🏹 🎯\n\n## ولد أم بنت 👶 ❓ 🤷 ♂️ ♀️\n\n### مرحبًا بالعالم 👋 🌍 ✨ 💻\n\n#### واو، مبرمج 🤯 ⌨️ 💡 👩 💻",
  'markdown.example': `# I have started

  - دعني أرى من تسبب بهذا الخطأ  🕵️ ♂️ 🔍
    - 😯 💣
      - اتضح أنه أنا 👈 🎯 💘

  - بشكل غير متوقع، لا يعمل؛ لماذا  🚫 ⚙️ ❓
    - بشكل غير متوقع، أصبح يعمل الآن؛ لماذا؟ 🎢 ✨
      - 🤯 ⚡ ➡️ 🎉

  - ما الذي يمكن تشغيله 🐞 🚀
    - إذًا لا تلمسه 🛑 ✋
      - 👾 💥 🏹 🎯

  ## ولد أم بنت  👶 ❓ 🤷 ♂️ ♀️

  ### Hello world 👋 🌍 ✨ 💻

  #### Wow, a programmer 🤯 ⌨️ 💡 👩 💻`,

  // Draw elements text
  'draw.lineText': 'نص',
  'draw.geometryText': 'نص',

  // Mind map elements text
  'mind.centralText': 'الموضوع المركزي',
  'mind.abstractNodeText': 'ملخص',

  'tutorial.title': 'Drawnix',
  'tutorial.description':
    'سبورة شاملة تتضمن الخرائط الذهنية والمخططات الانسيابية والرسم الحر وغير ذلك',
  'tutorial.dataDescription': 'تُحفظ جميع البيانات محليًا في متصفحك',
  'tutorial.appToolbar': 'تصدير، إعدادات اللغة، ...',
  'tutorial.creationToolbar': 'اختر أداة لبدء الإنشاء',
  'tutorial.themeDescription': 'التبديل بين السمة الفاتحة والداكنة',
};

export default arTranslations;

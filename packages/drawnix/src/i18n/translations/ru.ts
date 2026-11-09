import { Translations } from '../types';

const ruTranslations: Translations = {
  // Toolbar items
  'toolbar.hand': 'Рука — H',
  'toolbar.selection': 'Выделение — V',
  'toolbar.mind': 'Mind-карта — M',
  'toolbar.text': 'Текст — T',
  'toolbar.arrow': 'Стрелка — A',
  'toolbar.shape': 'Фигуры',
  'toolbar.image': 'Изображение — Cmd+U',
  'toolbar.extraTools': 'Дополнительно',
  'toolbar.card': 'Карточка',
  'card.insertImage': 'Вставить изображение',
  'card.fileRef.loading': 'Загрузка…',
  'card.fileRef.missing': 'Файл не найден, перемещён или удалён',
  'card.fileRef.openHint': 'Двойной щелчок для редактирования',

  'toolbar.pen': 'Карандаш — P',
  'toolbar.eraser': 'Ластик — E',

  'toolbar.arrow.straight': 'Прямая стрелка',
  'toolbar.arrow.elbow': 'Ломаная стрелка',
  'toolbar.arrow.curve': 'Кривая стрелка',

  'toolbar.shape.rectangle': 'Прямоугольник — R',
  'toolbar.shape.ellipse': 'Эллипс — O',
  'toolbar.shape.triangle': 'Треугольник',
  'toolbar.shape.terminal': 'Останов',
  'toolbar.shape.noteCurlyLeft': 'Фигурная заметка — слева',
  'toolbar.shape.noteCurlyRight': 'Фигурная заметка — справа',
  'toolbar.shape.diamond': 'Ромб',
  'toolbar.shape.parallelogram': 'Параллелограмм',
  'toolbar.shape.roundRectangle': 'Скруглённый прямоугольник',

  // Zoom controls
  'zoom.in': 'Увеличить — Cmd++',
  'zoom.out': 'Уменьшить — Cmd+-',
  'zoom.fit': 'По размеру экрана',
  'zoom.100': 'Сбросить к 100%',
  'zoom.fullscreen': 'Во весь экран',
  'zoom.exitFullscreen': 'Выйти из полноэкранного режима',

  // Themes
  'theme.default': 'Стандартная',
  'theme.colorful': 'Красочная',
  'theme.soft': 'Мягкая',
  'theme.retro': 'Старинная',
  'theme.dark': 'Тёмная',
  'theme.starry': 'Звёздная',

  // Colors
  'color.none': 'Автоматически',
  'color.unknown': 'Другой цвет',
  'color.default': 'Чёрный',
  'color.white': 'Белый',
  'color.gray': 'Серый',
  'color.deepBlue': 'Голубой',
  'color.red': 'Красный',
  'color.green': 'Зелёный',
  'color.yellow': 'Жёлтый',
  'color.purple': 'Фиолетовый',
  'color.orange': 'Оранжевый',
  'color.pastelPink': 'Розовый',
  'color.cyan': 'Лиловый',
  'color.brown': 'Коричневый',
  'color.forestGreen': 'Сосновный',
  'color.lightGray': 'Светло-серый',

  // General
  'general.undo': 'Отменить',
  'general.redo': 'Вернуть',
  'general.menu': 'Меню приложения',
  'general.moreOptions': 'Дополнительно',
  'general.duplicate': 'Дублировать',
  'general.delete': 'Удалить',

  'general.copyToClipboard': 'Копировать в буфер обмена',
  'general.copyToClipboard.svg': 'SVG',
  'general.copyToClipboard.png': 'PNG',
  'general.copyToClipboard.transparent': 'Прозрачный фон',
  'toast.copyToClipboard.svg': 'Выбранные элементы скопированы в буфер обмена как SVG',
  'toast.copyToClipboard.png': 'Выбранные элементы скопированы в буфер обмена как PNG',
  'toast.copyToClipboard.mode.transparent': '(Прозрачный фон)',
  'toast.tauriFile.saved': 'Сохранено',
  'toast.tauriFile.saveFailed': 'Ошибка сохранения',
  'toast.tauriFile.loadFailed': 'Не удалось загрузить файл',
  'toast.tauriFile.renameFailed': 'Не удалось переименовать: имя уже занято',
  'toast.tauriFile.exportFailed': 'Не удалось экспортировать',
  'toast.tauriFile.deleteFailed': 'Не удалось удалить',
  'toast.tauriFile.restoreFailed': 'Не удалось восстановить',
  'toast.tauriFile.createFolderFailed':
    'Не удалось создать папку. Возможно, папка с таким именем уже существует',
  // Language
  'language.switcher': 'Language',
  'language.chinese': '中文',
  'language.english': 'English',
  'language.russian': 'Русский',
  'language.arabic': 'عربي',
  'language.vietnamese': 'Tiếng Việt',

  // Menu items
  'menu.open': 'Открыть',
  'menu.saveFile': 'Сохранить в текущий файл',
  'menu.saveTauriFile': 'Сохранить в файл',
  'menu.saveAsFile': 'Сохранить как',
  'menu.exportImage': 'Экспортировать',
  'menu.exportImage.svg': 'SVG',
  'menu.exportImage.png': 'PNG',
  'menu.exportImage.jpg': 'JPG',
  'menu.cleanBoard': 'Очистить доску',
  'menu.github': 'GitHub',

  // Dialog translations
  'dialog.mermaid.title': 'Mermaid в Drawnix',
  'dialog.mermaid.description': 'Поддерживаются',
  'dialog.mermaid.flowchart': 'блок-схемы',
  'dialog.mermaid.sequence': 'диаграммы последовательностей',
  'dialog.mermaid.class': 'диаграммы классов',
  'dialog.mermaid.otherTypes': ' и другие диаграммы (преобразуются в изображения).',
  'dialog.mermaid.syntax': 'Синтаксис Mermaid',
  'dialog.mermaid.placeholder': 'Введите сюда описание вашей Mermaid-диаграммы…',
  'dialog.mermaid.preview': 'Предпросмотр',
  'dialog.mermaid.insert': 'Вставить',
  'dialog.markdown.description':
    'Поддерживается автоматическое преобразование синтаксиса Markdown в mind-карты.',
  'dialog.markdown.syntax': 'Синтаксис Markdown',
  'dialog.markdown.placeholder': 'Введите сюда описание вашего текста Markdown…',
  'dialog.markdown.preview': 'Предпросмотр',
  'dialog.markdown.insert': 'Вставить',
  'dialog.error.loadMermaid': 'Не удалось загрузить библотеку Mermaid',

  // Extra tools menu items
  'extraTools.mermaidToDrawnix': 'Mermaid в Drawnix',
  'extraTools.markdownToDrawnix': 'Markdown в Drawnix',

  // Clean confirm dialog
  'cleanConfirm.title': 'Очистить доску',
  'cleanConfirm.description': 'Это удалит всё содержимое доски. Вы хотите продолжить?',
  'cleanConfirm.cancel': 'Отмена',
  'cleanConfirm.ok': 'ОК',

  // Tauri file panel
  'filePanel.title': 'Файлы',
  'filePanel.newFile': 'Новый',
  'filePanel.newFilePlaceholder': 'Имя нового файла…',
  'filePanel.empty': 'Нет файлов',
  'filePanel.rename': 'Переименовать',
  'filePanel.trash': 'Корзина',
  'filePanel.trashEmpty': 'Корзина пуста',
  'filePanel.newFolder': 'Новая группа',
  'filePanel.newSubFolder': 'Новая подгруппа',
  'filePanel.newFolderPlaceholder': 'Название группы…',
  'filePanel.folderLocation': 'Папка',
  'filePanel.defaultLocation': 'Верхний уровень',
  'filePanel.saveAs': 'Сохранить как',
  'filePanel.exportImage': 'Экспорт в изображение',
  'filePanel.restore': 'Восстановить',
  'filePanel.delete': 'Удалить',
  'filePanel.move': 'Переместить в…',
  'filePanel.emptyTrash': 'Очистить корзину',

  // New file dialog: file types
  'filePanel.fileName': 'Имя файла',
  'filePanel.fileType': 'Тип файла',
  'filePanel.fileType.drawnix': 'Доска',
  'filePanel.fileType.md': 'Markdown',
  'filePanel.fileType.table': 'Таблица',
  'filePanel.tableRows': 'Строки',
  'filePanel.tableCols': 'Столбцы',

  // Table editor
  'table.insertRow': 'Вставить строку',
  'table.deleteRow': 'Удалить строку',
  'table.insertCol': 'Вставить столбец',
  'table.deleteCol': 'Удалить столбец',
  'table.merge': 'Объединить ячейки',
  'table.unmerge': 'Разъединить',
  'table.border': 'Граница',
  'table.borderAll': 'Все границы',
  'table.borderNone': 'Без границ',
  'table.borderOuter': 'Внешняя граница',
  'table.selectionHint':
    'Клик — выбор, перетаскивание или Shift+клик — несколько ячеек, двойной клик или Enter — редактирование, потянуть за край — изменить размер; Tab/стрелки — навигация по ячейкам',
  'table.alignLeft': 'По левому краю',
  'table.alignCenter': 'По центру',
  'table.alignRight': 'По правому краю',
  'table.alignTop': 'По верхнему краю',
  'table.alignMiddle': 'По центру вертикально',
  'table.alignBottom': 'По нижнему краю',
  'table.bold': 'Полужирный',
  'table.underline': 'Подчёркнутый',
  'table.strikethrough': 'Зачёркнутый',

  // Markdown editor
  'markdown.placeholder': 'Введите Markdown здесь…',
  'markdown.mode.label': 'Режим просмотра',
  'markdown.mode.code': 'Код',
  'markdown.mode.split': 'Разделение',
  'markdown.mode.preview': 'Предпросмотр',
  'markdown.toolbar.bold': 'Жирный',
  'markdown.toolbar.italic': 'Курсив',
  'markdown.toolbar.strikethrough': 'Зачёркнутый',
  'markdown.toolbar.heading1': 'Заголовок 1',
  'markdown.toolbar.heading2': 'Заголовок 2',
  'markdown.toolbar.heading3': 'Заголовок 3',
  'markdown.toolbar.unorderedList': 'Маркированный список',
  'markdown.toolbar.orderedList': 'Нумерованный список',
  'markdown.toolbar.taskList': 'Список задач',
  'markdown.toolbar.quote': 'Цитата',
  'markdown.toolbar.inlineCode': 'Строчный код',
  'markdown.toolbar.codeBlock': 'Блок кода',
  'markdown.toolbar.link': 'Ссылка',
  'markdown.toolbar.image': 'Изображение',
  'markdown.toolbar.table': 'Таблица',
  'markdown.toolbar.horizontalRule': 'Разделитель',
  'markdown.tableTemplate': '| Заголовок 1 | Заголовок 2 | Заголовок 3 |\n| --- | --- | --- |\n|  |  |  |',
  'markdown.linkPlaceholder': 'текст ссылки',
  'markdown.imagePlaceholder': 'описание изображения',

  // Doc editor overlay
  'docEditor.close': 'Закрыть',

  // Delete confirm dialog (move to trash)
  'deleteConfirm.title': 'Удалить файл',
  'deleteConfirm.description':
    'Файл будет перемещён в корзину и удалён безвозвратно по истечении срока хранения. Продолжить?',
  'deleteConfirm.ok': 'Удалить',

  // Delete folder confirm dialog
  'folderDeleteConfirm.title': 'Удалить папку',
  'folderDeleteConfirm.description':
    'Папка будет удалена, а файлы и вложенные папки внутри будут перенесены на верхний уровень. Продолжить?',

  // Move entry dialog
  'moveDialog.title': 'Выберите целевую папку',

  // Empty trash confirm dialog
  'emptyTrashConfirm.title': 'Очистить корзину',
  'emptyTrashConfirm.description':
    'Все файлы в корзине будут удалены безвозвратно. Это действие нельзя отменить. Продолжить?',
  'emptyTrashConfirm.ok': 'Очистить',

  // Settings dialog
  'settings.title': 'Настройки',
  'settings.language': 'Язык',
  'settings.dataDir': 'Путь хранения данных',
  'settings.dataDirBrowse': 'Обзор…',
  'settings.dataDirHint':
    'После изменения пути существующие файлы (доски/Markdown/таблицы) будут автоматически перенесены в новое расположение (оригиналы сохраняются как резервная копия).',
  'settings.dataDirMigrating': 'Перенос…',
  'settings.dataDirMigratedFiles': 'файлов перенесено в новый путь',
  'settings.dataDirSamePath': 'Новый путь совпадает с текущим',
  'settings.dataDirMigrateFailed': 'Не удалось перенести данные',
  'settings.trashRetentionDays': 'Срок хранения в корзине (дней)',
  'settings.trashRetentionUnit': 'дн.',

  // Login
  'login.button': 'Войти',
  'login.notAvailable': 'Вход пока недоступен',

  // Workbench chrome (tab bar / right file panel / window controls)
  'workbench.brand.name': '思画',
  'workbench.brand.en': 'DRAWNIX',
  'workbench.tab.more': 'Ещё',
  'workbench.tab.dirtySuffix': 'есть несохранённые изменения',
  'workbench.tab.closeTab': 'Закрыть вкладку',
  'workbench.tab.collapsePanel': 'Свернуть панель файлов',
  'workbench.tab.windowMenu': 'Окно',
  'workbench.window.group': 'Окно',
  'workbench.window.minimize': 'Свернуть',
  'workbench.window.maximize': 'Развернуть',
  'workbench.window.restore': 'Восстановить',
  'workbench.window.close': 'Закрыть',
  'workbench.window.minimizeWindow': 'Свернуть окно',
  'workbench.window.maximizeWindow': 'Развернуть окно',
  'workbench.window.restoreWindow': 'Восстановить окно',
  'workbench.window.closeWindow': 'Закрыть окно',
  'workbench.window.maximizedToast': 'Окно развёрнуто',
  'workbench.window.restoredToast': 'Возвращено в окно',
  'workbench.window.recoveredToast': 'Окно восстановлено',
  'workbench.panel.newBoard': 'Новая доска',
  'workbench.panel.newTable': 'Новая таблица',
  'workbench.panel.newMd': 'Новый Markdown',
  'workbench.panel.newFolder': 'Новая папка',
  'workbench.panel.newMore': 'Выбрать тип создания',
  'workbench.panel.folderItems': '{count} эл.',
  'workbench.create.nameEmpty': 'Введите имя файла',
  'workbench.create.nameDuplicate': 'Файл с таким именем уже существует. Выберите другое.',
  'workbench.create.folderLocation': 'Папка',
  'workbench.save.success': '«{name}» сохранён в локальный файл',
  'workbench.save.noFile': 'Сначала откройте файл',
  'workbench.exit.title': 'Выход',
  'workbench.exit.dirtyDescription':
    'В {count} файлах есть несохранённые изменения. Содержимое остаётся на этом устройстве, после повторного открытия можно продолжить редактирование.',
  'workbench.exit.cleanDescription': 'Все файлы сохранены. Вы сможете снова открыть их и продолжить редактирование.',
  'workbench.exit.cancel': 'Отмена',
  'workbench.exit.confirm': 'Выйти',

  // Welcome page (Tauri desktop)
  'welcome.title': 'Добро пожаловать в Drawnix',
  'welcome.description':
    'Универсальная белая доска: интеллектуальные карты, блок-схемы и рисование от руки. Данные хранятся в локальных файлах.',
  'welcome.newFile': 'Новый файл',
  'welcome.sidebarHint': 'Или откройте существующий файл в панели слева',
  'welcome.emptyTitle': 'Нет открытых файлов',
  'welcome.emptyDescription':
    'Создайте доску, таблицу или Markdown, или выберите файл на панели вкладок сверху.',

  // Link popup items
  'popupLink.delLink': 'Удалить ссылку',

  // Tool popup items
  'popupToolbar.fillColor': 'Цвет заливки',
  'popupToolbar.fontSize': 'Размер шрифта',
  'popupToolbar.fontColor': 'Цвет текста',
  'popupToolbar.link': 'Вставить ссылку',
  'popupToolbar.stroke': 'Контур',
  'popupToolbar.opacity': 'Прозрачность',

  // Text placeholders
  'textPlaceholders.link': 'Ссылка',
  'textPlaceholders.text': 'Текст',

  // Line tool
  'line.source': 'Начало',
  'line.target': 'Конец',
  'line.arrow': 'Стрелка',
  'line.none': 'Нет',

  // Stroke style
  'stroke.solid': 'Сплошной',
  'stroke.dashed': 'Штриховой',
  'stroke.dotted': 'Пунктирный',

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
  'draw.lineText': 'Текст',
  'draw.geometryText': 'Текст',

  // Mind map elements text
  'mind.centralText': 'Центральная тема',
  'mind.abstractNodeText': 'Резюме',

  'tutorial.title': 'Drawnix',
  'tutorial.description':
    'Универсальная доска: майнд-карты, блок-схемы, свободное рисование и многое другое',
  'tutorial.dataDescription': 'Все данные хранятся локально в вашем браузере',
  'tutorial.appToolbar': 'Экспорт, настройки языка, ...',
  'tutorial.creationToolbar': 'Выберите инструмент, чтобы начать творить',
  'tutorial.themeDescription': 'Переключение между светлой и тёмной темами',
};

export default ruTranslations;

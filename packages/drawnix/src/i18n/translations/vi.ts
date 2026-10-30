import { Translations } from '../types';

const viTranslations: Translations = {
  // Toolbar items
  'toolbar.hand': 'Kéo — H',
  'toolbar.selection': 'Chọn — V',
  'toolbar.mind': 'Mind Map — M',
  'toolbar.text': 'Văn bản — T',
  'toolbar.arrow': 'Mũi tên — A',
  'toolbar.shape': 'Hình dạng',
  'toolbar.image': 'Hình ảnh — Cmd+U',
  'toolbar.extraTools': 'Công cụ mở rộng',
  'toolbar.card': 'Thẻ',
  'card.insertImage': 'Chèn hình ảnh',

  'toolbar.pen': 'Bút vẽ — P',
  'toolbar.eraser': 'Tẩy — E',

  'toolbar.arrow.straight': 'Mũi tên thẳng',
  'toolbar.arrow.elbow': 'Mũi tên vuông góc',
  'toolbar.arrow.curve': 'Mũi tên cong',

  'toolbar.shape.rectangle': 'Hình chữ nhật — R',
  'toolbar.shape.ellipse': 'Hình elip — O',
  'toolbar.shape.triangle': 'Hình tam giác',
  'toolbar.shape.terminal': 'Terminal',
  'toolbar.shape.noteCurlyLeft': 'Ghi chú ngoặc móc trái',
  'toolbar.shape.noteCurlyRight': 'Ghi chú ngoặc móc phải',
  'toolbar.shape.diamond': 'Hình thoi',
  'toolbar.shape.parallelogram': 'Hình bình hành',
  'toolbar.shape.roundRectangle': 'Hình chữ nhật bo tròn',

  // Zoom controls
  'zoom.in': 'Phóng to — Cmd++',
  'zoom.out': 'Thu nhỏ — Cmd+-',
  'zoom.fit': 'Vừa màn hình',
  'zoom.100': 'Zoom 100%',
  'zoom.fullscreen': 'Toàn màn hình',
  'zoom.exitFullscreen': 'Thoát toàn màn hình',

  // Themes
  'theme.default': 'Mặc định',
  'theme.colorful': 'Đầy màu sắc',
  'theme.soft': 'Nhẹ nhàng',
  'theme.retro': 'Cổ điển',
  'theme.dark': 'Tối',
  'theme.starry': 'Bầu trời sao',

  // Colors
  'color.none': 'Màu chủ đề',
  'color.unknown': 'Màu khác',
  'color.default': 'Đen cơ bản',
  'color.white': 'Trắng',
  'color.gray': 'Xám',
  'color.deepBlue': 'Xanh đậm',
  'color.red': 'Đỏ',
  'color.green': 'Xanh lá',
  'color.yellow': 'Vàng',
  'color.purple': 'Tím',
  'color.orange': 'Cam',
  'color.pastelPink': 'Hồng phấn',
  'color.cyan': 'Xanh lơ',
  'color.brown': 'Nâu',
  'color.forestGreen': 'Xanh rừng',
  'color.lightGray': 'Xám nhạt',

  // General
  'general.undo': 'Hoàn tác',
  'general.redo': 'Làm lại',
  'general.menu': 'Menu ứng dụng',
  'general.moreOptions': 'Tùy chọn khác',
  'general.duplicate': 'Nhân bản',
  'general.delete': 'Xóa',

  'general.copyToClipboard': 'Sao chép vào bộ nhớ tạm',
  'general.copyToClipboard.svg': 'SVG',
  'general.copyToClipboard.png': 'PNG',
  'general.copyToClipboard.transparent': 'Nền trong suốt',
  'toast.copyToClipboard.svg': 'Đã sao chép các mục đã chọn dưới dạng SVG vào bộ nhớ tạm',
  'toast.copyToClipboard.png': 'Đã sao chép các mục đã chọn dưới dạng PNG vào bộ nhớ tạm',
  'toast.copyToClipboard.mode.transparent': '(Nền trong suốt)',
  'toast.tauriFile.saved': 'Đã lưu',
  'toast.tauriFile.saveFailed': 'Lưu thất bại',
  'toast.tauriFile.loadFailed': 'Không thể tải tệp',
  'toast.tauriFile.renameFailed': 'Đổi tên thất bại, tên mới có thể đã tồn tại',
  'toast.tauriFile.exportFailed': 'Xuất thất bại',
  'toast.tauriFile.deleteFailed': 'Xóa thất bại',
  'toast.tauriFile.restoreFailed': 'Khôi phục thất bại',
  // Language
  'language.switcher': 'Ngôn ngữ',
  'language.chinese': '中文',
  'language.english': 'English',
  'language.russian': 'Русский',
  'language.arabic': 'عربي',
  'language.vietnamese': 'Tiếng Việt',

  // Menu items
  'menu.open': 'Mở',
  'menu.saveFile': 'Lưu vào tệp hiện tại',
  'menu.saveTauriFile': 'Lưu vào tệp',
  'menu.saveAsFile': 'Lưu thành',
  'menu.exportImage': 'Xuất hình ảnh',
  'menu.exportImage.svg': 'SVG',
  'menu.exportImage.png': 'PNG',
  'menu.exportImage.jpg': 'JPG',
  'menu.cleanBoard': 'Xóa bảng',
  'menu.github': 'GitHub',

  // Dialog translations
  'dialog.mermaid.title': 'Mermaid sang Drawnix',
  'dialog.mermaid.description': 'Hiện hỗ trợ',
  'dialog.mermaid.flowchart': 'lưu đồ',
  'dialog.mermaid.sequence': 'biểu đồ tuần tự',
  'dialog.mermaid.class': 'biểu đồ lớp',
  'dialog.mermaid.otherTypes': ', và các loại biểu đồ khác (hiển thị dưới dạng hình ảnh).',
  'dialog.mermaid.syntax': 'Cú pháp Mermaid',
  'dialog.mermaid.placeholder': 'Viết định nghĩa biểu đồ Mermaid của bạn ở đây...',
  'dialog.mermaid.preview': 'Xem trước',
  'dialog.mermaid.insert': 'Chèn',
  'dialog.markdown.description': 'Hỗ trợ tự động chuyển đổi cú pháp Markdown sang sơ đồ tư duy.',
  'dialog.markdown.syntax': 'Cú pháp Markdown',
  'dialog.markdown.placeholder': 'Viết nội dung Markdown của bạn ở đây...',
  'dialog.markdown.preview': 'Xem trước',
  'dialog.markdown.insert': 'Chèn',
  'dialog.error.loadMermaid': 'Không thể tải thư viện Mermaid',

  // Extra tools menu items
  'extraTools.mermaidToDrawnix': 'Mermaid sang Drawnix',
  'extraTools.markdownToDrawnix': 'Markdown sang Drawnix',

  // Clean confirm dialog
  'cleanConfirm.title': 'Xóa bảng',
  'cleanConfirm.description': 'Thao tác này sẽ xóa toàn bộ bảng. Bạn có muốn tiếp tục không?',
  'cleanConfirm.cancel': 'Hủy',
  'cleanConfirm.ok': 'Đồng ý',

  // Tauri file panel
  'filePanel.title': 'Tệp',
  'filePanel.newFile': 'Mới',
  'filePanel.newFilePlaceholder': 'Tên tệp mới…',
  'filePanel.empty': 'Chưa có tệp .drawnix nào',
  'filePanel.rename': 'Đổi tên',
  'filePanel.trash': 'Thùng rác',
  'filePanel.trashEmpty': 'Thùng rác trống',
  'filePanel.newFolder': 'Nhóm mới',
  'filePanel.newSubFolder': 'Nhóm con mới',
  'filePanel.newFolderPlaceholder': 'Tên nhóm…',
  'filePanel.folderLocation': 'Nhóm',
  'filePanel.defaultLocation': 'Thư mục gốc',
  'filePanel.saveAs': 'Lưu thành',
  'filePanel.exportImage': 'Xuất ảnh',
  'filePanel.restore': 'Khôi phục',
  'filePanel.delete': 'Xóa',
  'filePanel.move': 'Chuyển đến…',
  'filePanel.emptyTrash': 'Dọn thùng rác',

  // Delete confirm dialog (move to trash)
  'deleteConfirm.title': 'Xóa tệp',
  'deleteConfirm.description':
    'Tệp sẽ được chuyển vào thùng rác và bị xóa vĩnh viễn sau thời gian lưu trữ. Tiếp tục?',
  'deleteConfirm.ok': 'Xóa',

  // Delete folder confirm dialog
  'folderDeleteConfirm.title': 'Xóa nhóm',
  'folderDeleteConfirm.description':
    'Tất cả tệp trong nhóm sẽ được chuyển vào thùng rác và bị xóa vĩnh viễn sau thời gian lưu trữ. Tiếp tục?',

  // Move entry dialog
  'moveDialog.title': 'Chọn thư mục đích',

  // Empty trash confirm dialog
  'emptyTrashConfirm.title': 'Dọn thùng rác',
  'emptyTrashConfirm.description':
    'Tất cả tệp trong thùng rác sẽ bị xóa vĩnh viễn. Không thể hoàn tác. Tiếp tục?',
  'emptyTrashConfirm.ok': 'Dọn sạch',

  // Settings dialog
  'settings.title': 'Cài đặt',
  'settings.language': 'Ngôn ngữ',
  'settings.dataDir': 'Đường dẫn lưu dữ liệu',
  'settings.dataDirBrowse': 'Duyệt…',
  'settings.dataDirHint':
    'Sau khi thay đổi đường dẫn, các tệp .drawnix hiện có sẽ được tự động chuyển sang đường dẫn mới (tệp gốc được giữ lại làm bản sao lưu).',
  'settings.dataDirMigrating': 'Đang chuyển…',
  'settings.dataDirMigratedFiles': 'tệp đã được chuyển sang đường dẫn mới',
  'settings.dataDirSamePath': 'Đường dẫn mới trùng với đường dẫn hiện tại',
  'settings.dataDirMigrateFailed': 'Chuyển dữ liệu thất bại',
  'settings.trashRetentionDays': 'Thời gian lưu thùng rác (ngày)',
  'settings.trashRetentionUnit': 'ngày',

  // Login
  'login.button': 'Đăng nhập',
  'login.notAvailable': 'Tính năng đăng nhập chưa khả dụng',

  // Welcome page (Tauri desktop)
  'welcome.title': 'Chào mừng đến với Drawnix',
  'welcome.description':
    'Bảng trắng tất-cả-trong-một với sơ đồ tư duy, lưu đồ và vẽ tự do. Dữ liệu của bạn được lưu trong tệp cục bộ.',
  'welcome.newFile': 'Tệp mới',
  'welcome.sidebarHint': 'Hoặc mở tệp có sẵn từ danh sách bên trái',

  // Link popup items
  'popupLink.delLink': 'Xóa liên kết',

  // Tool popup items
  'popupToolbar.fillColor': 'Màu tô',
  'popupToolbar.fontSize': 'Cỡ chữ',
  'popupToolbar.fontColor': 'Màu chữ',
  'popupToolbar.link': 'Chèn liên kết',
  'popupToolbar.stroke': 'Đường viền',
  'popupToolbar.opacity': 'Độ trong suốt',

  // Text placeholders
  'textPlaceholders.link': 'Liên kết',
  'textPlaceholders.text': 'Văn bản',

  // Line tool
  'line.source': 'Bắt đầu',
  'line.target': 'Kết thúc',
  'line.arrow': 'Mũi tên',
  'line.none': 'Không',

  // Stroke style
  'stroke.solid': 'Nét liền',
  'stroke.dashed': 'Nét đứt',
  'stroke.dotted': 'Nét chấm',

  //markdown example
  'markdown.example': `# Tôi đã bắt đầu

    - Hãy xem ai đã tạo ra lỗi này 🕵️ ♂️ 🔍
      - 😯 💣
        - Hóa ra là tôi 👈 🎯 💘

    - Bất ngờ thay, nó không chạy được; tại sao vậy 🚫 ⚙️ ❓
      - Bất ngờ thay, giờ nó chạy được rồi; tại sao vậy? 🎢 ✨
        - 🤯 ⚡ ➡️ 🎉

    - Cái gì chạy được 🐞 🚀
      - thì đừng chạm vào nó 🛑 ✋
        - 👾 💥 🏹 🎯

    ## Trai hay gái 👶 ❓ 🤷 ♂️ ♀️

    ### Xin chào thế giới 👋 🌍 ✨ 💻

    #### Wow, một lập trình viên 🤯 ⌨️ 💡 👩 💻`,

  // Draw elements text
  'draw.lineText': 'Văn bản',
  'draw.geometryText': 'Văn bản',

  // Mind map elements text
  'mind.centralText': 'Chủ đề trung tâm',
  'mind.abstractNodeText': 'Tóm tắt',

  'tutorial.title': 'DPIT Draw MindMap',
  'tutorial.description':
    'Bảng trắng tất cả trong một, bao gồm sơ đồ tư duy, lưu đồ, vẽ tự do và hơn thế nữa',
  'tutorial.dataDescription': 'Tất cả dữ liệu được lưu trữ cục bộ trong trình duyệt của bạn',
  'tutorial.appToolbar': 'Xuất, cài đặt ngôn ngữ, ...',
  'tutorial.creationToolbar': 'Chọn một công cụ để bắt đầu sáng tạo',
  'tutorial.themeDescription': 'Chuyển đổi giữa chế độ sáng và tối',
};

export default viTranslations;

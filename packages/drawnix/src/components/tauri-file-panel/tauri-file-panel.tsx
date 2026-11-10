import { useCallback, useEffect, useRef, useState } from 'react';
import { useBoard, useListRender } from '@plait-board/react-board';
import {
  ATTACHED_ELEMENT_CLASS_NAME,
  BoardTransforms,
  PlaitBoard,
  PlaitElement,
  PlaitTheme,
  Viewport,
} from '@plait/core';
import classNames from 'classnames';
import { Island } from '../island';
import {
  BoardIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FolderFilledIcon,
  FolderIcon,
  MdIcon,
  MoreIcon,
  PlusIcon,
  TableIcon,
} from '../icons';
import {
  CreateTauriFileOptions,
  DATA_DIR_CHANGED_EVENT,
  TAURI_FILES_CHANGED_EVENT,
  TauriFileType,
  TauriOrderMap,
  TauriTrashEntry,
  TauriTreeDirEntry,
  TauriTreeFileEntry,
  TauriTreeResult,
  buildEmptyDrawnixContent,
  buildEmptyMarkdownContent,
  buildEmptyTableContent,
  createTauriFolder,
  deleteTauriFile,
  deleteTauriFolder,
  emptyTauriTrash,
  isTauriEnvironment,
  listTauriTrashFiles,
  listTauriTree,
  moveTauriFileToDir,
  moveTauriFolderToDir,
  normalizeTauriFileName,
  notifyTauriFilesChanged,
  parseTauriFileContent,
  readTauriFile,
  renameTauriFile,
  renameTauriFolder,
  reorderTauriItems,
  resumeTauriFileSave,
  restoreTauriFile,
  saveToTauriFile,
  setCurrentTauriFile,
  suppressTauriDirty,
  suppressTauriFileSave,
  useTauriFileState,
  writeTauriFile,
} from '../../data/tauri-file';
import { fileSave } from '../../data/filesystem';
import { MIME_TYPES } from '../../constants';
import { saveAsPng, saveAsSvg } from '../../utils/image';
import { Dialog, DialogContent } from '../dialog/dialog';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';
import { CreateFileDialog } from '../create-file-dialog/create-file-dialog';
import { MoveEntryDialog } from '../move-entry-dialog/move-entry-dialog';
import { SidebarFooter } from '../sidebar-footer/sidebar-footer';
import { syncFileRefCardPaths } from '../../plugins/card/transforms';
import { Popover, PopoverContent, PopoverTrigger } from '../popover/popover';
import Menu from '../menu/menu';
import MenuItem from '../menu/menu-item';
import { WindowControls } from '../window-controls/window-controls';
import {
  closeCreateDialog,
  openCreateDialog,
  setExitConfirmOpen,
  setSidebarOpen,
  useWorkbenchUi,
} from '../../data/workbench-ui';
import './tauri-file-panel.scss';

type PanelView = 'files' | 'trash';

/** 拖拽项：id 为相对路径（文件不含扩展名），文件项附带类型 */
type DragItem = { type: 'file' | 'folder'; id: string; ext?: string };

type ContextMenuState = {
  x: number;
  y: number;
  kind: 'file' | 'folder';
  target: string;
  trash: boolean;
  exportOpen: boolean;
  /** 文件类型（仅文件项） */
  ext?: string;
};

/** 待删除的文件目标（含类型） */
type DeleteFileTarget = { path: string; ext: string };

/** 待移动的条目目标 */
type MoveTarget =
  | { kind: 'file'; path: string; ext: string }
  | { kind: 'folder'; path: string };

const asFileType = (ext: string | undefined): TauriFileType =>
  ext === 'md' || ext === 'table' ? ext : 'drawnix';

const parentOf = (rel: string) => {
  const idx = rel.lastIndexOf('/');
  return idx < 0 ? '' : rel.slice(0, idx);
};

const lastSeg = (rel: string) => rel.slice(rel.lastIndexOf('/') + 1);

const joinPath = (dir: string | null, name: string) =>
  dir ? `${dir}/${name}` : name;

/** 行内命名输入的交互（C6）：Enter 提交、Escape 取消、点外面提交 */
const InlineNameInput = ({
  value,
  onChange,
  onCommit,
  onCancel,
  placeholder,
  selectOnFocus,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  placeholder?: string;
  /** 聚焦时全选现名（重命名场景，便于整体替换） */
  selectOnFocus?: boolean;
  className?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // 不用 autoFocus：从浮层（新建拆分菜单）触发时，浮层卸载时 FloatingFocusManager
  // 会把焦点还给打开菜单前的元素，与 autoFocus 竞态抢走输入框的焦点。
  // 改为挂载后等一拍再聚焦，rAF 必然晚于浮层卸载时的焦点归还。
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  // 点外面提交：捕获阶段监听 document，输入框内部的按下不触发。
  // 不用 onBlur 提交：焦点被浮层卸载抢走时会在空名状态下误关闭输入框。
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target && target.closest('.tauri-file-panel__rename-input')) {
        return;
      }
      onCommit();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [onCommit]);
  return (
    <input
      ref={inputRef}
      type="text"
      className={classNames('tauri-file-panel__rename-input', className)}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={(event) => {
        if (selectOnFocus) {
          event.target.select();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onCommit();
        } else if (event.key === 'Escape') {
          onCancel();
        }
      }}
    />
  );
};

export const TauriFilePanel = () => {
  const board = useBoard();
  const listRender = useListRender();
  const { showToast } = useDrawnix();
  const { t } = useI18n();
  const { currentFile, fileType: currentFileType, dirty } = useTauriFileState();
  const { createDialog, sidebarOpen } = useWorkbenchUi();
  const [tree, setTree] = useState<TauriTreeResult>({
    dirs: [],
    files: [],
    order: {},
  });
  const [trashFiles, setTrashFiles] = useState<TauriTrashEntry[]>([]);
  const [view, setView] = useState<PanelView>('files');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteFileTarget | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);
  const [isTauri] = useState(() => isTauriEnvironment());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renamingExt, setRenamingExt] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renamingFolderValue, setRenamingFolderValue] = useState('');
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  // 新建菜单悬停展开：移出按钮/浮层后延迟收起（容纳移动途中的空隙），移入即取消
  const newMenuHoverCloseRef = useRef<number>();
  // 拆分按钮实际宽度：新建菜单弹层宽度与其对齐（弹层 portal 到面板外，无法用 CSS 继承）
  const [splitWidth, setSplitWidth] = useState<number | undefined>(undefined);
  const splitRef = useRef<HTMLDivElement>(null);

  const openNewMenuOnHover = useCallback(() => {
    if (newMenuHoverCloseRef.current) {
      window.clearTimeout(newMenuHoverCloseRef.current);
      newMenuHoverCloseRef.current = undefined;
    }
    // 打开时实时取一次宽度，避免任何时机下拿到过期/为 0 的测量（RO 只负责展开期间跟踪窗口变化）
    const el = splitRef.current;
    if (el) {
      setSplitWidth(el.offsetWidth);
    }
    setNewMenuOpen(true);
  }, []);

  const scheduleCloseNewMenuOnHover = useCallback(() => {
    if (newMenuHoverCloseRef.current) {
      window.clearTimeout(newMenuHoverCloseRef.current);
    }
    newMenuHoverCloseRef.current = window.setTimeout(() => {
      newMenuHoverCloseRef.current = undefined;
      setNewMenuOpen(false);
    }, 120);
  }, []);

  // 卸载时清理悬停收起的定时器
  useEffect(
    () => () => {
      if (newMenuHoverCloseRef.current) {
        window.clearTimeout(newMenuHoverCloseRef.current);
      }
    },
    []
  );

  // 跟踪拆分按钮宽度（面板宽度随窗口/窄屏抽屉变化）；回收站视图无该按钮
  useEffect(() => {
    const el = splitRef.current;
    if (!el) {
      return;
    }
    const update = () => setSplitWidth(el.offsetWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [view]);

  const refreshTree = useCallback(() => {
    if (!isTauriEnvironment()) {
      return;
    }
    listTauriTree()
      .then(setTree)
      .catch((error) => {
        console.error('Failed to list drawnix tree:', error);
      });
  }, []);

  const refreshTrash = useCallback(() => {
    if (!isTauriEnvironment()) {
      return;
    }
    listTauriTrashFiles()
      .then(setTrashFiles)
      .catch((error) => {
        console.error('Failed to list drawnix trash files:', error);
      });
  }, []);

  useEffect(() => {
    refreshTree();
    refreshTrash();
    const refreshOnExternalChange = () => {
      refreshTree();
      refreshTrash();
    };
    window.addEventListener(DATA_DIR_CHANGED_EVENT, refreshOnExternalChange);
    window.addEventListener(TAURI_FILES_CHANGED_EVENT, refreshOnExternalChange);
    return () => {
      window.removeEventListener(DATA_DIR_CHANGED_EVENT, refreshOnExternalChange);
      window.removeEventListener(TAURI_FILES_CHANGED_EVENT, refreshOnExternalChange);
    };
  }, [refreshTree, refreshTrash]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  if (!isTauri) {
    return null;
  }

  const { dirs, files, order } = tree;

  const clearAndLoad = (
    elements: PlaitElement[],
    viewport?: Viewport,
    theme?: PlaitTheme
  ) => {
    suppressTauriDirty();
    board.children = elements;
    board.viewport = viewport || { zoom: 1 };
    if (theme) {
      board.theme = theme;
    }
    listRender.update(board.children, {
      board: board,
      parent: board,
      parentG: PlaitBoard.getElementHost(board),
    });
    BoardTransforms.fitViewport(board);
  };

  const showErrorToast = (message: string) => {
    showToast({ message });
  };

  // ----- 移动/重命名对当前打开文档的保护 -----
  // 文档编辑器的防抖保存与卸载 flushSave 按路径回写：被移动/重命名的文档
  // 若不先屏蔽旧路径，回写会在旧位置重建文件；操作成功后把当前文件
  // 切到新路径，失败则解除屏蔽，避免吞掉后续合法保存

  /** 返回命中的当前打开文档路径：精确匹配（ext 给出时要求文件类型一致），或（prefix 时）位于分组前缀下。
      同名不同类型文件的路径相同（不含扩展名），判别时需连同文件类型一起比较 */
  const matchCurrentDoc = (from: string, prefix = false, ext?: TauriFileType): string | null => {
    if (!currentFile) {
      return null;
    }
    if (currentFile === from && (ext === undefined || ext === currentFileType)) {
      return currentFile;
    }
    return prefix && currentFile.startsWith(`${from}/`) ? currentFile : null;
  };

  /** 移动/重命名成功后把当前文档切换到新路径 */
  const retargetCurrentDoc = (newPath: string) => {
    setCurrentTauriFile(newPath, currentFileType);
  };

  // 当前文件有未保存修改时先自动保存，
  // 避免后续加载其他文件（打开/导出图片）覆盖丢失编辑
  const ensureCurrentFileSaved = async (): Promise<boolean> => {
    if (!dirty || !currentFile) {
      return true;
    }
    try {
      await saveToTauriFile(board, currentFile);
      return true;
    } catch (error) {
      console.error('Failed to save current drawnix file:', error);
      showErrorToast(t('toast.tauriFile.saveFailed'));
      return false;
    }
  };

  const handleOpenFile = async (path: string, ext: string) => {
    try {
      if (!(await ensureCurrentFileSaved())) {
        return;
      }
      const fileType = asFileType(ext);
      setCurrentTauriFile(path, fileType);
      if (fileType === 'drawnix') {
        // Markdown/表格文件由文档编辑器自行加载，白板文件在这里直接载入画板
        const content = await readTauriFile(path);
        const { elements, viewport, theme } = parseTauriFileContent(content);
        clearAndLoad(elements as PlaitElement[], viewport, theme);
      }
    } catch (error) {
      console.error('Failed to open file:', error);
      showErrorToast(t('toast.tauriFile.loadFailed'));
    }
  };

  const handleCreateFile = async (
    name: string,
    dirPath: string | null,
    fileType: TauriFileType,
    options: CreateTauriFileOptions
  ) => {
    try {
      const path = joinPath(dirPath, name);
      if (fileType === 'md') {
        await writeTauriFile(path, buildEmptyMarkdownContent(), 'md');
        setCurrentTauriFile(path, 'md');
      } else if (fileType === 'table') {
        await writeTauriFile(path, buildEmptyTableContent(options.rows, options.cols), 'table');
        setCurrentTauriFile(path, 'table');
      } else {
        await writeTauriFile(path, buildEmptyDrawnixContent());
        setCurrentTauriFile(path);
        clearAndLoad([]);
      }
      // 创建成功后展开所属文件夹，让新文件立即可见（C8）
      if (dirPath) {
        setExpandedFolders((prev) => ({ ...prev, [dirPath]: true }));
      }
      notifyTauriFilesChanged();
      refreshTree();
    } catch (error) {
      console.error('Failed to create file:', error);
      showErrorToast(t('toast.tauriFile.saveFailed'));
    }
  };

  // 另存为：白板通过系统保存对话框导出 .drawnix 副本，Markdown 导出 .md 副本。
  // 另存当前文件时先自动保存，避免导出旧版本
  const handleSaveFileAs = async (filePath: string, ext: string) => {
    try {
      if (!(await ensureCurrentFileSaved())) {
        return;
      }
      const fileType = asFileType(ext);
      const content = await readTauriFile(filePath, fileType);
      const blob = new Blob([content], {
        type: fileType === 'md' ? MIME_TYPES.md : MIME_TYPES.drawnix,
      });
      await fileSave(blob, {
        name: lastSeg(filePath),
        extension: fileType === 'md' ? 'md' : 'drawnix',
        description: fileType === 'md' ? 'Markdown file' : 'Drawnix file',
      });
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        return;
      }
      console.error('Failed to save file as:', error);
      showErrorToast(t('toast.tauriFile.exportFailed'));
    }
  };

  // 导出图片：仅白板文件支持；非当前文件会先加载到画板再导出；有未保存修改时先自动保存。
  const handleExportImage = async (filePath: string, format: 'png' | 'svg') => {
    try {
      if (!(await ensureCurrentFileSaved())) {
        return;
      }
      if (currentFile !== filePath) {
        const content = await readTauriFile(filePath);
        const { elements, viewport, theme } = parseTauriFileContent(content);
        setCurrentTauriFile(filePath);
        clearAndLoad(elements as PlaitElement[], viewport, theme);
      }
      if (format === 'svg') {
        await saveAsSvg(board);
      } else {
        await saveAsPng(board);
      }
    } catch (error) {
      console.error('Failed to export image:', error);
      showErrorToast(t('toast.tauriFile.exportFailed'));
    }
  };

  const handleDeleteFile = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) {
      return;
    }
    // 同名不同类型文件路径相同，判别当前文档需连同文件类型
    const isCurrentDoc =
      currentFile === target.path && currentFileType === asFileType(target.ext);
    try {
      // 当前打开的文档被删除时先屏蔽其自动保存，
      // 否则文档编辑器卸载时的回写会把刚删除的文件重新创建出来
      if (isCurrentDoc) {
        suppressTauriFileSave(target.path);
      }
      await deleteTauriFile(target.path, asFileType(target.ext));
      if (isCurrentDoc) {
        setCurrentTauriFile(null);
        clearAndLoad([]);
      }
      refreshTree();
      refreshTrash();
      // 广播变更：白板中的引用卡片重新读取后进入“文件不存在”状态
      notifyTauriFilesChanged();
    } catch (error) {
      // 删除失败：恢复被屏蔽的自动保存，避免编辑器后续修改丢失
      if (isCurrentDoc) {
        resumeTauriFileSave(target.path);
      }
      console.error('Failed to delete file:', error);
      showErrorToast(t('toast.tauriFile.deleteFailed'));
    }
  };

  // 删除分组：组内文件移入回收站，目录被移除
  const handleDeleteFolder = async () => {
    const path = deleteFolderTarget;
    setDeleteFolderTarget(null);
    if (!path) {
      return;
    }
    try {
      // 分组内包含当前打开的文件时，同样先关闭文档并屏蔽自动保存
      if (
        currentFile &&
        (currentFile === path || currentFile.startsWith(`${path}/`))
      ) {
        suppressTauriFileSave(currentFile);
        setCurrentTauriFile(null);
        clearAndLoad([]);
      }
      await deleteTauriFolder(path);
      refreshTree();
      refreshTrash();
      // 广播变更：分组内被引用的文件卡片重新读取后进入“文件不存在”状态
      notifyTauriFilesChanged();
    } catch (error) {
      // 删除失败：恢复被屏蔽的自动保存
      if (currentFile && (currentFile === path || currentFile.startsWith(`${path}/`))) {
        resumeTauriFileSave(currentFile);
      }
      console.error('Failed to delete folder:', error);
      showErrorToast(t('toast.tauriFile.deleteFailed'));
    }
  };

  // 弹窗选择目标分组后移动文件/分组
  const handleMoveEntry = async (targetDir: string | null) => {
    const target = moveTarget;
    setMoveTarget(null);
    if (!target) {
      return;
    }
    // 当前打开的文档（或其所在分组）被移动时，先屏蔽旧路径的自动保存回写，
    // 否则编辑器防抖保存/卸载 flushSave 会把旧文件在旧位置重建出来
    const docOldPath =
      target.kind === 'file'
        ? matchCurrentDoc(target.path, false, asFileType(target.ext))
        : matchCurrentDoc(target.path, true);
    if (docOldPath) {
      suppressTauriFileSave(docOldPath);
    }
    try {
      if (target.kind === 'file') {
        const newPath = joinPath(targetDir, lastSeg(target.path));
        await moveTauriFileToDir(target.path, targetDir, asFileType(target.ext));
        // 同步白板中引用卡片的路径并广播刷新
        syncFileRefCardPaths(board, [{ from: target.path, to: newPath }]);
        notifyTauriFilesChanged();
        if (docOldPath) {
          retargetCurrentDoc(newPath);
        }
      } else {
        const newPath = joinPath(targetDir, lastSeg(target.path));
        await moveTauriFolderToDir(target.path, targetDir);
        // 分组路径变化，同步其下所有引用文件的路径前缀
        syncFileRefCardPaths(board, [{ from: target.path, to: newPath }]);
        notifyTauriFilesChanged();
        if (docOldPath) {
          retargetCurrentDoc(`${newPath}${docOldPath.slice(target.path.length)}`);
        }
      }
      refreshTree();
    } catch (error) {
      // 移动失败：恢复被屏蔽的自动保存
      if (docOldPath) {
        resumeTauriFileSave(docOldPath);
      }
      console.error('Failed to move entry:', error);
      showErrorToast(t('toast.tauriFile.saveFailed'));
    }
  };

  // 清空回收站：物理删除所有回收站文件
  const handleEmptyTrash = async () => {
    setEmptyTrashOpen(false);
    try {
      await emptyTauriTrash();
      refreshTrash();
      notifyTauriFilesChanged();
    } catch (error) {
      console.error('Failed to empty drawnix trash:', error);
      showErrorToast(t('toast.tauriFile.deleteFailed'));
    }
  };

  const handleRestoreFile = async (trashFile: string) => {
    try {
      await restoreTauriFile(trashFile);
      refreshTree();
      refreshTrash();
      // 广播变更：被恢复文件的引用卡片重新读取到内容
      notifyTauriFilesChanged();
    } catch (error) {
      console.error('Failed to restore drawnix file:', error);
      showErrorToast(t('toast.tauriFile.restoreFailed'));
    }
  };

  // ----- 分组（物理子文件夹） -----

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    const parent = newFolderParent;
    setNewFolderOpen(false);
    setNewFolderName('');
    if (!name) {
      return;
    }
    try {
      await createTauriFolder(parent, name);
      if (parent) {
        setExpandedFolders((prev) => ({ ...prev, [parent]: true }));
      }
      refreshTree();
    } catch (error) {
      console.error('Failed to create folder:', error);
      showErrorToast(t('toast.tauriFile.createFolderFailed'));
    }
  };

  const startRenameFolder = (dirPath: string) => {
    setRenamingFolder(dirPath);
    setRenamingFolderValue(lastSeg(dirPath));
  };

  const cancelRenameFolder = () => {
    setRenamingFolder(null);
    setRenamingFolderValue('');
  };

  const confirmRenameFolder = async () => {
    const dirPath = renamingFolder;
    const name = renamingFolderValue.trim();
    cancelRenameFolder();
    if (!dirPath || !name || name === lastSeg(dirPath)) {
      return;
    }
    const newPath = joinPath(parentOf(dirPath), name);
    // 分组内包含当前打开的文档时，先屏蔽旧路径的自动保存回写
    const docOldPath = matchCurrentDoc(dirPath, true);
    if (docOldPath) {
      suppressTauriFileSave(docOldPath);
    }
    try {
      await renameTauriFolder(dirPath, name);
      // 同步分组路径前缀下所有引用卡片并广播刷新
      syncFileRefCardPaths(board, [
        { from: dirPath, to: newPath },
      ]);
      notifyTauriFilesChanged();
      if (docOldPath) {
        retargetCurrentDoc(`${newPath}${docOldPath.slice(dirPath.length)}`);
      }
      refreshTree();
    } catch (error) {
      // 重命名失败：恢复被屏蔽的自动保存
      if (docOldPath) {
        resumeTauriFileSave(docOldPath);
      }
      console.error('Failed to rename folder:', error);
      showErrorToast(t('toast.tauriFile.renameFailed'));
    }
  };

  const confirmRename = async () => {
    const oldPath = renamingFile;
    const ext = renamingExt;
    const newName = normalizeTauriFileName(renameValue);
    cancelRename();
    if (!oldPath || !newName || newName === lastSeg(oldPath)) {
      return;
    }
    const newPath = joinPath(parentOf(oldPath), newName);
    // 重命名当前打开的文档时屏蔽旧路径的自动保存，
    // 避免编辑器重挂载的回写在旧路径重新创建文件。
    // 同名不同类型文件路径相同，判别当前文档需连同文件类型
    const isCurrentDoc = currentFile === oldPath && currentFileType === asFileType(ext);
    if (isCurrentDoc) {
      suppressTauriFileSave(oldPath);
    }
    try {
      await renameTauriFile(oldPath, newName, asFileType(ext));
      // 同步白板中引用卡片的路径并广播刷新
      syncFileRefCardPaths(board, [{ from: oldPath, to: newPath }]);
      notifyTauriFilesChanged();
      if (isCurrentDoc) {
        retargetCurrentDoc(newPath);
      }
      refreshTree();
    } catch (error) {
      // 重命名失败：恢复被屏蔽的自动保存
      if (isCurrentDoc) {
        resumeTauriFileSave(oldPath);
      }
      console.error('Failed to rename file:', error);
      showErrorToast(t('toast.tauriFile.renameFailed'));
    }
  };

  // ----- 排序与拖拽 -----

  // 目录下子目录顺序：未收录（新建）按创建时间倒序排最前，其余按自定义顺序
  const orderedChildDirs = (dir: string): TauriTreeDirEntry[] => {
    const children = dirs.filter((d) => parentOf(d.path) === dir);
    const orderList = order[dir]?.dirs ?? [];
    const unlisted = children
      .filter((d) => !orderList.includes(lastSeg(d.path)))
      .sort((a, b) => b.createdAt - a.createdAt || a.path.localeCompare(b.path));
    const listed = orderList
      .map((name) => children.find((d) => lastSeg(d.path) === name))
      .filter((d): d is TauriTreeDirEntry => !!d);
    return [...unlisted, ...listed];
  };

  // 目录下文件顺序：未收录（新建）按创建时间倒序排最前，其余按自定义顺序。
  // order 按 name 收录，同名不同类型文件（路径不含扩展名）只会命中一个，
  // 未命中的保持未收录语义排最前，避免从列表中消失
  const orderedFilesIn = (dir: string) => {
    const children = files.filter((f) => parentOf(f.path) === dir);
    const orderList = order[dir]?.files ?? [];
    const listed = orderList
      .map((name) => children.find((f) => lastSeg(f.path) === name))
      .filter((f): f is TauriTreeFileEntry => !!f);
    const listedKeys = new Set(listed.map((f) => `${f.path}:${f.ext}`));
    const unlisted = children
      .filter((f) => !listedKeys.has(`${f.path}:${f.ext}`))
      .sort((a, b) => b.createdAt - a.createdAt);
    return [...unlisted, ...listed];
  };

  // 持久化某目录的条目顺序
  const saveDirOrder = (dir: string, patch: Partial<TauriOrderMap[string]>) => {
    const nextOrder: TauriOrderMap = {
      ...order,
      [dir]: {
        dirs: order[dir]?.dirs ?? [],
        files: order[dir]?.files ?? [],
        ...patch,
      },
    };
    reorderTauriItems(nextOrder)
      .then(() => setTree((prev) => ({ ...prev, order: nextOrder })))
      .catch((error) => {
        console.error('Failed to reorder items:', error);
      });
  };

  const moveFile = (path: string, targetDir: string | null, ext?: string) => {
    if (parentOf(path) === (targetDir ?? '')) {
      return;
    }
    const newPath = joinPath(targetDir, lastSeg(path));
    const fileType = asFileType(ext);
    // 与 handleMoveEntry 一致：拖拽移动当前打开的文档前屏蔽旧路径回写，
    // 否则防抖保存/卸载 flushSave 会把旧文件在旧位置重建出来。
    // 同名不同类型文件路径相同，判别当前文档需连同文件类型
    const isCurrentDoc = currentFile === path && currentFileType === asFileType(ext);
    if (isCurrentDoc) {
      suppressTauriFileSave(path);
    }
    moveTauriFileToDir(path, targetDir, fileType)
      .then(() => {
        syncFileRefCardPaths(board, [
          { from: path, to: newPath },
        ]);
        notifyTauriFilesChanged();
        // 同步当前文件到新路径，避免后续保存写回旧路径
        if (isCurrentDoc) {
          retargetCurrentDoc(newPath);
        }
        refreshTree();
      })
      .catch((error) => {
        // 移动失败：恢复被屏蔽的自动保存
        if (isCurrentDoc) {
          resumeTauriFileSave(path);
        }
        console.error('Failed to move file:', error);
        showErrorToast(t('toast.tauriFile.saveFailed'));
      });
  };

  const moveFolder = (path: string, targetDir: string | null) => {
    const target = targetDir ?? '';
    if (parentOf(path) === target || target === path || target.startsWith(`${path}/`)) {
      return;
    }
    const newPath = joinPath(targetDir, lastSeg(path));
    // 分组内包含当前打开的文档时，先屏蔽旧路径的自动保存回写
    const docOldPath = matchCurrentDoc(path, true);
    if (docOldPath) {
      suppressTauriFileSave(docOldPath);
    }
    moveTauriFolderToDir(path, targetDir)
      .then(() => {
        syncFileRefCardPaths(board, [
          { from: path, to: newPath },
        ]);
        notifyTauriFilesChanged();
        if (docOldPath) {
          retargetCurrentDoc(`${newPath}${docOldPath.slice(path.length)}`);
        }
        refreshTree();
      })
      .catch((error) => {
        // 移动失败：恢复被屏蔽的自动保存
        if (docOldPath) {
          resumeTauriFileSave(docOldPath);
        }
        console.error('Failed to move folder:', error);
        showErrorToast(t('toast.tauriFile.saveFailed'));
      });
  };

  const resetDrag = () => {
    setDragItem(null);
    setDragOverKey(null);
  };

  // 拖文件到文件上：同目录重排，跨目录则移动到目标文件所在目录。
  // 路径不含扩展名，同名不同类型文件需连同 ext 一起判别
  const handleDropOnFile = (targetPath: string, targetExt: string, event: React.DragEvent) => {
    const dragged = readDragData(event);
    resetDrag();
    if (!dragged || dragged.type !== 'file') {
      return;
    }
    if (dragged.id === targetPath && dragged.ext === targetExt) {
      return;
    }
    const dir = parentOf(targetPath);
    if (parentOf(dragged.id) !== dir) {
      moveFile(dragged.id, dir, dragged.ext);
      return;
    }
    const entries = orderedFilesIn(dir);
    const draggedEntry = entries.find((f) => f.path === dragged.id && f.ext === dragged.ext);
    if (!draggedEntry) {
      return;
    }
    const rest = entries.filter((f) => f !== draggedEntry);
    const idx = rest.findIndex((f) => f.path === targetPath && f.ext === targetExt);
    rest.splice(idx < 0 ? rest.length : idx, 0, draggedEntry);
    // order 按 name 收录：同名文件共享一个槽位，去重避免顺序数据出现重复项
    const names: string[] = [];
    for (const f of rest) {
      const name = lastSeg(f.path);
      if (!names.includes(name)) {
        names.push(name);
      }
    }
    saveDirOrder(dir, { files: names });
  };

  // 拖到分组行：文件移入分组；分组则移动或同目录重排
  const handleDropOnFolder = (targetDir: string, event: React.DragEvent) => {
    const dragged = readDragData(event);
    resetDrag();
    if (!dragged || dragged.id === targetDir) {
      return;
    }
    if (dragged.type === 'file') {
      moveFile(dragged.id, targetDir, dragged.ext);
      return;
    }
    // 文件夹：目标是自己或自己的子孙目录时，忽略
    if (targetDir.startsWith(`${dragged.id}/`)) {
      return;
    }
    if (parentOf(dragged.id) === parentOf(targetDir)) {
      // 同级重排：分组插到目标分组之前
      reorderDirsBefore(dragged.id, targetDir);
      return;
    }
    moveFolder(dragged.id, targetDir);
  };

  // 拖到列表空白处：移动到根目录
  const handleDropOnRoot = (event: React.DragEvent) => {
    const dragged = readDragData(event);
    resetDrag();
    if (!dragged || parentOf(dragged.id) === '') {
      return;
    }
    if (dragged.type === 'file') {
      moveFile(dragged.id, null, dragged.ext);
    } else {
      moveFolder(dragged.id, null);
    }
  };

  // 同目录内重排子分组（拖动到同级分组上时）
  const reorderDirsBefore = (draggedId: string, targetDir: string) => {
    const dir = parentOf(targetDir);
    const rest = orderedChildDirs(dir)
      .map((d) => d.path)
      .filter((p) => p !== draggedId);
    const idx = rest.indexOf(targetDir);
    rest.splice(idx < 0 ? rest.length : idx, 0, draggedId);
    saveDirOrder(dir, { dirs: rest.map(lastSeg) });
  };

  // ----- 右键菜单 -----

  const handleItemContextMenu = (
    event: React.MouseEvent,
    kind: 'file' | 'folder',
    target: string,
    trash: boolean,
    ext?: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setRenamingFile(null);
    setRenamingFolder(null);
    setContextMenu({
      x: Math.min(event.clientX, window.innerWidth - 160),
      y: Math.min(event.clientY, window.innerHeight - 160),
      kind,
      target,
      trash,
      exportOpen: false,
      ext,
    });
  };

  // 关闭右键菜单并执行对应操作
  const closeContextMenuAnd = (action: (target: string) => void) => {
    if (!contextMenu) {
      return;
    }
    const { target } = contextMenu;
    setContextMenu(null);
    action(target);
  };

  const startRename = (filePath: string, ext: string) => {
    setContextMenu(null);
    setRenamingFile(filePath);
    setRenamingExt(ext);
    setRenameValue(lastSeg(filePath));
  };

  const cancelRename = () => {
    setRenamingFile(null);
    setRenamingExt('');
    setRenameValue('');
  };

  const switchView = (nextView: PanelView) => {
    setView(nextView);
    setRenamingFile(null);
    setRenamingFolder(null);
    setNewFolderOpen(false);
    if (nextView === 'trash') {
      refreshTrash();
    }
  };

  const isEmpty =
    view === 'files' ? dirs.length === 0 && files.length === 0 : trashFiles.length === 0;

  // ----- 渲染辅助 -----

  // WebView2/浏览器要在 dragstart 时写入数据，否则 drop 事件不会触发。
  // drop 时优先从 dataTransfer 读取，避免依赖可能已重置的 React 状态
  const setDragData = (event: React.DragEvent, item: DragItem) => {
    event.dataTransfer.setData('text/plain', JSON.stringify(item));
    event.dataTransfer.effectAllowed = 'move';
  };

  const readDragData = (event: React.DragEvent): DragItem | null => {
    try {
      const raw = event.dataTransfer.getData('text/plain');
      if (raw) {
        const parsed = JSON.parse(raw) as DragItem;
        if (
          parsed &&
          (parsed.type === 'file' || parsed.type === 'folder') &&
          typeof parsed.id === 'string'
        ) {
          return parsed;
        }
      }
    } catch {
      // 非本面板的拖拽数据，忽略
    }
    return null;
  };

  const dragHandlers = (key: string) => ({
    onDragOver: (event: React.DragEvent) => {
      // 必须 preventDefault 才允许 drop；不依赖 dragItem 状态，避免状态重置后无法放置
      event.preventDefault();
      event.stopPropagation();
      setDragOverKey(key);
    },
    onDragLeave: () => {
      setDragOverKey((current) => (current === key ? null : current));
    },
  });

  const isFolderExpanded = (dirPath: string) => expandedFolders[dirPath] ?? true;

  const toggleFolder = (dirPath: string) => {
    setExpandedFolders((prev) => ({ ...prev, [dirPath]: !isFolderExpanded(dirPath) }));
  };

  // 新建分组输入：newFolderParent 为 null 表示根目录，否则在对应分组内
  const renderNewFolderInput = () => (
    <InlineNameInput
      className="tauri-file-panel__new-folder-input"
      placeholder={t('filePanel.newFolderPlaceholder')}
      value={newFolderName}
      onChange={setNewFolderName}
      onCommit={handleCreateFolder}
      onCancel={() => {
        setNewFolderOpen(false);
        setNewFolderName('');
      }}
    />
  );

  // 文件项：普通态与重命名态。
  // 路径不含扩展名，同名不同类型文件的 path 相同：
  // key 与选中/拖拽/重命名等状态判别都要带上 ext，避免互相串扰
  const renderFileItem = (file: TauriTreeFileEntry) => {
    const path = file.path;
    const ext = file.ext;
    const key = `file:${path}:${ext}`;
    if (renamingFile === path && renamingExt === ext) {
      return (
        <InlineNameInput
          key={key}
          value={renameValue}
          selectOnFocus
          onChange={setRenameValue}
          onCommit={confirmRename}
          onCancel={cancelRename}
        />
      );
    }
    return (
      <button
        key={key}
        type="button"
        draggable
        onDragStart={(event) => {
          setDragItem({ type: 'file', id: path, ext });
          setDragData(event, { type: 'file', id: path, ext });
        }}
        onDragEnd={resetDrag}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handleDropOnFile(path, ext, event);
        }}
        {...dragHandlers(key)}
        className={classNames('tauri-file-panel__item', {
          'tauri-file-panel__item--active':
            path === currentFile && ext === currentFileType,
          'tauri-file-panel__item--dragover': dragOverKey === key,
          'tauri-file-panel__item--dragging':
            dragItem?.id === path && dragItem.type === 'file' && dragItem.ext === ext,
        })}
        title={path}
        onClick={() => handleOpenFile(path, ext)}
        onContextMenu={(event) =>
          handleItemContextMenu(event, 'file', path, false, ext)
        }
      >
        <span
          className={classNames(
            'tauri-file-panel__file-icon',
            `tauri-file-panel__file-icon--${ext}`
          )}
        >
          {ext === 'table' ? TableIcon : ext === 'md' ? MdIcon : BoardIcon}
        </span>
        <span className="tauri-file-panel__item-name">{lastSeg(path)}</span>
        <span
          className={classNames(
            'tauri-file-panel__item-ext',
            `tauri-file-panel__item-ext--${ext}`
          )}
        >
          {ext.toUpperCase()}
        </span>
      </button>
    );
  };

  // 分组行 + 树形嵌套渲染子目录与文件
  const renderFolderRow = (dirPath: string) => {
    const key = `folder:${dirPath}`;
    const expanded = isFolderExpanded(dirPath);
    // 当前打开的文件位于该分组（含更深层级）内时标示该分组
    const hasActiveChild = !!currentFile && currentFile.startsWith(`${dirPath}/`);
    return (
      <div key={dirPath} className="tauri-file-panel__group">
        {renamingFolder === dirPath ? (
          <InlineNameInput
            value={renamingFolderValue}
            selectOnFocus
            onChange={setRenamingFolderValue}
            onCommit={confirmRenameFolder}
            onCancel={cancelRenameFolder}
          />
        ) : (
          // 文件夹行用 div 容器承载拖拽，内部折叠按钮与「···」按钮并列（C3/C4）
          <div
            draggable
            onDragStart={(event) => {
              setDragItem({ type: 'folder', id: dirPath });
              setDragData(event, { type: 'folder', id: dirPath });
            }}
            onDragEnd={resetDrag}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleDropOnFolder(dirPath, event);
            }}
            {...dragHandlers(key)}
            className={classNames('tauri-file-panel__folder-row', {
              'tauri-file-panel__folder-row--active-child': hasActiveChild,
              'tauri-file-panel__folder-row--dragover': dragOverKey === key,
              'tauri-file-panel__folder-row--dragging':
                dragItem?.id === dirPath && dragItem.type === 'folder',
            })}
          >
            <button
              type="button"
              className="tauri-file-panel__folder-main"
              title={dirPath}
              onClick={() => toggleFolder(dirPath)}
              onContextMenu={(event) =>
                handleItemContextMenu(event, 'folder', dirPath, false)
              }
            >
              <span
                className={classNames('tauri-file-panel__chevron', {
                  'tauri-file-panel__chevron--expanded': expanded,
                })}
              >
                {ChevronRightIcon}
              </span>
              <span className="tauri-file-panel__folder-icon">
                {FolderFilledIcon}
              </span>
              <span className="tauri-file-panel__folder-name">
                {lastSeg(dirPath)}
              </span>
            </button>
            <span
              className="tauri-file-panel__folder-count"
              aria-hidden="true"
            >
              {orderedFilesIn(dirPath).length}
            </span>
            <button
              type="button"
              className="tauri-file-panel__folder-more"
              title={t('workbench.tab.more')}
              aria-label={t('workbench.tab.more')}
              onClick={(event) =>
                handleItemContextMenu(event, 'folder', dirPath, false)
              }
            >
              {MoreIcon}
            </button>
          </div>
        )}
        {expanded && (
          <div className="tauri-file-panel__tree-children">
            {orderedChildDirs(dirPath).map((d) => renderFolderRow(d.path))}
            {orderedFilesIn(dirPath).map((f) => renderFileItem(f))}
            {newFolderOpen && newFolderParent === dirPath && renderNewFolderInput()}
          </div>
        )}
      </div>
    );
  };

  const renderDirChildren = (dir: string) => (
    <>
      {orderedChildDirs(dir).map((d) => renderFolderRow(d.path))}
      {orderedFilesIn(dir).map((f) => renderFileItem(f))}
    </>
  );

  return (
    <>
      {/* 窄屏抽屉遮罩（G2/G4）：点击收起面板 */}
      <div
        className={classNames('tauri-file-panel__mask', {
          'tauri-file-panel__mask--open': sidebarOpen,
        })}
        aria-hidden="true"
        onPointerDown={() => setSidebarOpen(false)}
      />
      {/* 面板留白收零：品牌头顶到窗口顶，底边线与页签栏严格对齐（各分区自带补回的内边距） */}
      <Island
      padding={0}
      className={classNames('tauri-file-panel', ATTACHED_ELEMENT_CLASS_NAME, {
        'tauri-file-panel--drawer-open': sidebarOpen,
      })}
    >
      {/* 品牌头（C1/D1）：logo + 思画/DRAWNIX + 窗口三钮；文件名已上移到页签栏。
          data-tauri-drag-region 标在容器与纯展示元素上（Tauri 仅认 mousedown 目标本身），
          按住品牌区空白 / logo / 文字均可拖动窗口，窗口三钮为子元素不受影响 */}
      <div className="tauri-file-panel__header" data-tauri-drag-region="">
        <span
          className="tauri-file-panel__brand-logo"
          aria-hidden="true"
          data-tauri-drag-region=""
        >
          {BoardIcon}
        </span>
        <span className="tauri-file-panel__brand-text" data-tauri-drag-region="">
          <span
            className="tauri-file-panel__brand-name"
            data-tauri-drag-region=""
          >
            {t('workbench.brand.name')}
          </span>
          <span
            className="tauri-file-panel__brand-en"
            data-tauri-drag-region=""
          >
            {t('workbench.brand.en')}
          </span>
        </span>
        <WindowControls onRequestClose={() => setExitConfirmOpen(true)} />
        {/* 窄屏抽屉的「收起文件面板」（D6）：右箭头图标，避免与窗口关闭 × 混淆 */}
        <button
          type="button"
          className="tauri-file-panel__drawer-collapse"
          title={t('workbench.tab.collapsePanel')}
          aria-label={t('workbench.tab.collapsePanel')}
          onClick={() => setSidebarOpen(false)}
        >
          {ChevronRightIcon}
        </button>
      </div>
      <div className="tauri-file-panel__toolbar">
        {view === 'trash' ? (
          <button
            type="button"
            className="tauri-file-panel__new-button tauri-file-panel__new-button--danger"
            disabled={trashFiles.length === 0}
            onClick={() => setEmptyTrashOpen(true)}
          >
            {t('filePanel.emptyTrash')}
          </button>
        ) : (
          // 蓝色拆分按钮（C2）：主按钮打开完整弹窗；悬停按钮任意位置直接展开类型菜单，
          // 菜单锚定整个按钮、宽度与按钮一致；箭头点击保留手动开合。
          // 注意：PopoverTrigger asChild 的子元素不能自带 ref（会覆盖 Floating UI 的
          // reference ref 导致菜单定位归零），宽度测量 ref 放在外层包裹 div 上
          <div
            ref={splitRef}
            className="tauri-file-panel__split-wrap"
            onMouseEnter={openNewMenuOnHover}
            onMouseLeave={scheduleCloseNewMenuOnHover}
          >
            <Popover
              placement="bottom-start"
              open={newMenuOpen}
              onOpenChange={setNewMenuOpen}
            >
              <PopoverTrigger asChild>
                <div className="tauri-file-panel__split">
                  <button
                    type="button"
                    className="tauri-file-panel__split-main"
                    onClick={() => {
                      setNewMenuOpen(false);
                      openCreateDialog();
                    }}
                  >
                    {PlusIcon}
                    <span>{t('filePanel.newFile')}</span>
                  </button>
                  <button
                    type="button"
                    className="tauri-file-panel__split-arrow"
                    title={t('workbench.panel.newMore')}
                    aria-label={t('workbench.panel.newMore')}
                    aria-haspopup="menu"
                    onPointerDown={() => setNewMenuOpen(!newMenuOpen)}
                  >
                    {ChevronDownIcon}
                  </button>
                </div>
              </PopoverTrigger>
              {/* 菜单浮层 portal 到 .drawnix 根：插到 board container 会触发 plait 画布视口异常（局部不重绘发黑） */}
              <PopoverContent
                container={document.querySelector('.drawnix')}
                style={{ width: splitWidth }}
                onMouseEnter={openNewMenuOnHover}
                onMouseLeave={scheduleCloseNewMenuOnHover}
              >
                <Menu
                  onSelect={() => {
                    setNewMenuOpen(false);
                  }}
                >
                  <MenuItem
                    icon={
                      <span className="tauri-file-panel__menu-icon tauri-file-panel__menu-icon--board">
                        {BoardIcon}
                      </span>
                    }
                    onSelect={() => openCreateDialog('board')}
                  >
                    {t('workbench.panel.newBoard')}
                  </MenuItem>
                  <MenuItem
                    icon={
                      <span className="tauri-file-panel__menu-icon tauri-file-panel__menu-icon--table">
                        {TableIcon}
                      </span>
                    }
                    onSelect={() => openCreateDialog('table')}
                  >
                    {t('workbench.panel.newTable')}
                  </MenuItem>
                  <MenuItem
                    icon={
                      <span className="tauri-file-panel__menu-icon tauri-file-panel__menu-icon--md">
                        {MdIcon}
                      </span>
                    }
                    onSelect={() => openCreateDialog('md')}
                  >
                    {t('workbench.panel.newMd')}
                  </MenuItem>
                  <MenuItem
                    icon={
                      <span className="tauri-file-panel__menu-icon tauri-file-panel__menu-icon--folder">
                        {FolderIcon}
                      </span>
                    }
                    onSelect={() => {
                      setNewMenuOpen(false);
                      setNewFolderParent(null);
                      setNewFolderOpen(true);
                      setNewFolderName('');
                    }}
                  >
                    {t('workbench.panel.newFolder')}
                  </MenuItem>
                </Menu>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
      <div
        className="tauri-file-panel__list"
        onDrop={(event) => {
          event.preventDefault();
          handleDropOnRoot(event);
        }}
        {...dragHandlers('list-root')}
      >
        {isEmpty && (
          <div className="tauri-file-panel__empty">
            {t(view === 'files' ? 'filePanel.empty' : 'filePanel.trashEmpty')}
          </div>
        )}
        {view === 'files' && (
          <>
            {newFolderOpen && newFolderParent === null && renderNewFolderInput()}
            {renderDirChildren('')}
          </>
        )}
        {view === 'trash' &&
          trashFiles.map((file) => (
            <button
              key={file.trashFile}
              type="button"
              className="tauri-file-panel__item"
              title={`${file.path} · ${new Date(file.deletedAt).toLocaleString()}`}
              onContextMenu={(event) =>
                handleItemContextMenu(event, 'file', file.trashFile, true, file.ext)
              }
            >
              <span
                className={classNames(
                  'tauri-file-panel__file-icon',
                  `tauri-file-panel__file-icon--${file.ext}`
                )}
              >
                {file.ext === 'table'
                  ? TableIcon
                  : file.ext === 'md'
                    ? MdIcon
                    : BoardIcon}
              </span>
              <span className="tauri-file-panel__item-name">{lastSeg(file.path)}</span>
              <span
                className={classNames(
                  'tauri-file-panel__item-ext',
                  `tauri-file-panel__item-ext--${file.ext}`
                )}
              >
                {file.ext.toUpperCase()}
              </span>
            </button>
          ))}
      </div>
      {contextMenu && (
        <div
          className="tauri-file-panel__context-overlay"
          onPointerDown={() => setContextMenu(null)}
          onContextMenu={(event) => {
            event.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            className="tauri-file-panel__context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {contextMenu.kind === 'folder' ? (
              <>
                <button
                  type="button"
                  className="tauri-file-panel__context-item"
                  onClick={() => {
                    startRenameFolder(contextMenu.target);
                    setContextMenu(null);
                  }}
                >
                  {t('filePanel.rename')}
                </button>
                <button
                  type="button"
                  className="tauri-file-panel__context-item"
                  onClick={() => {
                    const parent = contextMenu.target;
                    setContextMenu(null);
                    setExpandedFolders((prev) => ({ ...prev, [parent]: true }));
                    setNewFolderParent(parent);
                    setNewFolderOpen(true);
                    setNewFolderName('');
                  }}
                >
                  {t('filePanel.newSubFolder')}
                </button>
                <button
                  type="button"
                  className="tauri-file-panel__context-item"
                  onClick={() =>
                    closeContextMenuAnd((target) =>
                      setMoveTarget({ kind: 'folder', path: target })
                    )
                  }
                >
                  {t('filePanel.move')}
                </button>
                <button
                  type="button"
                  className="tauri-file-panel__context-item tauri-file-panel__context-item--danger"
                  onClick={() => closeContextMenuAnd((target) => setDeleteFolderTarget(target))}
                >
                  {t('filePanel.delete')}
                </button>
              </>
            ) : contextMenu.trash ? (
              <button
                type="button"
                className="tauri-file-panel__context-item"
                onClick={() => closeContextMenuAnd(handleRestoreFile)}
              >
                {t('filePanel.restore')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="tauri-file-panel__context-item"
                  onClick={() =>
                    startRename(contextMenu.target, contextMenu.ext ?? 'drawnix')
                  }
                >
                  {t('filePanel.rename')}
                </button>
                {contextMenu.ext !== 'table' && (
                  <button
                    type="button"
                    className="tauri-file-panel__context-item"
                    onClick={() =>
                      closeContextMenuAnd((target) =>
                        handleSaveFileAs(target, contextMenu.ext ?? 'drawnix')
                      )
                    }
                  >
                    {t('filePanel.saveAs')}
                  </button>
                )}
                {contextMenu.ext === 'drawnix' && (
                  <div
                    className="tauri-file-panel__context-item-wrapper"
                    onMouseEnter={() =>
                      setContextMenu((cm) => cm && { ...cm, exportOpen: true })
                    }
                  >
                    <button
                      type="button"
                      className="tauri-file-panel__context-item"
                      onClick={() =>
                        setContextMenu((cm) => cm && { ...cm, exportOpen: true })
                      }
                    >
                      {t('filePanel.exportImage')}
                      <span className="tauri-file-panel__submenu-arrow">▸</span>
                    </button>
                    {contextMenu.exportOpen && (
                      <div className="tauri-file-panel__context-submenu">
                        <button
                          type="button"
                          className="tauri-file-panel__context-item"
                          onClick={() => {
                            const { target } = contextMenu;
                            setContextMenu(null);
                            handleExportImage(target, 'png');
                          }}
                        >
                          {t('menu.exportImage.png')}
                        </button>
                        <button
                          type="button"
                          className="tauri-file-panel__context-item"
                          onClick={() => {
                            const { target } = contextMenu;
                            setContextMenu(null);
                            handleExportImage(target, 'svg');
                          }}
                        >
                          {t('menu.exportImage.svg')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className="tauri-file-panel__context-item"
                  onClick={() =>
                    closeContextMenuAnd((target) =>
                      setMoveTarget({
                        kind: 'file',
                        path: target,
                        ext: contextMenu.ext ?? 'drawnix',
                      })
                    )
                  }
                >
                  {t('filePanel.move')}
                </button>
                <button
                  type="button"
                  className="tauri-file-panel__context-item tauri-file-panel__context-item--danger"
                  onClick={() =>
                    closeContextMenuAnd((target) =>
                      setDeleteTarget({
                        path: target,
                        ext: contextMenu.ext ?? 'drawnix',
                      })
                    )
                  }
                >
                  {t('filePanel.delete')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      <SidebarFooter
        trashActive={view === 'trash'}
        onTrashToggle={() => switchView(view === 'files' ? 'trash' : 'files')}
      ></SidebarFooter>
      <CreateFileDialog
        open={createDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeCreateDialog();
          }
        }}
        container={PlaitBoard.getBoardContainer(board)}
        onCreate={handleCreateFile}
        presetType={createDialog?.presetType ?? null}
      ></CreateFileDialog>
      <MoveEntryDialog
        open={!!moveTarget}
        onOpenChange={(open) => {
          if (!open) {
            setMoveTarget(null);
          }
        }}
        container={PlaitBoard.getBoardContainer(board)}
        kind={moveTarget?.kind ?? 'file'}
        path={moveTarget?.path ?? null}
        onMove={handleMoveEntry}
      ></MoveEntryDialog>
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent
          className="clean-confirm"
          container={PlaitBoard.getBoardContainer(board)}
        >
          <h2 className="clean-confirm__title">{t('deleteConfirm.title')}</h2>
          <p className="clean-confirm__description">{t('deleteConfirm.description')}</p>
          <div className="clean-confirm__actions">
            <button
              type="button"
              className="clean-confirm__button clean-confirm__button--cancel"
              onClick={() => setDeleteTarget(null)}
            >
              {t('cleanConfirm.cancel')}
            </button>
            <button
              type="button"
              className="clean-confirm__button clean-confirm__button--ok"
              autoFocus
              onClick={handleDeleteFile}
            >
              {t('deleteConfirm.ok')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleteFolderTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteFolderTarget(null);
          }
        }}
      >
        <DialogContent
          className="clean-confirm"
          container={PlaitBoard.getBoardContainer(board)}
        >
          <h2 className="clean-confirm__title">{t('folderDeleteConfirm.title')}</h2>
          <p className="clean-confirm__description">
            {t('folderDeleteConfirm.description')}
          </p>
          <div className="clean-confirm__actions">
            <button
              type="button"
              className="clean-confirm__button clean-confirm__button--cancel"
              onClick={() => setDeleteFolderTarget(null)}
            >
              {t('cleanConfirm.cancel')}
            </button>
            <button
              type="button"
              className="clean-confirm__button clean-confirm__button--ok"
              autoFocus
              onClick={handleDeleteFolder}
            >
              {t('deleteConfirm.ok')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={emptyTrashOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEmptyTrashOpen(false);
          }
        }}
      >
        <DialogContent
          className="clean-confirm"
          container={PlaitBoard.getBoardContainer(board)}
        >
          <h2 className="clean-confirm__title">{t('emptyTrashConfirm.title')}</h2>
          <p className="clean-confirm__description">{t('emptyTrashConfirm.description')}</p>
          <div className="clean-confirm__actions">
            <button
              type="button"
              className="clean-confirm__button clean-confirm__button--cancel"
              onClick={() => setEmptyTrashOpen(false)}
            >
              {t('cleanConfirm.cancel')}
            </button>
            <button
              type="button"
              className="clean-confirm__button clean-confirm__button--ok"
              autoFocus
              onClick={handleEmptyTrash}
            >
              {t('emptyTrashConfirm.ok')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Island>
    </>
  );
};

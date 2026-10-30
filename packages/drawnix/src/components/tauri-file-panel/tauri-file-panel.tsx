import { useCallback, useEffect, useState } from 'react';
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
import { ChevronRightIcon, FolderIcon } from '../icons';
import {
  DATA_DIR_CHANGED_EVENT,
  TAURI_FILES_CHANGED_EVENT,
  TauriOrderMap,
  TauriTrashEntry,
  TauriTreeDirEntry,
  TauriTreeResult,
  buildEmptyDrawnixContent,
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
  parseTauriFileContent,
  readTauriFile,
  renameTauriFile,
  renameTauriFolder,
  reorderTauriItems,
  restoreTauriFile,
  saveToTauriFile,
  setCurrentTauriFile,
  suppressTauriDirty,
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
import './tauri-file-panel.scss';

type PanelView = 'files' | 'trash';

/** 拖拽项：id 为相对路径（文件不含扩展名） */
type DragItem = { type: 'file' | 'folder'; id: string };

type ContextMenuState = {
  x: number;
  y: number;
  kind: 'file' | 'folder';
  target: string;
  trash: boolean;
  exportOpen: boolean;
};

const parentOf = (rel: string) => {
  const idx = rel.lastIndexOf('/');
  return idx < 0 ? '' : rel.slice(0, idx);
};

const lastSeg = (rel: string) => rel.slice(rel.lastIndexOf('/') + 1);

const joinPath = (dir: string | null, name: string) =>
  dir ? `${dir}/${name}` : name;

export const TauriFilePanel = () => {
  const board = useBoard();
  const listRender = useListRender();
  const { showToast } = useDrawnix();
  const { t } = useI18n();
  const { currentFile, dirty } = useTauriFileState();
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<{
    kind: 'file' | 'folder';
    path: string;
  } | null>(null);
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);
  const [isTauri] = useState(() => isTauriEnvironment());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renamingFolderValue, setRenamingFolderValue] = useState('');
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

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

  const handleOpenFile = async (path: string) => {
    try {
      if (!(await ensureCurrentFileSaved())) {
        return;
      }
      const content = await readTauriFile(path);
      const { elements, viewport, theme } = parseTauriFileContent(content);
      setCurrentTauriFile(path);
      clearAndLoad(elements as PlaitElement[], viewport, theme);
    } catch (error) {
      console.error('Failed to open drawnix file:', error);
      showErrorToast(t('toast.tauriFile.loadFailed'));
    }
  };

  const handleCreateFile = async (name: string, dirPath: string | null) => {
    try {
      const path = joinPath(dirPath, name);
      await writeTauriFile(path, buildEmptyDrawnixContent());
      setCurrentTauriFile(path);
      clearAndLoad([]);
      refreshTree();
    } catch (error) {
      console.error('Failed to create drawnix file:', error);
      showErrorToast(t('toast.tauriFile.saveFailed'));
    }
  };

  // 另存为：把该文件内容通过系统保存对话框导出为 .drawnix 副本；
  // 另存当前文件时先自动保存，避免导出旧版本
  const handleSaveFileAs = async (filePath: string) => {
    try {
      if (!(await ensureCurrentFileSaved())) {
        return;
      }
      const content = await readTauriFile(filePath);
      const blob = new Blob([content], { type: MIME_TYPES.drawnix });
      await fileSave(blob, {
        name: lastSeg(filePath),
        extension: 'drawnix',
        description: 'Drawnix file',
      });
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        return;
      }
      console.error('Failed to save drawnix file as:', error);
      showErrorToast(t('toast.tauriFile.exportFailed'));
    }
  };

  // 导出图片：非当前文件会先加载到画板再导出；有未保存修改时先自动保存
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
    const path = deleteTarget;
    setDeleteTarget(null);
    if (!path) {
      return;
    }
    try {
      await deleteTauriFile(path);
      if (currentFile === path) {
        setCurrentTauriFile(null);
        clearAndLoad([]);
      }
      refreshTree();
      refreshTrash();
    } catch (error) {
      console.error('Failed to delete drawnix file:', error);
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
      await deleteTauriFolder(path);
      refreshTree();
      refreshTrash();
    } catch (error) {
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
    try {
      if (target.kind === 'file') {
        await moveTauriFileToDir(target.path, targetDir);
        if (currentFile === target.path) {
          setCurrentTauriFile(joinPath(targetDir, lastSeg(target.path)));
        }
      } else {
        await moveTauriFolderToDir(target.path, targetDir);
      }
      refreshTree();
    } catch (error) {
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
      showErrorToast(t('toast.tauriFile.renameFailed'));
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
    try {
      await renameTauriFolder(dirPath, name);
      refreshTree();
    } catch (error) {
      console.error('Failed to rename folder:', error);
      showErrorToast(t('toast.tauriFile.renameFailed'));
    }
  };

  const confirmRename = async () => {
    const oldPath = renamingFile;
    const newName = normalizeTauriFileName(renameValue);
    cancelRename();
    if (!oldPath || !newName || newName === lastSeg(oldPath)) {
      return;
    }
    const newPath = joinPath(parentOf(oldPath), newName);
    try {
      await renameTauriFile(oldPath, newName);
      if (currentFile === oldPath) {
        setCurrentTauriFile(newPath);
      }
      refreshTree();
    } catch (error) {
      console.error('Failed to rename drawnix file:', error);
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

  // 目录下文件顺序：未收录（新建）按创建时间倒序排最前，其余按自定义顺序
  const orderedFilesIn = (dir: string) => {
    const children = files.filter((f) => parentOf(f.path) === dir);
    const orderList = order[dir]?.files ?? [];
    const unlisted = children
      .filter((f) => !orderList.includes(lastSeg(f.path)))
      .sort((a, b) => b.createdAt - a.createdAt);
    const listed = orderList
      .map((name) => children.find((f) => lastSeg(f.path) === name))
      .filter((f): f is NonNullable<typeof f> => !!f);
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

  const moveFile = (path: string, targetDir: string | null) => {
    if (parentOf(path) === (targetDir ?? '')) {
      return;
    }
    moveTauriFileToDir(path, targetDir)
      .then(refreshTree)
      .catch((error) => {
        console.error('Failed to move drawnix file:', error);
        showErrorToast(t('toast.tauriFile.saveFailed'));
      });
  };

  const moveFolder = (path: string, targetDir: string | null) => {
    const target = targetDir ?? '';
    if (parentOf(path) === target || target === path || target.startsWith(`${path}/`)) {
      return;
    }
    moveTauriFolderToDir(path, targetDir)
      .then(refreshTree)
      .catch((error) => {
        console.error('Failed to move folder:', error);
        showErrorToast(t('toast.tauriFile.saveFailed'));
      });
  };

  const resetDrag = () => {
    setDragItem(null);
    setDragOverKey(null);
  };

  // 拖文件到文件上：同目录重排，跨目录则移动到目标文件所在目录
  const handleDropOnFile = (targetPath: string, event: React.DragEvent) => {
    const dragged = readDragData(event);
    resetDrag();
    if (!dragged || dragged.type !== 'file' || dragged.id === targetPath) {
      return;
    }
    const dir = parentOf(targetPath);
    if (parentOf(dragged.id) !== dir) {
      moveFile(dragged.id, dir);
      return;
    }
    const rest = orderedFilesIn(dir)
      .map((f) => f.path)
      .filter((p) => p !== dragged.id);
    const idx = rest.indexOf(targetPath);
    rest.splice(idx < 0 ? rest.length : idx, 0, dragged.id);
    saveDirOrder(dir, { files: rest.map(lastSeg) });
  };

  // 拖到分组行：文件移入分组；分组则移动或同目录重排
  const handleDropOnFolder = (targetDir: string, event: React.DragEvent) => {
    const dragged = readDragData(event);
    resetDrag();
    if (!dragged || dragged.id === targetDir) {
      return;
    }
    if (dragged.type === 'file') {
      moveFile(dragged.id, targetDir);
      return;
    }
    // 文件夹：目标是自己或自己的子孙目录 → 忽略
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
      moveFile(dragged.id, null);
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
    trash: boolean
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

  const startRename = (filePath: string) => {
    setContextMenu(null);
    setRenamingFile(filePath);
    setRenameValue(lastSeg(filePath));
  };

  const cancelRename = () => {
    setRenamingFile(null);
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

  // WebView2/浏览器要求 dragstart 时写入数据，否则 drop 事件不会触发；
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
    <input
      type="text"
      className="tauri-file-panel__rename-input tauri-file-panel__new-folder-input"
      placeholder={t('filePanel.newFolderPlaceholder')}
      value={newFolderName}
      autoFocus
      onChange={(event) => setNewFolderName(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          handleCreateFolder();
        } else if (event.key === 'Escape') {
          setNewFolderOpen(false);
          setNewFolderName('');
        }
      }}
      onBlur={handleCreateFolder}
    />
  );

  // 文件项：普通态与重命名态
  const renderFileItem = (path: string) => {
    const key = `file:${path}`;
    if (renamingFile === path) {
      return (
        <input
          key={path}
          type="text"
          className="tauri-file-panel__rename-input"
          value={renameValue}
          autoFocus
          onFocus={(event) => event.target.select()}
          onChange={(event) => setRenameValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              confirmRename();
            } else if (event.key === 'Escape') {
              cancelRename();
            }
          }}
          onBlur={confirmRename}
        />
      );
    }
    return (
      <button
        key={path}
        type="button"
        draggable
        onDragStart={(event) => {
          setDragItem({ type: 'file', id: path });
          setDragData(event, { type: 'file', id: path });
        }}
        onDragEnd={resetDrag}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handleDropOnFile(path, event);
        }}
        {...dragHandlers(key)}
        className={classNames('tauri-file-panel__item', {
          'tauri-file-panel__item--active': path === currentFile,
          'tauri-file-panel__item--dragover': dragOverKey === key,
          'tauri-file-panel__item--dragging':
            dragItem?.id === path && dragItem.type === 'file',
        })}
        title={path}
        onClick={() => handleOpenFile(path)}
        onContextMenu={(event) => handleItemContextMenu(event, 'file', path, false)}
      >
        {lastSeg(path)}
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
          <input
            type="text"
            className="tauri-file-panel__rename-input"
            value={renamingFolderValue}
            autoFocus
            onFocus={(event) => event.target.select()}
            onChange={(event) => setRenamingFolderValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                confirmRenameFolder();
              } else if (event.key === 'Escape') {
                cancelRenameFolder();
              }
            }}
            onBlur={confirmRenameFolder}
          />
        ) : (
          <button
            type="button"
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
            <span className="tauri-file-panel__folder-icon">{FolderIcon}</span>
            <span className="tauri-file-panel__folder-name">{lastSeg(dirPath)}</span>
          </button>
        )}
        {expanded && (
          <div className="tauri-file-panel__tree-children">
            {orderedChildDirs(dirPath).map((d) => renderFolderRow(d.path))}
            {orderedFilesIn(dirPath).map((f) => renderFileItem(f.path))}
            {newFolderOpen && newFolderParent === dirPath && renderNewFolderInput()}
          </div>
        )}
      </div>
    );
  };

  const renderDirChildren = (dir: string) => (
    <>
      {orderedChildDirs(dir).map((d) => renderFolderRow(d.path))}
      {orderedFilesIn(dir).map((f) => renderFileItem(f.path))}
    </>
  );

  return (
    <Island
      padding={2}
      className={classNames('tauri-file-panel', ATTACHED_ELEMENT_CLASS_NAME)}
    >
      <div className="tauri-file-panel__header">
        <span className="tauri-file-panel__title">
          {t(view === 'files' ? 'filePanel.title' : 'filePanel.trash')}
        </span>
        {view === 'files' && currentFile && (
          <span className="tauri-file-panel__current" title={currentFile}>
            {lastSeg(currentFile)}
            {dirty ? ' •' : ''}
          </span>
        )}
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
          <>
            <button
              type="button"
              className="tauri-file-panel__new-button"
              onClick={() => setCreateDialogOpen(true)}
            >
              {t('filePanel.newFile')}
            </button>
            <button
              type="button"
              className="tauri-file-panel__new-button"
              onClick={() => {
                setNewFolderParent(null);
                setNewFolderOpen(true);
                setNewFolderName('');
              }}
            >
              {t('filePanel.newFolder')}
            </button>
          </>
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
                handleItemContextMenu(event, 'file', file.trashFile, true)
              }
            >
              {lastSeg(file.path)}
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
                  onClick={() => startRename(contextMenu.target)}
                >
                  {t('filePanel.rename')}
                </button>
                <button
                  type="button"
                  className="tauri-file-panel__context-item"
                  onClick={() => closeContextMenuAnd(handleSaveFileAs)}
                >
                  {t('filePanel.saveAs')}
                </button>
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
                    <span className="tauri-file-panel__submenu-arrow">›</span>
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
                <button
                  type="button"
                  className="tauri-file-panel__context-item"
                  onClick={() =>
                    closeContextMenuAnd((target) =>
                      setMoveTarget({ kind: 'file', path: target })
                    )
                  }
                >
                  {t('filePanel.move')}
                </button>
                <button
                  type="button"
                  className="tauri-file-panel__context-item tauri-file-panel__context-item--danger"
                  onClick={() => closeContextMenuAnd((target) => setDeleteTarget(target))}
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
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        container={PlaitBoard.getBoardContainer(board)}
        onCreate={handleCreateFile}
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
  );
};

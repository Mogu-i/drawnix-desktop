import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '../dialog/dialog';
import { Select } from '../select/select';
import {
  CreateTauriFileOptions,
  TauriFileType,
  TauriTreeDirEntry,
  isTauriEnvironment,
  listTauriTree,
  normalizeTauriFileName,
} from '../../data/tauri-file';
import type { CreateDialogPreset } from '../../data/workbench-ui';
import { useI18n } from '../../i18n';
import './create-file-dialog.scss';

const lastSeg = (rel: string) => rel.slice(rel.lastIndexOf('/') + 1);

const parentOf = (rel: string) => {
  const idx = rel.lastIndexOf('/');
  return idx < 0 ? '' : rel.slice(0, idx);
};

const FILE_TYPE_OPTIONS: TauriFileType[] = ['drawnix', 'md', 'table'];

const DEFAULT_TABLE_ROWS = 3;
const DEFAULT_TABLE_COLS = 3;
const MIN_TABLE_SIZE = 1;
const MAX_TABLE_SIZE = 50;

const clampTableSize = (value: number, fallback: number) => {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(MAX_TABLE_SIZE, Math.max(MIN_TABLE_SIZE, Math.round(value)));
};

// 新建文件弹窗：选择文件类型（白板/Markdown/表格）、输入文件名并选择所在目录后
// 确认创建，由侧边栏文件面板与欢迎页共用；
// presetType 非空时预选类型并隐藏类型字段（拆分按钮菜单进入，C2/C8）。
export const CreateFileDialog = ({
  open,
  onOpenChange,
  container,
  onCreate,
  presetType = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container?: HTMLElement | null;
  onCreate: (
    name: string,
    dirPath: string | null,
    fileType: TauriFileType,
    options: CreateTauriFileOptions
  ) => void;
  /** 非空时预选文件类型并隐藏类型字段，标题随之变化 */
  presetType?: CreateDialogPreset;
}) => {
  const { t } = useI18n();
  const [fileName, setFileName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [dirs, setDirs] = useState<TauriTreeDirEntry[]>([]);
  const [dirPath, setDirPath] = useState('');
  const [fileType, setFileType] = useState<TauriFileType>('drawnix');
  const [tableRows, setTableRows] = useState(DEFAULT_TABLE_ROWS);
  const [tableCols, setTableCols] = useState(DEFAULT_TABLE_COLS);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // 预选类型后不再二次选择，标题同步变化
  const hasPreset = presetType !== null && presetType !== 'folder';
  const titleKey = hasPreset
    ? presetType === 'board'
      ? 'workbench.panel.newBoard'
      : presetType === 'table'
        ? 'workbench.panel.newTable'
        : 'workbench.panel.newMd'
    : 'filePanel.newFile';

  useEffect(() => {
    if (open) {
      setFileName('');
      setNameError(null);
      setDirPath('');
      // 预选类型的 board 对应白板引擎的 drawnix
      setFileType(hasPreset ? (presetType === 'board' ? 'drawnix' : presetType) : 'drawnix');
      setTableRows(DEFAULT_TABLE_ROWS);
      setTableCols(DEFAULT_TABLE_COLS);
      if (isTauriEnvironment()) {
        listTauriTree()
          .then((tree) => setDirs(tree.dirs))
          .catch((error) => {
            console.error('Failed to load folders:', error);
          });
      }
    }
  }, [open, presetType, hasPreset]);

  const handleCreate = async () => {
    const name = normalizeTauriFileName(fileName);
    if (!name) {
      // 空名：显示错误并保留输入与焦点（C8）
      setNameError(t('workbench.create.nameEmpty'));
      nameInputRef.current?.focus();
      return;
    }
    // 同名校验：同目录下文件与目录都不能重名（C8）
    if (isTauriEnvironment()) {
      try {
        const tree = await listTauriTree();
        const parent = dirPath || '';
        const taken = new Set<string>();
        tree.files.forEach((file) => {
          if (parentOf(file.path) === parent) {
            taken.add(lastSeg(file.path));
          }
        });
        tree.dirs.forEach((entry) => {
          if (parentOf(entry.path) === parent) {
            taken.add(lastSeg(entry.path));
          }
        });
        if (taken.has(name)) {
          setNameError(t('workbench.create.nameDuplicate'));
          nameInputRef.current?.focus();
          return;
        }
      } catch (error) {
        console.error('Failed to check duplicate name:', error);
      }
    }
    onCreate(name, dirPath || null, fileType, {
      rows: clampTableSize(tableRows, DEFAULT_TABLE_ROWS),
      cols: clampTableSize(tableCols, DEFAULT_TABLE_COLS),
    });
    onOpenChange(false);
  };

  // 选项按路径深度缩进，展示目录层级
  const sortedDirs = [...dirs].sort((a, b) => a.path.localeCompare(b.path));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="create-file-dialog" container={container}>
        <h2 className="create-file-dialog__title">{t(titleKey)}</h2>
        {dirs.length > 0 && (
          <div className="create-file-dialog__group">
            <div className="create-file-dialog__group-label">
              {t('filePanel.folderLocation')}
            </div>
            <Select.Root
              value={dirPath}
              onValueChange={(value) => {
                setDirPath(value);
              }}
            >
              <Select.Trigger
                className="create-file-dialog__select"
                aria-label={t('filePanel.folderLocation')}
              >
                {dirPath
                  ? lastSeg(dirPath)
                  : t('filePanel.defaultLocation')}
              </Select.Trigger>
              <Select.Content container={container}>
                <Select.Item value="">{t('filePanel.defaultLocation')}</Select.Item>
                {sortedDirs.map((dir) => (
                  <Select.Item key={dir.path} value={dir.path}>
                    {'　'.repeat(parentOf(dir.path) ? parentOf(dir.path).split('/').length : 0)}
                    {lastSeg(dir.path)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </div>
        )}
        {!hasPreset && (
          <div className="create-file-dialog__group">
            <div className="create-file-dialog__group-label">
              {t('filePanel.fileType')}
            </div>
            <Select.Root
              value={fileType}
              onValueChange={(value) => {
                setFileType(value as TauriFileType);
              }}
            >
              <Select.Trigger
                className="create-file-dialog__select"
                aria-label={t('filePanel.fileType')}
              >
                {t(`filePanel.fileType.${fileType}`)}
              </Select.Trigger>
              <Select.Content container={container}>
                {FILE_TYPE_OPTIONS.map((type) => (
                  <Select.Item key={type} value={type}>
                    {t(`filePanel.fileType.${type}`)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </div>
        )}
        <div className="create-file-dialog__group">
          <div className="create-file-dialog__group-label">{t('filePanel.fileName')}</div>
          <input
            ref={nameInputRef}
            className="create-file-dialog__input"
            type="text"
            placeholder={t('filePanel.newFilePlaceholder')}
            value={fileName}
            autoFocus
            aria-invalid={nameError ? true : undefined}
            onFocus={(event) => event.target.select()}
            onChange={(event) => {
              setFileName(event.target.value);
              if (nameError) {
                setNameError(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleCreate();
              }
            }}
          />
          {nameError && (
            <div className="create-file-dialog__error" role="alert">
              {nameError}
            </div>
          )}
        </div>
        {fileType === 'table' && (
          <div className="create-file-dialog__group create-file-dialog__group--table-size">
            <div className="create-file-dialog__table-size">
              <label className="create-file-dialog__table-size-item">
                <span>{t('filePanel.tableRows')}</span>
                <input
                  type="number"
                  min={MIN_TABLE_SIZE}
                  max={MAX_TABLE_SIZE}
                  value={tableRows}
                  onChange={(event) =>
                    setTableRows(clampTableSize(Number(event.target.value), DEFAULT_TABLE_ROWS))
                  }
                />
              </label>
              <label className="create-file-dialog__table-size-item">
                <span>{t('filePanel.tableCols')}</span>
                <input
                  type="number"
                  min={MIN_TABLE_SIZE}
                  max={MAX_TABLE_SIZE}
                  value={tableCols}
                  onChange={(event) =>
                    setTableCols(clampTableSize(Number(event.target.value), DEFAULT_TABLE_COLS))
                  }
                />
              </label>
            </div>
          </div>
        )}
        <div className="create-file-dialog__actions">
          <button
            type="button"
            className="create-file-dialog__button create-file-dialog__button--cancel"
            onClick={() => onOpenChange(false)}
          >
            {t('cleanConfirm.cancel')}
          </button>
          <button
            type="button"
            className="create-file-dialog__button create-file-dialog__button--ok"
            onClick={() => void handleCreate()}
          >
            {t('cleanConfirm.ok')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

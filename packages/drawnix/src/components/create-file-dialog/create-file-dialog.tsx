import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '../dialog/dialog';
import { Select } from '../select/select';
import {
  TauriTreeDirEntry,
  isTauriEnvironment,
  listTauriTree,
  normalizeTauriFileName,
} from '../../data/tauri-file';
import { useI18n } from '../../i18n';
import './create-file-dialog.scss';

const lastSeg = (rel: string) => rel.slice(rel.lastIndexOf('/') + 1);

const parentOf = (rel: string) => {
  const idx = rel.lastIndexOf('/');
  return idx < 0 ? '' : rel.slice(0, idx);
};

// 新建文件弹窗：输入文件名并选择所在目录后确认创建，
// 由侧边栏文件面板与欢迎页共用。
export const CreateFileDialog = ({
  open,
  onOpenChange,
  container,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container?: HTMLElement | null;
  onCreate: (name: string, dirPath: string | null) => void;
}) => {
  const { t } = useI18n();
  const [fileName, setFileName] = useState('');
  const [dirs, setDirs] = useState<TauriTreeDirEntry[]>([]);
  const [dirPath, setDirPath] = useState('');

  useEffect(() => {
    if (open) {
      setFileName('');
      setDirPath('');
      if (isTauriEnvironment()) {
        listTauriTree()
          .then((tree) => setDirs(tree.dirs))
          .catch((error) => {
            console.error('Failed to load folders:', error);
          });
      }
    }
  }, [open]);

  const handleCreate = () => {
    const name = normalizeTauriFileName(fileName);
    if (!name) {
      return;
    }
    onCreate(name, dirPath || null);
    onOpenChange(false);
  };

  // 选项按路径深度缩进，展示目录层级
  const sortedDirs = [...dirs].sort((a, b) => a.path.localeCompare(b.path));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="create-file-dialog" container={container}>
        <h2 className="create-file-dialog__title">{t('filePanel.newFile')}</h2>
        <input
          className="create-file-dialog__input"
          type="text"
          placeholder={t('filePanel.newFilePlaceholder')}
          value={fileName}
          autoFocus
          onFocus={(event) => event.target.select()}
          onChange={(event) => setFileName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleCreate();
            }
          }}
        />
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
            disabled={!normalizeTauriFileName(fileName)}
            onClick={handleCreate}
          >
            {t('cleanConfirm.ok')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '../dialog/dialog';
import { Select } from '../select/select';
import { TauriTreeDirEntry, isTauriEnvironment, listTauriTree } from '../../data/tauri-file';
import { useI18n } from '../../i18n';
import '../create-file-dialog/create-file-dialog.scss';

const lastSeg = (rel: string) => rel.slice(rel.lastIndexOf('/') + 1);

const depthOf = (rel: string) => rel.split('/').length - 1;

// 移动文件/分组弹窗：下拉选择目标目录（分组）后确认移动
export const MoveEntryDialog = ({
  open,
  onOpenChange,
  container,
  kind,
  path,
  onMove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container?: HTMLElement | null;
  kind: 'file' | 'folder';
  path: string | null;
  onMove: (targetDir: string | null) => void;
}) => {
  const { t } = useI18n();
  const [dirs, setDirs] = useState<TauriTreeDirEntry[]>([]);
  const [targetDir, setTargetDir] = useState('');

  useEffect(() => {
    if (open) {
      setTargetDir('');
      if (isTauriEnvironment()) {
        listTauriTree()
          .then((tree) => setDirs(tree.dirs))
          .catch((error) => {
            console.error('Failed to load folders:', error);
          });
      }
    }
  }, [open]);

  // 移动分组时排除自身与自己的子孙目录
  const candidates = dirs.filter((dir) => {
    if (kind !== 'folder' || !path) {
      return true;
    }
    return dir.path !== path && !dir.path.startsWith(`${path}/`);
  });
  const sortedDirs = [...candidates].sort((a, b) => a.path.localeCompare(b.path));

  const handleMove = () => {
    if (!path) {
      return;
    }
    onMove(targetDir || null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="create-file-dialog" container={container}>
        <h2 className="create-file-dialog__title">{t('moveDialog.title')}</h2>
        <div className="create-file-dialog__group">
          <div className="create-file-dialog__group-label">
            {t('filePanel.folderLocation')}
          </div>
          <Select.Root
            value={targetDir}
            onValueChange={(value) => {
              setTargetDir(value);
            }}
          >
            <Select.Trigger
              className="create-file-dialog__select"
              aria-label={t('moveDialog.title')}
            >
              {targetDir ? lastSeg(targetDir) : t('filePanel.defaultLocation')}
            </Select.Trigger>
            <Select.Content container={container}>
              <Select.Item value="">{t('filePanel.defaultLocation')}</Select.Item>
              {sortedDirs.map((dir) => (
                <Select.Item key={dir.path} value={dir.path}>
                  {'　'.repeat(depthOf(dir.path))}
                  {lastSeg(dir.path)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>
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
            disabled={!path}
            onClick={handleMove}
          >
            {t('cleanConfirm.ok')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

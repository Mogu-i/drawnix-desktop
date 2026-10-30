import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '../dialog/dialog';
import { Select } from '../select/select';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';
import { Language, Translations } from '../../i18n/types';
import {
  getDataDir,
  getTrashRetentionDays,
  isTauriEnvironment,
  notifyDataDirChanged,
  pickDataDir,
  setDataDir,
  setTrashRetentionDays,
} from '../../data/tauri-file';
import './settings-dialog.scss';

const LANGUAGE_OPTIONS: { value: Language; labelKey: keyof Translations }[] = [
  { value: 'zh', labelKey: 'language.chinese' },
  { value: 'en', labelKey: 'language.english' },
  { value: 'ru', labelKey: 'language.russian' },
  { value: 'ar', labelKey: 'language.arabic' },
  { value: 'vi', labelKey: 'language.vietnamese' },
];

export const SettingsDialog = ({
  open,
  onOpenChange,
  container,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container?: HTMLElement | null;
}) => {
  const { t, language, setLanguage } = useI18n();
  const { showToast } = useDrawnix();
  const [isTauri] = useState(() => isTauriEnvironment());
  const [dataDir, setDataDirState] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [trashDays, setTrashDays] = useState(3);

  useEffect(() => {
    if (open && isTauriEnvironment()) {
      getDataDir()
        .then(setDataDirState)
        .catch((error) => {
          console.error('Failed to load data dir:', error);
        });
      getTrashRetentionDays()
        .then(setTrashDays)
        .catch((error) => {
          console.error('Failed to load trash retention days:', error);
        });
    }
  }, [open]);

  const handleBrowseDataDir = async () => {
    try {
      const path = await pickDataDir();
      if (!path) {
        return;
      }
      if (path === dataDir) {
        showToast({ message: t('settings.dataDirSamePath') });
        return;
      }
      setMigrating(true);
      const result = await setDataDir(path);
      setDataDirState(result.dataDir);
      notifyDataDirChanged();
      showToast({
        message: `${result.migratedFiles} ${t('settings.dataDirMigratedFiles')}`,
      });
    } catch (error) {
      console.error('Failed to migrate data dir:', error);
      showToast({ message: t('settings.dataDirMigrateFailed') });
    } finally {
      setMigrating(false);
    }
  };

  const handleTrashDaysChange = (value: number) => {
    // 至少保留 1 天，与后端约束一致
    const days = Math.max(1, Math.floor(value) || 1);
    setTrashDays(days);
    setTrashRetentionDays(days).catch((error) => {
      console.error('Failed to save trash retention days:', error);
      showToast({ message: t('toast.tauriFile.saveFailed') });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="settings-dialog" container={container}>
        <h2 className="settings-dialog__title">{t('settings.title')}</h2>

        <div className="settings-dialog__section">
          <div className="settings-dialog__section-label">{t('settings.language')}</div>
          <Select.Root
            value={language}
            onValueChange={(value) => {
              setLanguage(value as Language);
            }}
          >
            <Select.Trigger
              className="settings-dialog__select"
              aria-label={t('settings.language')}
            >
              {t(
                LANGUAGE_OPTIONS.find((option) => option.value === language)?.labelKey ??
                  'language.english'
              )}
            </Select.Trigger>
            <Select.Content container={container}>
              {LANGUAGE_OPTIONS.map((option) => (
                <Select.Item key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>

        {isTauri && (
          <div className="settings-dialog__section">
            <div className="settings-dialog__section-label">{t('settings.dataDir')}</div>
            <div className="settings-dialog__data-dir">
              <span className="settings-dialog__data-dir-path" title={dataDir}>
                {dataDir || '-'}
              </span>
              <button
                type="button"
                className="settings-dialog__browse-button"
                disabled={migrating}
                onClick={handleBrowseDataDir}
              >
                {migrating ? t('settings.dataDirMigrating') : t('settings.dataDirBrowse')}
              </button>
            </div>
            <p className="settings-dialog__hint">{t('settings.dataDirHint')}</p>
          </div>
        )}

        {isTauri && (
          <div className="settings-dialog__section">
            <div className="settings-dialog__section-label">
              {t('settings.trashRetentionDays')}
            </div>
            <div className="settings-dialog__trash-days">
              <input
                type="number"
                min={1}
                className="settings-dialog__trash-days-input"
                value={trashDays}
                onChange={(event) => handleTrashDaysChange(event.target.valueAsNumber)}
              />
              <span className="settings-dialog__trash-days-unit">
                {t('settings.trashRetentionUnit')}
              </span>
            </div>
          </div>
        )}

        <div className="settings-dialog__actions">
          <button
            type="button"
            className="settings-dialog__button"
            autoFocus
            onClick={() => onOpenChange(false)}
          >
            {t('cleanConfirm.ok')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

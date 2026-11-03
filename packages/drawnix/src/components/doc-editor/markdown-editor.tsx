import { useCallback, useEffect, useRef, useState } from 'react';
import { readTauriFile } from '../../data/tauri-file';
import { useI18n } from '../../i18n';
import { useDocAutoSave } from './use-doc-auto-save';

// Markdown 文档编辑器：纯文本编辑 Markdown 源码，
// 输入防抖后自动保存回对应文件
export const MarkdownEditor = ({ path }: { path: string }) => {
  const { t } = useI18n();
  const [text, setText] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const textRef = useRef('');

  const serialize = useCallback(() => textRef.current, []);

  const { scheduleSave, markLoaded } = useDocAutoSave(path, 'md', serialize);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    setText(null);
    readTauriFile(path, 'md')
      .then((content) => {
        if (cancelled) {
          return;
        }
        textRef.current = content;
        setText(content);
        markLoaded();
      })
      .catch((error) => {
        console.error('Failed to load markdown file:', error);
        if (!cancelled) {
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, markLoaded]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    textRef.current = value;
    setText(value);
    scheduleSave();
  };

  if (loadFailed) {
    return <div className="doc-editor__placeholder">{t('toast.tauriFile.loadFailed')}</div>;
  }

  return (
    <textarea
      className="doc-editor__markdown-input"
      value={text ?? ''}
      spellCheck={false}
      placeholder={t('markdown.placeholder')}
      disabled={text === null}
      onChange={handleChange}
    />
  );
};

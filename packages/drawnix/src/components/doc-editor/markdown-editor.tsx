import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { readTauriFile } from '../../data/tauri-file';
import { useI18n } from '../../i18n';
import type { Translations } from '../../i18n/types';
import { useDocAutoSave } from './use-doc-auto-save';
import {
  applyMarkdownAction,
  continueListOnEnter,
  indentSelection,
  MarkdownAction,
  toggleTaskItem,
} from './markdown-format';
import { renderMarkdownToHtml } from './markdown-render';
import { MarkdownToolbar } from './markdown-toolbar';
import './markdown-editor.scss';

/** 视图模式：源码 / 分屏 / 预览 */
type MarkdownViewMode = 'code' | 'split' | 'preview';

// 记住用户上一次选择的视图模式，下次打开时作为默认值
const VIEW_MODE_STORAGE_KEY = 'markdown_editor_view_mode';
const DEFAULT_VIEW_MODE: MarkdownViewMode = 'split';

const VIEW_MODES: { value: MarkdownViewMode; labelKey: keyof Translations }[] = [
  { value: 'code', labelKey: 'markdown.mode.code' },
  { value: 'split', labelKey: 'markdown.mode.split' },
  { value: 'preview', labelKey: 'markdown.mode.preview' },
];

const isViewMode = (value: string | null): value is MarkdownViewMode =>
  value === 'code' || value === 'split' || value === 'preview';

const loadViewMode = (): MarkdownViewMode => {
  try {
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (isViewMode(stored)) {
      return stored;
    }
  } catch {
    // localStorage 不可用（如隐私模式）时忽略，走默认模式
  }
  return DEFAULT_VIEW_MODE;
};

// Markdown 文档编辑器：支持源码/分屏/预览三种视图模式，
// 编辑区提供常用文字格式化工具栏，输入防抖后自动保存回对应文件
export const MarkdownEditor = ({ path }: { path: string }) => {
  const { t } = useI18n();
  const [text, setText] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [mode, setMode] = useState<MarkdownViewMode>(loadViewMode);
  const textRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // 工具栏操作后需要恢复的光标选区，待下一次文本渲染完成后再应用
  const pendingSelectionRef = useRef<[number, number] | null>(null);

  const serialize = useCallback(() => textRef.current, []);

  const { scheduleSave, markLoaded } = useDocAutoSave(path, serialize);

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

  const commitText = useCallback(
    (next: string) => {
      textRef.current = next;
      setText(next);
      scheduleSave();
    },
    [scheduleSave]
  );

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    commitText(event.target.value);
  };

  // 列表/引用行内回车自动延续前缀，空列表项回车退出列表
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab/Shift+Tab：插入/移除缩进（textarea 默认行为是移动焦点）
    if (event.key === 'Tab') {
      event.preventDefault();
      const { selectionStart, selectionEnd } = event.currentTarget;
      const result = indentSelection(
        textRef.current,
        selectionStart,
        selectionEnd,
        event.shiftKey ? 'outdent' : 'indent'
      );
      pendingSelectionRef.current = [result.selectionStart, result.selectionEnd];
      commitText(result.text);
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    const { selectionStart, selectionEnd } = event.currentTarget;
    if (selectionStart !== selectionEnd) {
      return;
    }
    const result = continueListOnEnter(textRef.current, selectionStart);
    if (!result) {
      return;
    }
    event.preventDefault();
    pendingSelectionRef.current = [result.selectionStart, result.selectionEnd];
    commitText(result.text);
  };

  const handleModeChange = (next: MarkdownViewMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, next);
    } catch {
      // 忽略持久化失败，仅影响下次打开时的默认模式
    }
  };

  // 工具栏动作：作用于 textarea 当前选区，无选区时插入语法模板
  const handleAction = useCallback(
    (action: MarkdownAction) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      const result = applyMarkdownAction(
        action,
        textRef.current,
        textarea.selectionStart,
        textarea.selectionEnd,
        {
          tableTemplate: t('markdown.tableTemplate'),
          linkPlaceholder: t('markdown.linkPlaceholder'),
          imagePlaceholder: t('markdown.imagePlaceholder'),
        }
      );
      pendingSelectionRef.current = [result.selectionStart, result.selectionEnd];
      commitText(result.text);
    },
    [commitText, t]
  );

  // 文本更新到 DOM 后恢复工具栏操作前的光标位置
  useEffect(() => {
    const selection = pendingSelectionRef.current;
    if (!selection) {
      return;
    }
    pendingSelectionRef.current = null;
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(selection[0], selection[1]);
    }
  }, [text]);

  const previewHtml = useMemo(() => (text === null ? '' : renderMarkdownToHtml(text)), [text]);

  // 预览区点击任务复选框：按序号切换源码中对应任务项的勾选状态
  const handlePreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) ||
      target.type !== 'checkbox' ||
      target.dataset.taskIndex === undefined
    ) {
      return;
    }
    const index = Number(target.dataset.taskIndex);
    if (Number.isNaN(index) || text === null) {
      return;
    }
    const next = toggleTaskItem(text, index);
    if (next === text) {
      // 源码中无对应任务项（如缩进代码块内的文本），回滚浏览器对复选框的原生翻转
      target.checked = !target.checked;
      return;
    }
    commitText(next);
  };

  if (loadFailed) {
    return <div className="doc-editor__placeholder">{t('toast.tauriFile.loadFailed')}</div>;
  }

  const showEditor = mode !== 'preview';
  const showPreview = mode !== 'code';

  return (
    <div className={`markdown-editor markdown-editor--${mode}`}>
      <div className="markdown-editor__topbar">
        {showEditor && <MarkdownToolbar onAction={handleAction} disabled={text === null} />}
        <div
          className="markdown-editor__modes"
          role="tablist"
          aria-label={t('markdown.mode.label')}
        >
          {VIEW_MODES.map((viewMode) => (
            <button
              key={viewMode.value}
              type="button"
              role="tab"
              aria-selected={mode === viewMode.value}
              className={classNames('markdown-editor__mode-button', {
                'markdown-editor__mode-button--active': mode === viewMode.value,
              })}
              onClick={() => handleModeChange(viewMode.value)}
            >
              {t(viewMode.labelKey)}
            </button>
          ))}
        </div>
      </div>
      <div className="markdown-editor__body">
        {showEditor && (
          <textarea
            ref={textareaRef}
            className="markdown-editor__input"
            value={text ?? ''}
            spellCheck={false}
            placeholder={t('markdown.placeholder')}
            disabled={text === null}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
        )}
        {showPreview && (
          <div
            className="markdown-editor__preview"
            onClick={handlePreviewClick}
            // 内容已经过 DOMPurify 消毒，仅包含受信任的 Markdown 渲染结果
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
      </div>
    </div>
  );
};

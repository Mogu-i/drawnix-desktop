import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { getTauriDocDraft, readTauriFile } from '../../data/tauri-file';
import { useI18n } from '../../i18n';
import { useDocAutoSave } from './use-doc-auto-save';
import { useDocHistory } from './use-doc-history';
import {
  applyMarkdownAction,
  continueListOnEnter,
  indentSelection,
  MarkdownAction,
  toggleTaskItem,
} from './markdown-format';
import { renderMarkdownToHtml } from './markdown-render';
import {
  loadViewMode,
  MarkdownViewMode,
  MarkdownToolbar,
  VIEW_MODES,
} from './markdown-toolbar';
import './markdown-editor.scss';

// Markdown 文档编辑器：支持源码/分屏/预览三种视图模式，
// 编辑区上方悬浮格式工具岛与右上角视图模式岛，
// 输入防抖后自动保存回对应文件
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

  const { scheduleSave, markLoaded } = useDocAutoSave(path, 'md', serialize);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    setText(null);
    // 未保存草稿优先：切换页签/异常重启后重新挂载时磁盘仍是旧内容，
    // 有草稿说明存在未保存修改，直接以草稿恢复（与保存入口写盘的内容同源），
    // 与白板切页签时的快照恢复机制对称
    const draft = getTauriDocDraft(path, 'md');
    (draft !== null ? Promise.resolve(draft) : readTauriFile(path, 'md'))
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

  const history = useDocHistory<string>();

  // 撤销/重做恢复用裸应用：直接写入状态，不走 commitText（否则恢复动作又进历史）
  const applyText = useCallback(
    (next: string) => {
      textRef.current = next;
      setText(next);
      scheduleSave();
    },
    [scheduleSave]
  );

  const handleUndo = useCallback(() => {
    history.undo(textRef.current, applyText);
  }, [history, applyText]);

  const handleRedo = useCallback(() => {
    history.redo(textRef.current, applyText);
  }, [history, applyText]);

  /** 撤销/重做快捷键：返回 true 表示已处理（已 preventDefault） */
  const tryUndoRedoKey = (event: React.KeyboardEvent): boolean => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) {
      return false;
    }
    const key = event.key.toLowerCase();
    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
      return true;
    }
    if (key === 'y' && !event.shiftKey) {
      event.preventDefault();
      handleRedo();
      return true;
    }
    return false;
  };

  const commitText = useCallback(
    (next: string, opts?: { coalesce?: boolean }) => {
      if (textRef.current !== next) {
        // 修改前保存旧快照：连续键入以 coalesce 合并为一个撤销单元
        history.pushHistory(textRef.current, opts);
      }
      textRef.current = next;
      setText(next);
      scheduleSave();
    },
    [scheduleSave, history]
  );

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    commitText(event.target.value, { coalesce: true });
  };

  // 列表/引用行内回车自动延续前缀，空列表项回车退出列表
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y：受控 textarea 的浏览器原生撤销与
    // React 状态不同步，统一拦截走自建历史栈
    if (tryUndoRedoKey(event)) {
      return;
    }
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
      window.localStorage.setItem('markdown_editor_view_mode', next);
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

  // 根容器兜底：焦点落在编辑器子树内非编辑区元素（如工具岛按钮）时
  // 也能用快捷键撤销/重做；编辑区内的按键已 preventDefault，
  // 此处靠 defaultPrevented 跳过，避免同一按键触发两次
  const handleRootKeyDown = (event: React.KeyboardEvent) => {
    if (!event.defaultPrevented) {
      tryUndoRedoKey(event);
    }
  };

  return (
    <div className={`markdown-editor markdown-editor--${mode}`} onKeyDown={handleRootKeyDown}>
      {/* 格式工具岛：悬浮在编辑区顶部居中，预览模式不渲染 */}
      {showEditor && (
        <div className="editor-island-wrap markdown-editor__island-wrap">
          <MarkdownToolbar
            onAction={handleAction}
            disabled={text === null}
            mode={mode}
            onViewModeChange={handleModeChange}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />
        </div>
      )}
      {/* 视图模式岛：独立悬浮在编辑区右上角 */}
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
            // 阻止按钮夺焦，textarea 中的光标选区不丢失
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => handleModeChange(viewMode.value)}
          >
            {t(viewMode.labelKey)}
          </button>
        ))}
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

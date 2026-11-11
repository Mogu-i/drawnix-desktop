import React, { useEffect, useMemo, useState } from 'react';
import {
  DATA_DIR_CHANGED_EVENT,
  TAURI_FILES_CHANGED_EVENT,
  isTauriFileSaveSuppressed,
  TableFileData,
  notifyTauriFilesChanged,
  parseTableFileContent,
  readTauriFile,
  useTauriFileState,
  writeTauriFile,
} from '../../data/tauri-file';
import { renderMarkdownToHtml } from '../../components/doc-editor/markdown-render';
import { toggleTaskItem } from '../../components/doc-editor/markdown-format';
import {
  buildTableCellStyle,
  getTableColWidths,
  getTableRowHeights,
} from '../../components/doc-editor/table-style';
import { i18nInsidePlaitHook } from '../../i18n';
import type { Translations } from '../../i18n/types';
import { CardElement } from './type';

const lastSeg = (rel: string) => rel.slice(rel.lastIndexOf('/') + 1);

const FILE_TYPE_LABEL_KEYS: Record<'md' | 'table', keyof Translations> = {
  md: 'filePanel.fileType.md',
  table: 'filePanel.fileType.table',
};

/**
 * 文件引用卡片内容：白板元素内仅保存文件路径与类型的引用，
 * Markdown/表格内容始终从源文件实时读取；文件被编辑、移动或删除后
 * 通过文件变更事件与当前文件状态的变化触发重新加载
 */
export const FileRefCardContent: React.FC<{ element: CardElement }> = ({ element }) => {
  const { t } = i18nInsidePlaitHook();
  const { currentFile } = useTauriFileState();
  const filePath = element.filePath as string;
  const fileType = element.fileType ?? 'md';
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [table, setTable] = useState<TableFileData | null>(null);
  const [missing, setMissing] = useState(false);
  // 文件被外部修改（编辑器保存、删除、恢复等）后触发重新读取
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setMissing(false);
    setMarkdown(null);
    setTable(null);
    readTauriFile(filePath, fileType)
      .then((content) => {
        if (cancelled) {
          return;
        }
        if (fileType === 'table') {
          setTable(parseTableFileContent(content));
        } else {
          setMarkdown(content);
        }
      })
      .catch((error) => {
        console.error('Failed to load file ref card content:', error);
        if (!cancelled) {
          setMissing(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filePath, fileType, currentFile, refreshKey]);

  useEffect(() => {
    const refresh = () => setRefreshKey((key) => key + 1);
    window.addEventListener(TAURI_FILES_CHANGED_EVENT, refresh);
    window.addEventListener(DATA_DIR_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(TAURI_FILES_CHANGED_EVENT, refresh);
      window.removeEventListener(DATA_DIR_CHANGED_EVENT, refresh);
    };
  }, []);

  const markdownHtml = useMemo(
    () => (markdown === null ? '' : renderMarkdownToHtml(markdown)),
    [markdown]
  );

  // 内容区阻止 pointerdown 冒泡：滚动条/复选框等交互不能触发白板拖动；
  // 双击未阻止，仍可冒泡到白板打开文档编辑器
  const stopPointerDown = (event: React.PointerEvent) => {
    event.stopPropagation();
  };

  // 点击任务复选框：按序号切换源码中对应任务项并写回源文件（与文档编辑器预览一致）
  const handleMarkdownClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (target instanceof HTMLAnchorElement) {
      // 卡片内不跟随链接跳转
      event.preventDefault();
      return;
    }
    if (
      !(target instanceof HTMLInputElement) ||
      target.type !== 'checkbox' ||
      target.dataset.taskIndex === undefined
    ) {
      return;
    }
    const index = Number(target.dataset.taskIndex);
    if (Number.isNaN(index) || markdown === null) {
      return;
    }
    // 文件已被删除/移动/重命名（旧路径保存被屏蔽）时不再回写，
    // 避免把旧文件在旧位置重新创建出来；回滚勾选状态，等待卡片按新路径重载
    if (isTauriFileSaveSuppressed(filePath, fileType)) {
      target.checked = !target.checked;
      return;
    }
    const next = toggleTaskItem(markdown, index);
    if (next === markdown) {
      // 源码中无对应任务项，回滚浏览器对复选框的原生翻转
      target.checked = !target.checked;
      return;
    }
    setMarkdown(next);
    writeTauriFile(filePath, next, 'md')
      .then(() => notifyTauriFilesChanged())
      .catch((error) => {
        console.error('Failed to save markdown file:', error);
        // 写盘失败时回滚复选框的乐观更新
        target.checked = !target.checked;
        setMarkdown(markdown);
      });
  };

  const renderBody = () => {
    if (missing) {
      return (
        <div className="drawnix-file-ref-card__placeholder">
          <div className="drawnix-file-ref-card__missing">{t('card.fileRef.missing')}</div>
          <div className="drawnix-file-ref-card__path" title={filePath}>
            {filePath}
          </div>
        </div>
      );
    }
    if (fileType === 'table') {
      if (!table) {
        return <div className="drawnix-file-ref-card__placeholder">{t('card.fileRef.loading')}</div>;
      }
      // 列宽按源文件设定值以 px 渲染，表格宽度与编辑器中实际设定宽度一致，
      // 不随卡片宽度缩放；超出卡片宽度的部分由内容区滚动查看
      const colWidths = getTableColWidths(table.colWidths, table.cols);
      const rowHeights = getTableRowHeights(table.rowHeights, table.rows);
      const totalWidth = colWidths.reduce((sum, width) => sum + width, 0) || 1;
      return (
        <div
          className="drawnix-file-ref-card__body"
          onPointerDown={stopPointerDown}
        >
          <table
            className="drawnix-file-ref-card__table"
            style={{ width: `${totalWidth}px` }}
            cellPadding={0}
          >
            <colgroup>
              {colWidths.map((width, c) => (
                <col key={c} style={{ width: `${width}px` }} />
              ))}
            </colgroup>
            <tbody>
              {table.cells.map((row, r) => (
                <tr key={r} style={{ height: `${rowHeights[r]}px` }}>
                  {row.map((cell, c) => {
                    if (cell.hidden) {
                      return null;
                    }
                    return (
                      <td
                        key={c}
                        rowSpan={cell.rowSpan ?? 1}
                        colSpan={cell.colSpan ?? 1}
                        style={buildTableCellStyle(cell)}
                      >
                        {cell.text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (markdown === null) {
      return <div className="drawnix-file-ref-card__placeholder">{t('card.fileRef.loading')}</div>;
    }
    return (
      <div
        className="drawnix-file-ref-card__body drawnix-file-ref-card__markdown"
        onPointerDown={stopPointerDown}
        onClick={handleMarkdownClick}
        dangerouslySetInnerHTML={{ __html: markdownHtml }}
      />
    );
  };

  return (
    <div className="drawnix-file-ref-card">
      <div className="drawnix-file-ref-card__header">
        <span className="drawnix-file-ref-card__badge">{t(FILE_TYPE_LABEL_KEYS[fileType])}</span>
        <span className="drawnix-file-ref-card__name" title={filePath}>
          {lastSeg(filePath)}
        </span>
        <span className="drawnix-file-ref-card__hint">{t('card.fileRef.openHint')}</span>
      </div>
      {renderBody()}
    </div>
  );
};

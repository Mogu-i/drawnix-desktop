import { closeTauriDocEditor } from '../../data/tauri-file';
import { useI18n } from '../../i18n';
import { MarkdownEditor } from './markdown-editor';
import { TableEditor } from './table-editor';
import './doc-editor.scss';

const lastSeg = (rel: string) => rel.slice(rel.lastIndexOf('/') + 1);

// 文档编辑器覆盖层：Markdown/表格文件在主内容区的编辑入口，
// 覆盖在白板之上，关闭后回到白板/欢迎页
export const DocEditor = ({
  path,
  fileType,
}: {
  path: string;
  fileType: 'md' | 'table';
}) => {
  const { t } = useI18n();

  const handleClose = () => {
    // 子组件卸载时会立即保存未落盘的修改；
    // 若是从白板（双击引用卡片）进入，则恢复之前的白板文件上下文
    closeTauriDocEditor();
  };

  return (
    <div className="doc-editor">
      <div className="doc-editor__header">
        <span className="doc-editor__badge">
          {t(`filePanel.fileType.${fileType}`)}
        </span>
        <span className="doc-editor__filename" title={path}>
          {lastSeg(path)}
        </span>
        <button
          type="button"
          className="doc-editor__close"
          title={t('docEditor.close')}
          onClick={handleClose}
        >
          ✕
        </button>
      </div>
      {fileType === 'md' ? (
        <MarkdownEditor path={path} />
      ) : (
        <TableEditor path={path} />
      )}
    </div>
  );
};

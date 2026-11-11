import { MarkdownEditor } from './markdown-editor';
import { TableEditor } from './table-editor';
import './doc-editor.scss';

// 文档编辑器覆盖层：Markdown/表格文件在主内容区的编辑入口，
// .doc-editor 负责铺满主内容区并盖在白板之上，关闭后回到白板/欢迎页。
// 文件名、类型与未保存状态由上方页签栏展示，关闭文档通过活动页签的关闭按钮完成，
// 子组件卸载时会立即保存未落盘的修改
export const DocEditor = ({
  path,
  fileType,
}: {
  path: string;
  fileType: 'md' | 'table';
}) => {
  return (
    <div className="doc-editor">
      {fileType === 'md' ? <MarkdownEditor path={path} /> : <TableEditor path={path} />}
    </div>
  );
};

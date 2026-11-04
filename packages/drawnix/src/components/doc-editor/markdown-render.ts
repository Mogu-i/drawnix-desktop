import { marked } from 'marked';
import DOMPurify from 'dompurify';

// GFM 支持表格/任务列表/删除线；breaks 让单换行也渲染为换行，
// 与常见编辑器（如 Typora）的书写习惯保持一致
marked.setOptions({
  gfm: true,
  breaks: true,
});

const CHECKBOX_TAG_PATTERN = /<input\b[^>]*type="checkbox"[^>]*>/g;

/**
 * 去掉任务复选框的 disabled 并按出现顺序标记 data-task-index。
 * 必须在 HTML 字符串层面处理：若在 DOM 渲染后用 effect 改动，
 * 重渲染会先短暂回退到 disabled 状态，导致连续点击时部分复选框无响应
 */
const enableTaskCheckboxes = (html: string): string => {
  let index = 0;
  return html.replace(CHECKBOX_TAG_PATTERN, (tag) => {
    const taskIndex = index;
    index += 1;
    return tag
      .replace(/\sdisabled(?:="[^"]*")?/gi, '')
      .replace(/\s?\/??>$/, ` data-task-index="${taskIndex}">`);
  });
};

/**
 * 将 Markdown 源码渲染为可直接注入 DOM 的 HTML；
 * 输出经 DOMPurify 消毒，防止文件内容中的脚本注入
 */
export const renderMarkdownToHtml = (markdown: string): string => {
  const rawHtml = marked.parse(markdown, { async: false }) as string;
  return enableTaskCheckboxes(DOMPurify.sanitize(rawHtml));
};

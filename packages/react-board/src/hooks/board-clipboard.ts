import { getViewportOrigination, PlaitBoard, Point } from '@plait/core';

/**
 * 白板剪贴板辅助工具，与 use-plugin-event / with-image 插件配合：
 * （1）文档编辑器打开时 window 级 copy/paste/cut/keydown 的守卫判定；
 * （2）paste 落点的视口中心回退；
 * （3）clipboardData.items 图片收集与网页 <img> 尽力而为转换；
 * （4）text/html（不含 <plait>）的块级文本提取。
 * react-board 不能反向依赖 @drawnix/drawnix（会循环引用），因此这里
 * 不做 MIME 白名单校验（由 with-image 插件统一判断并提示），也不直接
 * import i18n，文案经 drawnix 注入的 board.t 解析。
 */

// ---------------------------------------------------------------------------
// 守卫：.table / .markdown 文档编辑器打开时，白板的 window 监听必须让路
// ---------------------------------------------------------------------------

/** .doc-editor（表格/Markdown 编辑器覆盖层）当前是否打开 */
export const isDocEditorOpen = (): boolean => !!document.querySelector('.doc-editor');

/** 事件目标是否落在文档编辑器 DOM 内 */
export const hasDocEditorTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && !!target.closest('.doc-editor');

// ---------------------------------------------------------------------------
// paste 落点：视口中心回退
// ---------------------------------------------------------------------------

/**
 * 当前视口中心的 viewBox 坐标。鼠标从未进入白板（纯键盘操作、刚切页签）时
 * BOARD_TO_MOVING_POINT_IN_BOARD 为空，粘贴落点回退到这里；
 * 与 plugins/card/transforms.ts 的 getCenterPoint 同思路：
 * origination + 容器宽高的一半按 zoom 折算，zoom≠1 时同样正确。
 */
export const getViewportCenterPoint = (board: PlaitBoard): Point => {
  const containerRect = PlaitBoard.getBoardContainer(board).getBoundingClientRect();
  const origination = getViewportOrigination(board);
  const zoom = board.viewport.zoom;
  return [
    (origination?.[0] ?? 0) + containerRect.width / 2 / zoom,
    (origination?.[1] ?? 0) + containerRect.height / 2 / zoom,
  ];
};

// ---------------------------------------------------------------------------
// 图片来源收集：files 与 items 双来源合并去重
// ---------------------------------------------------------------------------

const buildFileKey = (file: File): string => `${file.name}:${file.size}:${file.lastModified}`;

/**
 * 从 clipboardData 收集全部 image/* 文件：files 与 items 双来源合并去重。
 * 网页/聊天工具「复制图片」经常只给 items 不给 files，因此必须扫 items；
 * MIME 白名单校验不在这一步做（由 with-image 插件统一判断并提示）。
 */
export const collectImageFilesFromClipboard = (dataTransfer: DataTransfer | null): File[] => {
  if (!dataTransfer) {
    return [];
  }
  const collected = new Map<string, File>();
  Array.from(dataTransfer.files ?? []).forEach((file) => {
    if (file.type.startsWith('image/')) {
      collected.set(buildFileKey(file), file);
    }
  });
  Array.from(dataTransfer.items ?? []).forEach((item) => {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        collected.set(buildFileKey(file), file);
      }
    }
  });
  return Array.from(collected.values());
};

/** 从 HTML 里找第一个 <img src>，仅接受 data: 图片与 http(s) 外链 */
export const findImageSrcInHtml = (html: string): string | null => {
  if (!html) {
    return null;
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const src = doc.querySelector('img[src]')?.getAttribute('src') ?? '';
  return /^data:image\//i.test(src) || /^https?:\/\//i.test(src) ? src : null;
};

/**
 * 尽力而为把 <img src> 转成 File（data: URL 与可 CORS 访问的 http(s) 地址）；
 * 网络失败/CORS 拦截/非图片响应时返回 null，上层降级为插入文字并提示。
 */
export const fetchImageFileFromSrc = async (src: string): Promise<File | null> => {
  try {
    const response = await fetch(src);
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) {
      return null;
    }
    const extension = (blob.type.split('/')[1] ?? 'png').replace(/[^a-z0-9]/gi, '') || 'png';
    return new File([blob], `clipboard-image.${extension}`, { type: blob.type });
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// text/html（不含 <plait>）→ 保留块级换行的纯文本
// ---------------------------------------------------------------------------

/** 块级元素：内容后补换行（用 Set 判定，避免子串误命中） */
const BLOCK_LINE_TAGS = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'tr',
  'blockquote',
  'pre',
  'section',
  'article',
  'header',
  'footer',
  'ul',
  'ol',
  'table',
  'dl',
  'dt',
  'dd',
  'figcaption',
  'aside',
  'details',
  'main',
]);

const INLINE_SEPARATOR_TAGS = new Set(['td', 'th']);

const extractTextFromNode = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }
  const element = node as Element;
  if (element.tagName.toLowerCase() === 'br') {
    return '\n';
  }
  const children = Array.from(element.childNodes).map(extractTextFromNode).join('');
  const tag = element.tagName.toLowerCase();
  if (INLINE_SEPARATOR_TAGS.has(tag)) {
    // 表格单元格之间用空格分隔，避免多列内容粘连
    return `${children} `;
  }
  return BLOCK_LINE_TAGS.has(tag) ? `${children}\n` : children;
};

/**
 * text/html（不含 <plait> 片段）→ 可见文本，保留块级换行：
 * 替代 @plait/core stripHtml「整段压成一行」的行为，网页段落/表格行/代码行不再粘连。
 */
export const extractBlockTextFromHtml = (html: string): string => {
  if (!html) {
    return '';
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,template,head').forEach((el) => el.remove());
  const text = Array.from(doc.body.childNodes).map(extractTextFromNode).join('');
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
};

// ---------------------------------------------------------------------------
// board 侧 toast（跨包结构类型，避免 react-board 反向依赖 drawnix）
// ---------------------------------------------------------------------------

type BoardWithToastI18n = {
  showToast?: (toast: { message: string; type?: 'info' | 'success' | 'error' }) => void;
  t?: (key: string) => string;
};

/** 插件链路里给用户提示：文案经 drawnix 注入的 board.t 解析，通道是 board.showToast */
export const showToastOnBoard = (board: PlaitBoard, i18nKey: string): void => {
  const drawnixBoard = board as PlaitBoard & BoardWithToastI18n;
  drawnixBoard.showToast?.({ message: drawnixBoard.t?.(i18nKey) ?? i18nKey, type: 'info' });
};

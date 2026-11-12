import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaitBoard } from '@plait/core';
import {
  collectImageFilesFromClipboard,
  extractBlockTextFromHtml,
  fetchImageFileFromSrc,
  findImageSrcInHtml,
  getViewportCenterPoint,
  hasDocEditorTarget,
  isDocEditorOpen,
  showToastOnBoard,
} from './board-clipboard';

vi.mock('@plait/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@plait/core')>();
  return { ...actual, getViewportOrigination: vi.fn(() => [100, 200]) };
});

const mockClipboard = (
  files: File[],
  items: Array<{ kind: string; type: string; file?: File }>
): DataTransfer =>
  ({
    files,
    items: items.map((item) => ({
      kind: item.kind,
      type: item.type,
      getAsFile: () => item.file ?? null,
    })),
  }) as unknown as DataTransfer;

describe('collectImageFilesFromClipboard', () => {
  it('合并 files 与 items 的图片并按 name+size+lastModified 去重', () => {
    const png = new File(['x'], 'shot.png', { type: 'image/png' });
    const dt = mockClipboard([png], [{ kind: 'file', type: 'image/png', file: png }]);
    expect(collectImageFilesFromClipboard(dt)).toEqual([png]);
  });

  it('items 独有的图片（网页复制图片常只有 items）也能收集', () => {
    const webp = new File(['y'], 'pic.webp', { type: 'image/webp' });
    const dt = mockClipboard([], [{ kind: 'file', type: 'image/webp', file: webp }]);
    expect(collectImageFilesFromClipboard(dt)).toEqual([webp]);
  });

  it('忽略非图片文件与字符串项', () => {
    const pdf = new File(['z'], 'doc.pdf', { type: 'application/pdf' });
    const dt = mockClipboard(
      [pdf],
      [
        { kind: 'file', type: 'application/pdf', file: pdf },
        { kind: 'string', type: 'text/plain' },
      ]
    );
    expect(collectImageFilesFromClipboard(dt)).toEqual([]);
  });

  it('null 安全', () => {
    expect(collectImageFilesFromClipboard(null)).toEqual([]);
  });
});

describe('extractBlockTextFromHtml', () => {
  it('块级元素换行保留（替代 stripHtml 的压平行为）', () => {
    expect(extractBlockTextFromHtml('<p>段落一</p><p>段落二</p>')).toBe('段落一\n段落二');
  });

  it('br 转换行', () => {
    expect(extractBlockTextFromHtml('<div>a<br>b</div>')).toBe('a\nb');
  });

  it('VSCode 风格逐行 div/span 保留行结构', () => {
    expect(
      extractBlockTextFromHtml(
        '<div><span>const a = 1;</span></div><div><span>const b = 2;</span></div>'
      )
    ).toBe('const a = 1;\nconst b = 2;');
  });

  it('表格单元格用空格分隔、行尾补换行', () => {
    expect(
      extractBlockTextFromHtml('<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>')
    ).toBe('a b\nc d');
  });

  it('移除 script/style/noscript/template，折叠连续空行', () => {
    expect(extractBlockTextFromHtml('<script>evil()</script><style>.x{}</style><div>ok</div>')).toBe(
      'ok'
    );
    expect(extractBlockTextFromHtml('<div><p>one</p><p>two</p></div>')).toBe('one\ntwo');
  });

  it('空串返回空', () => {
    expect(extractBlockTextFromHtml('')).toBe('');
  });
});

describe('findImageSrcInHtml', () => {
  it('data: 图片与 http(s) 外链命中', () => {
    expect(findImageSrcInHtml('<img src="data:image/png;base64,AAA">')).toBe(
      'data:image/png;base64,AAA'
    );
    expect(findImageSrcInHtml('<div><img src="https://a.com/b.png"></div>')).toBe(
      'https://a.com/b.png'
    );
  });

  it('相对路径与无图返回 null', () => {
    expect(findImageSrcInHtml('<img src="/a.png">')).toBeNull();
    expect(findImageSrcInHtml('<p>text</p>')).toBeNull();
    expect(findImageSrcInHtml('')).toBeNull();
  });
});

describe('fetchImageFileFromSrc（尽力而为）', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('图片响应转 File，扩展名取自 MIME', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => blob })));
    const file = await fetchImageFileFromSrc('https://a.com/b.png');
    expect(file?.type).toBe('image/png');
    expect(file?.name).toBe('clipboard-image.png');
  });

  it('HTTP 错误/网络异常/非图片响应返回 null（上层降级为文字）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, blob: async () => new Blob() })));
    await expect(fetchImageFileFromSrc('https://a.com/b.png')).resolves.toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('CORS');
      })
    );
    await expect(fetchImageFileFromSrc('https://a.com/b.png')).resolves.toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, blob: async () => new Blob(['<html/>'], { type: 'text/html' }) }))
    );
    await expect(fetchImageFileFromSrc('https://a.com/b')).resolves.toBeNull();
  });
});

describe('getViewportCenterPoint（视口中心回退）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('origination + 容器一半按 zoom 折算（zoom≠1 时同样正确）', () => {
    vi.spyOn(PlaitBoard, 'getBoardContainer').mockReturnValue({
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
    } as unknown as HTMLElement);
    const board = { viewport: { zoom: 2 } } as unknown as PlaitBoard;
    // x = 100 + 800/2/2 = 300；y = 200 + 600/2/2 = 350
    expect(getViewportCenterPoint(board)).toEqual([300, 350]);
  });
});

describe('文档编辑器守卫', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('isDocEditorOpen 检测 .doc-editor 覆盖层', () => {
    expect(isDocEditorOpen()).toBe(false);
    document.body.innerHTML = '<div class="doc-editor"><div class="table-editor"></div></div>';
    expect(isDocEditorOpen()).toBe(true);
  });

  it('hasDocEditorTarget 识别编辑器内元素', () => {
    document.body.innerHTML = '<div class="doc-editor"><textarea class="cell-editor"></textarea></div>';
    expect(hasDocEditorTarget(document.querySelector('textarea'))).toBe(true);
    expect(hasDocEditorTarget(document.body)).toBe(false);
    expect(hasDocEditorTarget(null)).toBe(false);
  });
});

describe('showToastOnBoard', () => {
  it('经 board.t 解析文案并调用 board.showToast', () => {
    const showToast = vi.fn();
    const board = {
      showToast,
      t: vi.fn((key: string) => `#${key}`),
    } as unknown as PlaitBoard;
    showToastOnBoard(board, 'toast.imageFetchFallback');
    expect(showToast).toHaveBeenCalledWith({ message: '#toast.imageFetchFallback', type: 'info' });
  });

  it('缺 t/showToast 时不抛错', () => {
    expect(() => showToastOnBoard({} as PlaitBoard, 'k')).not.toThrow();
  });
});

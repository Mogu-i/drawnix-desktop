import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 居中布局断言：__table-wrap 必须用 max-content + margin-inline:auto 方案居中，
// 不能用 flex + justify-content:center（表格比容器宽时会裁掉左侧、滚不到第一列）；
// IME 代理必须视觉隐藏但可聚焦（display:none 无法启动输入法组合）。
// jsdom 环境下 import.meta.url 是 http scheme，用 vitest 注入的 import.meta.dirname 定位文件
const scss = readFileSync(`${import.meta.dirname}/table-editor.scss`, 'utf-8');

describe('table-editor.scss 表格整体水平居中', () => {
  it('__table-wrap 用 max-content + margin-inline:auto 居中并保留定位基准', () => {
    const wrapStart = scss.indexOf('&__table-wrap');
    const wrapEnd = scss.indexOf('&__table {');
    expect(wrapStart).toBeGreaterThan(-1);
    const wrapBlock = scss.slice(wrapStart, wrapEnd);
    expect(wrapBlock).toContain('position: relative');
    expect(wrapBlock).toContain('width: max-content');
    expect(wrapBlock).toContain('margin-inline: auto');
  });

  it('不使用 flex + justify-content 居中（溢出时会裁掉左侧）', () => {
    expect(scss).not.toContain('justify-content: center');
  });

  it('IME 代理为视觉隐藏但可聚焦的 sr-only 形态（非 display:none）', () => {
    const proxyStart = scss.indexOf('&__ime-proxy');
    expect(proxyStart).toBeGreaterThan(-1);
    const proxyBlock = scss.slice(proxyStart, scss.indexOf('&__table {', proxyStart));
    expect(proxyBlock).toContain('position: absolute');
    expect(proxyBlock).toContain('opacity: 0');
    expect(proxyBlock).toContain('pointer-events: none');
    expect(proxyBlock).not.toMatch(/display:\s*none/);
  });
});

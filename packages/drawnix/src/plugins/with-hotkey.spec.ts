import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOARD_TO_MOVING_POINT_IN_BOARD, PlaitPointerType } from '@plait/core';
import type { PlaitPlugin } from '@plait/core';

// 保存相关模块全部替换为 spy：既隔离 DOM/文件系统副作用，也能验证
// 「with-hotkey 不再直连保存」与「文档编辑器打开时副作用快捷键被守卫」
const mocks = vi.hoisted(() => ({
  isTauri: false,
  saveToTauriFile: vi.fn(() => Promise.resolve('spec/board')),
  saveJSON: vi.fn(() => Promise.resolve({ fileHandle: null })),
  saveAsJSON: vi.fn(() => Promise.resolve({ fileHandle: null })),
  saveAsSvg: vi.fn(),
  addImage: vi.fn(),
  canCopySelectionAs: vi.fn(() => false),
  copySelectionAsSvg: vi.fn(() => Promise.resolve()),
}));

vi.mock('../data/tauri-file', () => ({
  isTauriEnvironment: () => mocks.isTauri,
  saveToTauriFile: mocks.saveToTauriFile,
  getTauriCurrentFile: () => 'spec/board',
}));

vi.mock('../data/json', () => ({
  saveJSON: mocks.saveJSON,
  saveAsJSON: mocks.saveAsJSON,
}));

vi.mock('../utils/image', () => ({
  saveAsSvg: mocks.saveAsSvg,
  addImage: mocks.addImage,
  canCopySelectionAs: mocks.canCopySelectionAs,
  copySelectionAsSvg: mocks.copySelectionAsSvg,
}));

import { buildDrawnixHotkeyPlugin } from './with-hotkey';
import { setupDrawnixTestingBoard } from '../../testing';
import type { DrawnixTestingBoardFixture } from '../../testing';

// 记录守卫后是否回灌原始 globalKeyDown 链：本插件先于热键插件应用，
// 热键插件解构到的 globalKeyDown 就是这里的包装，守卫分支回灌才会出现在列表里
const observedGlobalKeyEvents: KeyboardEvent[] = [];
const observeGlobalKeyDown: PlaitPlugin = (board) => {
  const { globalKeyDown } = board;
  board.globalKeyDown = (event) => {
    observedGlobalKeyEvents.push(event);
    globalKeyDown(event);
  };
  return board;
};

let docOverlayRef: HTMLDivElement | null = null;

/** 模拟文档编辑器覆盖层打开：isDocEditorOpen 靠 .doc-editor 节点判定 */
const openDocEditorOverlay = () => {
  docOverlayRef = document.createElement('div');
  docOverlayRef.className = 'doc-editor';
  document.body.appendChild(docOverlayRef);
};

describe('drawnix hotkey plugin save & doc-editor guard', () => {
  let fixture: DrawnixTestingBoardFixture | undefined;
  let updateAppState: ReturnType<typeof vi.fn>;

  const createFixture = () => {
    updateAppState = vi.fn();
    fixture = setupDrawnixTestingBoard(
      [observeGlobalKeyDown, buildDrawnixHotkeyPlugin(updateAppState)],
      []
    );
    // 模拟「鼠标已进入过白板」：画布内 pointermove 会让该值恒存在（事故触发链之一）
    BOARD_TO_MOVING_POINT_IN_BOARD.set(fixture.board, [10, 10]);
    return fixture.board;
  };

  const press = (init: KeyboardEventInit) =>
    fixture!.board.globalKeyDown(new KeyboardEvent('keydown', init));

  /** jsdom 合成键盘事件：keyCode/which 需手动补（is-hotkey 非 byKey 分支按 which 匹配），
   *  cancelable 必须开启（preventDefault 才生效） */
  const pressKey = (key: string, keyCode: number, modifiers: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...modifiers,
    });
    Object.defineProperty(event, 'keyCode', { value: keyCode, configurable: true });
    Object.defineProperty(event, 'which', { value: keyCode, configurable: true });
    fixture!.board.globalKeyDown(event);
    return event;
  };

  beforeEach(() => {
    mocks.isTauri = false;
    vi.clearAllMocks();
    observedGlobalKeyEvents.length = 0;
  });

  afterEach(() => {
    docOverlayRef?.remove();
    docOverlayRef = null;
    if (fixture) {
      BOARD_TO_MOVING_POINT_IN_BOARD.delete(fixture.board);
      fixture.destroy();
      fixture = undefined;
    }
  });

  it('does not save via saveToTauriFile on mod+s in Tauri (tab bar owns saving)', () => {
    mocks.isTauri = true;
    const board = createFixture();

    const event = pressKey('s', 83, { ctrlKey: true });

    // 保存统一走页签栏 saveCurrentFile（按类型分派），这里不再直连写盘：
    // 一次按键两套保存曾把表格路径写成白板文件
    expect(mocks.saveToTauriFile).not.toHaveBeenCalled();
    expect(mocks.saveJSON).not.toHaveBeenCalled();
    // 仅吞掉浏览器默认行为（如保存网页对话框）
    expect(event.defaultPrevented).toBe(true);
    // 事件未回灌原始链（保存分支提前返回）
    expect(observedGlobalKeyEvents).toHaveLength(0);
    expect(board).toBeDefined();
  });

  it('still saves via saveJSON on mod+s in the web build', () => {
    const board = createFixture();

    press({ key: 's', ctrlKey: true });

    // web 端无页签栏，保留原有保存路径
    expect(mocks.saveJSON).toHaveBeenCalledTimes(1);
    expect(mocks.saveToTauriFile).not.toHaveBeenCalled();
    expect(board).toBeDefined();
  });

  it('runs no board-side save shortcut while the doc editor is open', () => {
    mocks.isTauri = true;
    createFixture();
    openDocEditorOverlay();

    press({ key: 's', ctrlKey: true });

    // Ctrl+S 只由页签栏的 saveCurrentFile 处理（按活动文件类型分派），
    // 白板不再执行任何写盘副作用
    expect(mocks.saveToTauriFile).not.toHaveBeenCalled();
    expect(mocks.saveJSON).not.toHaveBeenCalled();
    expect(mocks.saveAsJSON).not.toHaveBeenCalled();
  });

  it('keeps tool state untouched for single-key shortcuts while the doc editor is open', () => {
    const board = createFixture();
    openDocEditorOverlay();

    press({ key: 'h' });
    press({ key: 'v' });

    // 单键工具切换属于文档编辑域（表格单元格里按 h/v 不能切白板指针），
    // 白板工具状态与 appState 均不变
    expect(updateAppState).not.toHaveBeenCalled();
    expect(board.pointer).toBe(PlaitPointerType.selection);
    // 原始链路仍无条件回灌，不干扰白板内部状态机
    expect(observedGlobalKeyEvents).toHaveLength(2);
  });

  it('does not open the image picker on mod+u while the doc editor is open', () => {
    createFixture();
    openDocEditorOverlay();

    press({ key: 'u', ctrlKey: true });

    expect(mocks.addImage).not.toHaveBeenCalled();
  });

  it('still switches the tool on single-key shortcuts when no doc editor is open', () => {
    createFixture();

    press({ key: 'h' });

    // 守卫只在文档编辑器打开时生效：正常白板场景快捷键行为不变
    expect(updateAppState).toHaveBeenCalledWith(
      expect.objectContaining({
        toolState: expect.objectContaining({ pointer: PlaitPointerType.hand }),
      })
    );
    expect(mocks.addImage).not.toHaveBeenCalled();
  });

  it('still opens the image picker on mod+u when no doc editor is open', () => {
    mocks.isTauri = true;
    createFixture();

    pressKey('u', 85, { ctrlKey: true });

    expect(mocks.addImage).toHaveBeenCalledTimes(1);
  });
});

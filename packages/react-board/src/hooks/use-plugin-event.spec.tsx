import { IS_TEXT_EDITABLE, PlaitBoard, setupTestingBoard } from '@plait/core';
import type { PlaitBoard as PlaitBoardType, TestingBoardFixture } from '@plait/core';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { RefObject } from 'react';
import useBoardPluginEvent from './use-plugin-event';

const createSpaceKeyUp = () =>
  new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true, cancelable: true });

const createSpaceKeyDown = () =>
  new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true });

describe('useBoardPluginEvent keyup forwarding', () => {
  let fixture: TestingBoardFixture;
  let board: PlaitBoardType;
  let keyUpSpy: Mock<(event: KeyboardEvent) => void>;

  const mountHook = (targetBoard: PlaitBoardType) => {
    const viewportContainerRef = {
      current: document.createElement('div'),
    } as unknown as RefObject<HTMLDivElement>;
    const hostRef = {
      current: document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    } as unknown as RefObject<SVGSVGElement>;
    return renderHook(() => useBoardPluginEvent(targetBoard, viewportContainerRef, hostRef));
  };

  beforeEach(() => {
    fixture = setupTestingBoard([], []);
    board = fixture.board;
    keyUpSpy = vi.fn((_event: KeyboardEvent) => undefined);
    board.keyUp = keyUpSpy;
  });

  afterEach(() => {
    fixture.destroy();
    IS_TEXT_EDITABLE.delete(board);
  });

  it('forwards Space keyup to board.keyUp even when the board lost focus (selection is null)', () => {
    // Reproduce the stuck scenario: after a long space-drag the selection can be
    // cleared, so PlaitBoard.isFocus(board) is false when Space is released.
    board.selection = null;
    expect(PlaitBoard.isFocus(board)).toBe(false);

    mountHook(board);
    window.dispatchEvent(createSpaceKeyUp());

    // Without forwarding, withHandPointer never clears its temporary hand pointer
    // and every later left pointerUp is swallowed -> canvas tools stop responding.
    expect(keyUpSpy).toHaveBeenCalledTimes(1);
  });

  it('still skips board.keyUp while in-board slate text editing to avoid stealing space input', () => {
    IS_TEXT_EDITABLE.set(board, true);
    expect(PlaitBoard.hasBeenTextEditing(board)).toBe(true);

    mountHook(board);
    window.dispatchEvent(createSpaceKeyUp());

    expect(keyUpSpy).not.toHaveBeenCalled();
  });
});

describe('useBoardPluginEvent Space keydown forwarding', () => {
  let fixture: TestingBoardFixture;
  let board: PlaitBoardType;
  let keyDownSpy: Mock<(event: KeyboardEvent) => void>;
  let keyUpSpy: Mock<(event: KeyboardEvent) => void>;

  const mountHook = (targetBoard: PlaitBoardType) => {
    const viewportContainerRef = {
      current: document.createElement('div'),
    } as unknown as RefObject<HTMLDivElement>;
    const hostRef = {
      current: document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    } as unknown as RefObject<SVGSVGElement>;
    return renderHook(() => useBoardPluginEvent(targetBoard, viewportContainerRef, hostRef));
  };

  beforeEach(() => {
    fixture = setupTestingBoard([], []);
    board = fixture.board;
    keyDownSpy = vi.fn((_event: KeyboardEvent) => undefined);
    board.keyDown = keyDownSpy;
    keyUpSpy = vi.fn((_event: KeyboardEvent) => undefined);
    board.keyUp = keyUpSpy;
  });

  afterEach(() => {
    fixture.destroy();
    IS_TEXT_EDITABLE.delete(board);
  });

  it('forwards Space keydown to board.keyDown and prevents default even when selection is null', () => {
    // Without a selection PlaitBoard.isFocus(board) is false; the Space keyDown
    // must still reach board.keyDown (to arm the temporary hand pointer) and
    // prevent the browser's default scroll (canvas jumping on every press).
    board.selection = null;
    expect(PlaitBoard.isFocus(board)).toBe(false);

    mountHook(board);
    const event = createSpaceKeyDown();
    window.dispatchEvent(event);

    expect(keyDownSpy).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('still gates non-space keydown behind isFocus when selection is null', () => {
    // Other shortcuts (Delete, mod+d, ...) must not fire without a selection.
    board.selection = null;
    expect(PlaitBoard.isFocus(board)).toBe(false);

    mountHook(board);
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'Delete',
        key: 'Delete',
        bubbles: true,
        cancelable: true,
      })
    );

    expect(keyDownSpy).not.toHaveBeenCalled();
  });

  it('resets the temporary hand gesture with a synthetic Space keyUp on window blur', () => {
    // When the pointer is released outside the window (or on Alt+Tab) the real
    // keyup never arrives; the blur fallback must reset the stuck hand state.
    mountHook(board);
    window.dispatchEvent(new Event('blur'));

    expect(keyUpSpy).toHaveBeenCalledTimes(1);
  });

  it('resets the hand gesture on document visibilitychange hidden as well', () => {
    mountHook(board);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(keyUpSpy).toHaveBeenCalledTimes(1);
  });
});

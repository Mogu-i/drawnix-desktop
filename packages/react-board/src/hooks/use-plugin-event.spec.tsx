import { IS_TEXT_EDITABLE, PlaitBoard, setupTestingBoard } from '@plait/core';
import type { PlaitBoard as PlaitBoardType, TestingBoardFixture } from '@plait/core';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefObject } from 'react';
import useBoardPluginEvent from './use-plugin-event';

const createSpaceKeyUp = () =>
  new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true, cancelable: true });

describe('useBoardPluginEvent keyup forwarding', () => {
  let fixture: TestingBoardFixture;
  let board: PlaitBoardType;
  let keyUpSpy: ReturnType<typeof vi.fn>;

  const mountHook = (targetBoard: PlaitBoardType) => {
    const viewportContainerRef = {
      current: document.createElement('div')
    } as unknown as RefObject<HTMLDivElement>;
    const hostRef = {
      current: document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    } as unknown as RefObject<SVGSVGElement>;
    return renderHook(() => useBoardPluginEvent(targetBoard, viewportContainerRef, hostRef));
  };

  beforeEach(() => {
    fixture = setupTestingBoard([], []);
    board = fixture.board;
    keyUpSpy = vi.fn();
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

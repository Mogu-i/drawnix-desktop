import rough from 'roughjs/bin/rough';
import {
  BOARD_TO_AFTER_CHANGE,
  BOARD_TO_CONTEXT,
  BOARD_TO_ELEMENT_HOST,
  BOARD_TO_HOST,
  BOARD_TO_ON_CHANGE,
  BOARD_TO_ROUGH_SVG,
  HOST_CLASS_NAME,
  IS_BOARD_ALIVE,
  IS_CHROME,
  IS_FIREFOX,
  IS_SAFARI,
  PlaitBoardContext,
  initializeViewBox,
  initializeViewportContainer,
  initializeViewportOffset,
  PlaitBoard,
  KEY_TO_ELEMENT_MAP,
} from '@plait/core';
import { useRef, useEffect, useMemo } from 'react';
import React from 'react';
import classNames from 'classnames';
import useBoardPluginEvent from './hooks/use-plugin-event';
import useBoardEvent from './hooks/use-board-event';

import './styles/index.scss';
import { useBoard, useListRender } from './hooks/use-board';

export type PlaitBoardProps = {
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
  afterInit?: (board: PlaitBoard) => void;
};

let boardDotPatternIdCounter = 0;

export const Board: React.FC<PlaitBoardProps> = ({ style, className, children, afterInit }) => {
  const hostRef = useRef<SVGSVGElement>(null);
  const elementLowerHostRef = useRef<SVGGElement>(null);
  const elementHostRef = useRef<SVGGElement>(null);
  const elementUpperHostRef = useRef<SVGGElement>(null);
  const elementTopHostRef = useRef<SVGGElement>(null);
  const activeHostRef = useRef<SVGGElement>(null);
  const viewportContainerRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const backgroundRectRef = useRef<SVGRectElement>(null);
  const dotPatternId = useMemo(() => `board-dot-grid-pattern-${++boardDotPatternIdCounter}`, []);

  const board = useBoard();
  const listRender = useListRender();

  useEffect(() => {
    const roughSVG = rough.svg(hostRef.current!, {
      options: { roughness: 0, strokeWidth: 1 },
    });
    BOARD_TO_ROUGH_SVG.set(board, roughSVG);
    BOARD_TO_HOST.set(board, hostRef.current!);
    IS_BOARD_ALIVE.set(board, true);
    BOARD_TO_ELEMENT_HOST.set(board, {
      lowerHost: elementLowerHostRef.current!,
      host: elementHostRef.current!,
      upperHost: elementUpperHostRef.current!,
      topHost: elementTopHostRef.current!,
      activeHost: activeHostRef.current!,
      container: boardContainerRef.current!,
      viewportContainer: viewportContainerRef.current!,
    });
    const context = new PlaitBoardContext();
    BOARD_TO_CONTEXT.set(board, context);
    KEY_TO_ELEMENT_MAP.set(board, new Map());

    if (!listRender.initialized) {
      listRender.initialize(board.children, {
        board: board,
        parent: board,
        parentG: PlaitBoard.getElementHost(board),
      });
      if (afterInit) {
        afterInit(board);
      }
    }

    initializeViewportContainer(board);
    initializeViewBox(board);
    initializeViewportOffset(board);

    // Keep the dot-grid background rect in sync with the host viewBox, so that
    // the pattern always covers the visible area under any zoom / pan. The
    // pattern itself is anchored to viewBox (board) coordinates, which keeps
    // the dots perfectly aligned with elements while zooming and panning.
    const updateBackgroundRect = () => {
      const host = hostRef.current;
      const rect = backgroundRectRef.current;
      if (!host || !rect) {
        return;
      }
      const viewBox = host.getAttribute('viewBox');
      if (!viewBox) {
        return;
      }
      const [x, y, width, height] = viewBox.split(/[\s,]+/).map(Number);
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', String(width));
      rect.setAttribute('height', String(height));
    };
    updateBackgroundRect();
    const viewBoxObserver = new MutationObserver(updateBackgroundRect);
    viewBoxObserver.observe(hostRef.current!, { attributes: true, attributeFilter: ['viewBox'] });

    return () => {
      viewBoxObserver.disconnect();
      BOARD_TO_CONTEXT.delete(board);
      BOARD_TO_AFTER_CHANGE.delete(board);
      BOARD_TO_ON_CHANGE.delete(board);
      BOARD_TO_ELEMENT_HOST.delete(board);
      IS_BOARD_ALIVE.delete(board);
      BOARD_TO_HOST.delete(board);
      BOARD_TO_ROUGH_SVG.delete(board);
      KEY_TO_ELEMENT_MAP.delete(board);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useBoardPluginEvent(board, viewportContainerRef, hostRef);
  useBoardEvent(board, viewportContainerRef);

  return (
    <div
      className={classNames(
        className,
        HOST_CLASS_NAME,
        `${getBrowserClassName()}`,
        `theme-${board.theme?.themeColorMode}`,
        `pointer-${board.pointer}`,
        {
          focused: PlaitBoard.isFocus(board),
          readonly: PlaitBoard.isReadonly(board),
          'disabled-scroll': board.options?.disabledScrollOnNonFocus && !PlaitBoard.isFocus(board),
        }
      )}
      ref={boardContainerRef}
      style={style}
    >
      <div
        className="viewport-container"
        ref={viewportContainerRef}
        style={{ width: '100%', height: '100%', overflow: 'auto' }}
      >
        <svg
          ref={hostRef}
          width="100%"
          height="100%"
          style={{ position: 'relative' }}
          className="board-host-svg"
        >
          <defs>
            <pattern
              id={dotPatternId}
              width={BOARD_DOT_GRID_SIZE}
              height={BOARD_DOT_GRID_SIZE}
              patternUnits="userSpaceOnUse"
            >
              <circle
                className="board-dot-grid-dot"
                cx={1}
                cy={1}
                r={1}
                fill="#d4d4d4"
              />
            </pattern>
          </defs>
          <rect
            ref={backgroundRectRef}
            className="board-dot-grid-background"
            fill={`url(#${dotPatternId})`}
            pointerEvents="none"
          />
          <g className="element-lower-host" ref={elementLowerHostRef}></g>
          <g className="element-host" ref={elementHostRef}></g>
          <g className="element-upper-host" ref={elementUpperHostRef}></g>
          <g className="element-top-host" ref={elementTopHostRef}></g>
        </svg>
        <svg width="100%" height="100%" className="board-active-svg">
          <g className="active-host-g" ref={activeHostRef}></g>
        </svg>
        {children}
      </div>
    </div>
  );
};

const BOARD_DOT_GRID_SIZE = 20;

const getBrowserClassName = () => {
  if (IS_SAFARI) {
    return 'safari';
  }
  if (IS_CHROME) {
    return 'chrome';
  }
  if (IS_FIREFOX) {
    return 'firefox';
  }
  return '';
};

import {
  BOARD_TO_MOVING_POINT,
  BOARD_TO_MOVING_POINT_IN_BOARD,
  PlaitBoard,
  WritableClipboardOperationType,
  deleteFragment,
  getClipboardData,
  hasInputOrTextareaTarget,
  setFragment,
  toHostPoint,
  toViewBoxPoint,
} from '@plait/core';
import type { ClipboardData } from '@plait/core';
import { useEventListener } from 'ahooks';
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

const useBoardPluginEvent = (
  board: PlaitBoard,
  viewportContainerRef: React.RefObject<HTMLDivElement>,
  hostRef: React.RefObject<SVGSVGElement>
) => {
  useEventListener(
    'pointerdown',
    (event) => {
      board.pointerDown(event);
    },
    { target: hostRef }
  );

  useEventListener(
    'pointermove',
    (event) => {
      BOARD_TO_MOVING_POINT_IN_BOARD.set(board, [event.x, event.y]);
      board.pointerMove(event);
    },
    { target: viewportContainerRef }
  );

  useEventListener(
    'pointerleave',
    (event) => {
      BOARD_TO_MOVING_POINT_IN_BOARD.delete(board);
      board.pointerLeave(event);
    },
    { target: viewportContainerRef }
  );

  useEventListener(
    'pointerup',
    (event) => {
      board.pointerUp(event);
    },
    { target: viewportContainerRef }
  );

  useEventListener(
    'touchstart',
    (event) => {
      board.touchStart(event);
    },
    { target: viewportContainerRef }
  );

  useEventListener(
    'touchmove',
    (event) => {
      board.touchMove(event);
    },
    { target: viewportContainerRef }
  );

  useEventListener(
    'touchend',
    (event) => {
      board.touchEnd(event);
    },
    { target: viewportContainerRef }
  );

  useEventListener(
    'dblclick',
    (event) => {
      if (PlaitBoard.isFocus(board) && !PlaitBoard.hasBeenTextEditing(board)) {
        board.dblClick(event);
      }
    },
    { target: hostRef }
  );

  useEventListener('pointermove', (event) => {
    BOARD_TO_MOVING_POINT.set(board, [event.x, event.y]);
    board.globalPointerMove(event);
  });

  useEventListener('pointerup', (event) => {
    board.globalPointerUp(event);
  });

  // 状态残留兜底：窗口失焦 / 页面隐藏时真实的空格 keyup 可能永远无法送达
  //（拖拽中拖到窗口外松手、Alt+Tab、锁屏），withHandPointer 的临时 hand 状态将
  // 残留并吞掉后续左键 pointerUp（表现为点击工具/元素无响应）。
  // @plait/core 未暴露复位 API（isShortcutKeyPressed / isSpaceHandGestureActive
  // 是插件闭包私有变量，只能由 keyUp / globalPointerUp 路径复位），因此派发一次
  // 合成的 globalPointerUp + Space keyUp 走内部复位链，属兜底而非常规路径。
  // globalPointerUp 用无 target 的哑事件：withSelection 只在 target 落在文档内时
  // 清选区，这里不应改动选区，仅复位手势状态。
  const resetHandGestureState = () => {
    try {
      board.globalPointerUp?.({ target: null } as unknown as PointerEvent);
      board.keyUp?.(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
    } catch {
      // 兜底失败不影响常规使用
    }
  };

  useEventListener('blur', resetHandGestureState);

  useEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        resetHandGestureState();
      }
    },
    { target: document }
  );

  useEventListener('keydown', (event) => {
    board.globalKeyDown(event);
    // 文档编辑器（.table/.markdown）打开时白板不再消费键盘：方向键/Tab 属于表格
    // 导航，Ctrl+Z 属于文档历史，空格是直接键入录入的一部分；isFocus 只看白板
    // 有无选区，与 DOM 焦点无关，不守卫会在编辑文档时同时触发白板快捷键。
    // globalKeyDown 保持无条件回灌，不干扰白板内部状态机。
    const boardMayConsumeKeys =
      !PlaitBoard.hasBeenTextEditing(board) &&
      !hasInputOrTextareaTarget(event.target) &&
      !hasDocEditorTarget(event.target) &&
      !isDocEditorOpen();
    if (!boardMayConsumeKeys) {
      return;
    }
    if (event.code === 'Space') {
      // 空格解耦 isFocus 门控：hand 模式入口（withHandPointer.keyDown 设置临时
      // hand 指针 + preventDefault）在 board.keyDown 链上，而 isFocus 只看白板
      // 选区（= !!board.selection）。无选区（点击空白、画板外松手清选区、切换
      // 工具后）时按空格若不回灌，临时 hand 不会设置（拖不动画布），preventDefault
      // 也不会执行（浏览器默认滚动 .viewport-container，画布向上跳一下）。
      // 两个症状同源成对，因此守卫通过时无条件 preventDefault + 回灌。
      event.preventDefault();
      board.keyDown(event);
      return;
    }
    // 其余按键仍受 isFocus 门控：无选区时不误触发 Delete、mod+d 等其它快捷键
    if (PlaitBoard.isFocus(board)) {
      board.keyDown(event);
    }
  });

  useEventListener('keyup', (event) => {
    // keyUp 必须无条件回灌给 board.keyUp，不能像 keyDown 那样受 isFocus 限制：
    // 空格拖拽平移由 withHandPointer.keyDown 进入临时 hand 模式，
    // 而只有对应的 keyUp 会复位 isShortcutKeyPressed 并清理 BOARD_TO_TEMPORARY_POINTER。
    // 拖拽过程中画布 selection 可能被清空（例如在画板外松开鼠标触发 globalPointerUp
    // 清除选区），此时 isFocus 为 false，若沿用 keyDown 的门控，松开的空格 keyUp 将无法
    // 送达，临时 hand 模式永远残留，导致之后每一次左键 pointerUp 被 withHandPointer 吞掉，
    // 表现为“松开空格后左键点击画板工具/元素无响应”。
    // 仅保留对画板内 slate 文本编辑的保护，避免干扰编辑区内空格的正常输入。
    if (!PlaitBoard.hasBeenTextEditing(board)) {
      board?.keyUp(event);
    }
  });

  useEventListener('copy', (event) => {
    // 文档编辑器打开时让路：否则白板会把元素 <plait> HTML 写进剪贴板，
    // 覆盖表格复制写入的 TSV/HTML/自定义 MIME
    if (hasDocEditorTarget(event.target) || isDocEditorOpen()) {
      return;
    }
    if (PlaitBoard.isFocus(board) && !PlaitBoard.hasBeenTextEditing(board)) {
      event.preventDefault();
      setFragment(board, WritableClipboardOperationType.copy, event.clipboardData);
    }
  });

  useEventListener('paste', async (clipboardEvent) => {
    // 文档编辑器打开时让路，避免把白板内容插进表格/Markdown 编辑器
    if (hasDocEditorTarget(clipboardEvent.target) || isDocEditorOpen()) {
      return;
    }
    if (
      PlaitBoard.isFocus(board) &&
      !PlaitBoard.isReadonly(board) &&
      !PlaitBoard.hasBeenTextEditing(board)
    ) {
      const mousePoint = PlaitBoard.getMovingPointInBoard(board);
      // 鼠标从未进入白板（纯键盘操作/刚切页签）时落点为空，原实现直接不粘贴；
      // 回退到当前视口中心，保证粘贴始终有明确落点（zoom≠1 时公式同样正确）
      const targetPoint = mousePoint
        ? toViewBoxPoint(board, toHostPoint(board, mousePoint[0], mousePoint[1]))
        : getViewportCenterPoint(board);

      // 图片优先：先从 items 收集图片文件（网页/聊天工具复制图片常只有 items）。
      // 一次粘贴只产生一个图片元素；白名单校验与不支持格式提示在 with-image 插件内
      const imageFiles = collectImageFilesFromClipboard(clipboardEvent.clipboardData);
      if (imageFiles.length) {
        board.insertFragment(
          { files: imageFiles },
          targetPoint,
          WritableClipboardOperationType.paste
        );
        return;
      }

      const rawHtml = clipboardEvent.clipboardData?.getData('text/html') ?? '';
      const hasPlaitFragment = /<plait[\s>]/i.test(rawHtml);

      // 网页 <img>（items 无文件）尽力而为：data:/http(s) 拉取转 File；
      // 拿不到 Blob（CORS/权限限制）时降级为插入文字并提示
      if (!hasPlaitFragment) {
        const imageSrc = findImageSrcInHtml(rawHtml);
        if (imageSrc) {
          const imageFile = await fetchImageFileFromSrc(imageSrc);
          if (imageFile) {
            board.insertFragment(
              { files: [imageFile] },
              targetPoint,
              WritableClipboardOperationType.paste
            );
            return;
          }
          showToastOnBoard(board, 'toast.imageFetchFallback');
        }
      }

      let clipboardData: ClipboardData | null;
      if (hasPlaitFragment) {
        // 白板元素复制：保持 @plait/core 原链路（<plait> HTML → 元素粘贴）
        clipboardData = await getClipboardData(clipboardEvent.clipboardData);
      } else {
        // text/html 不含 <plait>：提取保留块级换行的可见文本（替代 stripHtml 的压平行为），
        // 与 text/plain 一样生成一个文本元素
        const blockText = rawHtml ? extractBlockTextFromHtml(rawHtml) : '';
        const plainText = clipboardEvent.clipboardData?.getData('text/plain') ?? '';
        const text = blockText || plainText;
        clipboardData = text ? { text } : await getClipboardData(clipboardEvent.clipboardData);
      }
      if (clipboardData) {
        board.insertFragment(clipboardData, targetPoint, WritableClipboardOperationType.paste);
      }
    }
  });

  useEventListener('cut', (event) => {
    // 文档编辑器打开时让路，避免误删白板元素
    if (hasDocEditorTarget(event.target) || isDocEditorOpen()) {
      return;
    }
    if (
      PlaitBoard.isFocus(board) &&
      !PlaitBoard.isReadonly(board) &&
      !PlaitBoard.hasBeenTextEditing(board)
    ) {
      event.preventDefault();
      setFragment(board, WritableClipboardOperationType.cut, event.clipboardData);
      deleteFragment(board);
    }
  });

  useEventListener(
    'drop',
    (event) => {
      if (!PlaitBoard.isReadonly(board)) {
        event.preventDefault();
        board.drop(event);
      }
    },
    { target: viewportContainerRef }
  );

  useEventListener(
    'dragover',
    (event) => {
      event.preventDefault();
    },
    { target: viewportContainerRef }
  );
};

export default useBoardPluginEvent;

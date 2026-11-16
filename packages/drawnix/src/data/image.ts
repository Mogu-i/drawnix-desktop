import {
  getHitElementByPoint,
  getSelectedElements,
  isMovingElements,
  PlaitBoard,
  PlaitHistoryBoard,
  Point,
} from '@plait/core';
import { DataURL } from '../types';
import { getDataURL } from './blob';
import { MindElement, MindTransforms } from '@plait/mind';
import { DrawTransforms } from '@plait/draw';
import { getElementOfFocusedImage } from '@plait/common';

export const loadHTMLImageElement = (dataURL: DataURL) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = (error) => {
      reject(error);
    };
    image.src = dataURL;
  });
};

/**
 * 等待进行中的元素拖拽结束。移动插件在拖拽期间每帧 updatePoints 后持续置
 * MERGING=true（pointerup 的 cancelMove 才复位），异步图片插入若恰好在拖拽中
 * 落地：直接插入会被并进拖拽批次；即便用 withNewBatch 新开批次，后续拖拽帧
 * 也会被并进插入批次——一次撤销都会把「移动 + 插入」一起反转成删除元素。
 * 粘贴图片后立刻拖动是可复现路径，因此落地前必须等待拖拽结束；
 * 插入本身是同步的，等待期间不可能有新拖拽开始。
 * MERGING=true ⇒ isMovingElements=true（两者都在 updatePoints 的同一同步块内
 * 置位/复位），isMovingElements 是公开且可靠的拖拽中判定。
 */
const waitForDragEnd = async (board: PlaitBoard) => {
  while (isMovingElements(board)) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

export const buildImage = (image: HTMLImageElement, dataURL: DataURL, maxWidth: number) => {
  const width = image.width > maxWidth ? maxWidth : image.width;
  const height = (width / image.width) * image.height;
  return {
    url: dataURL,
    width,
    height,
  };
};

export const insertImage = async (
  board: PlaitBoard,
  imageFile: File,
  startPoint?: Point,
  isDrop?: boolean
) => {
  const selectedElement = getSelectedElements(board)[0] || getElementOfFocusedImage(board);
  const defaultImageWidth = selectedElement ? 240 : 400;
  const dataURL = await getDataURL(imageFile);
  const image = await loadHTMLImageElement(dataURL);
  const imageItem = buildImage(image, dataURL, defaultImageWidth);
  const element = startPoint && getHitElementByPoint(board, startPoint);
  if (isDrop && element && MindElement.isMindElement(board, element)) {
    MindTransforms.setImage(board, element as MindElement, imageItem);
    return;
  }
  if (selectedElement && MindElement.isMindElement(board, selectedElement) && !isDrop) {
    MindTransforms.setImage(board, selectedElement as MindElement, imageItem);
  } else {
    await waitForDragEnd(board);
    // 插入是独立语义动作，必须自成一个撤销批次：异步落地时可能与之前的
    // 操作同处一个 flush 窗口（operations.length !== 0 会强制合并进上一批），
    // withNewBatch 强制新开批次，撤销插入时只反转本次插入、不连带反转
    // 其它操作（G2）。真正的 insert_node 在 DrawTransforms 内部按插入
    // 时刻的 children.length 计算 path，等待结束后的路径不会失效（G3）
    PlaitHistoryBoard.withNewBatch(board, () => {
      DrawTransforms.insertImage(board, imageItem, startPoint);
    });
  }
};

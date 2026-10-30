import {
  addSelectedElement,
  clearSelectedElement,
  getViewportOrigination,
  idCreator,
  PlaitBoard,
  Point,
  Transforms,
} from '@plait/core';
import {
  CardElement,
  CARD_GEOMETRY_SHAPE,
  CARD_GEOMETRY_TYPE,
  CARD_HEIGHT,
  CARD_TYPE,
  CARD_WIDTH,
} from './type';

const getCenterPoint = (board: PlaitBoard): Point => {
  const containerRect = PlaitBoard.getBoardContainer(
    board
  ).getBoundingClientRect();
  const zoom = board.viewport.zoom;
  const origination = getViewportOrigination(board);
  const centerX = (origination?.[0] ?? 0) + containerRect.width / 2 / zoom;
  const centerY = (origination?.[1] ?? 0) + containerRect.height / 2 / zoom;
  return [centerX, centerY];
};

export const createCardElement = (points: [Point, Point]): CardElement => {
  return {
    id: idCreator(),
    type: CARD_GEOMETRY_TYPE,
    shape: CARD_GEOMETRY_SHAPE,
    customType: CARD_TYPE,
    points,
    title: '',
    content: '',
  };
};

export const insertCard = (board: PlaitBoard, center?: Point) => {
  const origin = center ?? getCenterPoint(board);
  const points: [Point, Point] = [
    [origin[0] - CARD_WIDTH / 2, origin[1] - CARD_HEIGHT / 2],
    [origin[0] + CARD_WIDTH / 2, origin[1] + CARD_HEIGHT / 2],
  ];
  const card = createCardElement(points);
  Transforms.insertNode(board, card, [board.children.length]);
  // Mirror the native draw creation flow: cache the selection directly
  // instead of issuing a set_selection operation. The onChange handler of
  // that operation resolves element paths (findPath) before ListRender has
  // registered the freshly inserted node, which would throw "Unable to find
  // the path for Plait node".
  clearSelectedElement(board);
  addSelectedElement(board, card);
  return card;
};

export const setCardData = (
  board: PlaitBoard,
  element: CardElement,
  data: Partial<Pick<CardElement, 'title' | 'content' | 'image'>>
) => {
  const path = PlaitBoard.findPath(board, element);
  Transforms.setNode(board, data, path);
};

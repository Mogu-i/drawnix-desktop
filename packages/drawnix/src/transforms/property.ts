import { PropertyTransforms } from '@plait/common';
import { getSelectedElements,isNullOrUndefined, Path, PlaitBoard, PlaitElement, Transforms } from '@plait/core';
import { getMemorizeKey } from '@plait/draw';
import { Card } from '../plugins/card/type';
import {
  applyOpacityToHex,
  hexAlphaToOpacity,
  isFullyOpaque,
  isNoColor,
  isValidColor,
  removeHexAlpha,
} from '../utils/color';
import { getCurrentFill, getCurrentStrokeColor, isClosedElement } from '../utils/property';
import { DEFAULT_FONT_SIZE, TextTransforms } from '@plait/text-plugins';

export const setFillColorOpacity = (board: PlaitBoard, fillOpacity: number) => {
  PropertyTransforms.setFillColor(board, null, {
    getMemorizeKey,
    callback: (element: PlaitElement, path: Path) => {
      if (!isClosedElement(board, element)) {
        return;
      }
      const currentFill = getCurrentFill(board, element);
      if (!isValidColor(currentFill)) {
        return;
      }
      const currentFillColor = removeHexAlpha(currentFill);
      const newFill = isFullyOpaque(fillOpacity)
        ? currentFillColor
        : applyOpacityToHex(currentFillColor, fillOpacity);
      Transforms.setNode(board, { fill: newFill }, path);
    },
  });
};

export const setFillColor = (board: PlaitBoard, fillColor: string) => {
  PropertyTransforms.setFillColor(board, null, {
    getMemorizeKey,
    callback: (element: PlaitElement, path: Path) => {
      if (!isClosedElement(board, element)) {
        return;
      }
      const currentFill = getCurrentFill(board, element);
      const currentOpacity = hexAlphaToOpacity(currentFill);
      if (isNoColor(fillColor)) {
        Transforms.setNode(board, { fill: null }, path);
      } else {
        if (isNullOrUndefined(currentOpacity) || isFullyOpaque(currentOpacity)) {
          Transforms.setNode(board, { fill: fillColor }, path);
        } else {
          Transforms.setNode(board, { fill: applyOpacityToHex(fillColor, currentOpacity) }, path);
        }
      }
    },
  });
};

export const setStrokeColorOpacity = (board: PlaitBoard, fillOpacity: number) => {
  PropertyTransforms.setStrokeColor(board, null, {
    getMemorizeKey,
    callback: (element: PlaitElement, path: Path) => {
      const currentStrokeColor = getCurrentStrokeColor(board, element);
      const currentStrokeColorValue = removeHexAlpha(currentStrokeColor);
      const newStrokeColor = isFullyOpaque(fillOpacity)
        ? currentStrokeColorValue
        : applyOpacityToHex(currentStrokeColorValue, fillOpacity);
      Transforms.setNode(board, { strokeColor: newStrokeColor }, path);
    },
  });
};

export const setStrokeColor = (board: PlaitBoard, newColor: string) => {
  PropertyTransforms.setStrokeColor(board, null, {
    getMemorizeKey,
    callback: (element: PlaitElement, path: Path) => {
      const currentStrokeColor = getCurrentStrokeColor(board, element);
      const currentOpacity = hexAlphaToOpacity(currentStrokeColor);
      if (isNoColor(newColor)) {
        Transforms.setNode(board, { strokeColor: null }, path);
      } else {
        if (isNullOrUndefined(currentOpacity) || isFullyOpaque(currentOpacity)) {
          Transforms.setNode(board, { strokeColor: newColor }, path);
        } else {
          Transforms.setNode(
            board,
            { strokeColor: applyOpacityToHex(newColor, currentOpacity) },
            path
          );
        }
      }
    },
  });
};

// The card has no slate text, so slate mark transforms would silently do
// nothing on it; when the selection consists of cards only, write the text
// style to the card's own fields instead (rendered by CardContent).
const getSelectedCards = (board: PlaitBoard) => {
  const selectedElements = getSelectedElements(board);
  if (
    selectedElements.length &&
    selectedElements.every((element) => Card.isCard(element))
  ) {
    return selectedElements;
  }
  return null;
};

const setCardsProperty = (
  board: PlaitBoard,
  cards: PlaitElement[],
  properties: Record<string, unknown>
) => {
  cards.forEach((element) => {
    Transforms.setNode(board, properties, PlaitBoard.findPath(board, element));
  });
};

export const setTextColor = (board: PlaitBoard, currentColor: string, newColor: string) => {
  const cards = getSelectedCards(board);
  if (cards) {
    setCardsProperty(
      board,
      cards,
      {
        fontColor: isNoColor(newColor)
          ? null
          : applyOpacityToHex(newColor, hexAlphaToOpacity(currentColor)),
      }
    );
    return;
  }
  const currentOpacity = hexAlphaToOpacity(currentColor);
  if (isNoColor(newColor)) {
    TextTransforms.setTextColor(board, null);
  } else {
    TextTransforms.setTextColor(board, applyOpacityToHex(newColor, currentOpacity));
  }
};

export const setTextColorOpacity = (board: PlaitBoard, currentColor: string, opacity: number) => {
  const cards = getSelectedCards(board);
  if (cards) {
    if (!currentColor) {
      return;
    }
    const newFontColor = isFullyOpaque(opacity)
      ? removeHexAlpha(currentColor)
      : applyOpacityToHex(removeHexAlpha(currentColor), opacity);
    setCardsProperty(board, cards, { fontColor: newFontColor });
    return;
  }
  const currentFontColorValue = removeHexAlpha(currentColor);
  const newFontColor = isFullyOpaque(opacity)
    ? currentFontColorValue
    : applyOpacityToHex(currentFontColorValue, opacity);
  TextTransforms.setTextColor(board, newFontColor);
};

export const setTextFontSize = (board: PlaitBoard, size: number) => {
  if (!Number.isFinite(size) || size <= 0) {
    return;
  }
  const cards = getSelectedCards(board);
  if (cards) {
    setCardsProperty(board, cards, { fontSize: size });
    return;
  }
  TextTransforms.setFontSize(board, String(size) as any, DEFAULT_FONT_SIZE);
};

import React from 'react';
import { PlaitBoard } from '@plait/core';
import { CardElement } from './type';
import { setCardData } from './transforms';
import { fileOpen } from '../../data/filesystem';
import { getDataURL } from '../../data/blob';
import { buildImage, loadHTMLImageElement } from '../../data/image';
import { IMAGE_MIME_TYPES } from '../../constants';
import { i18nInsidePlaitHook } from '../../i18n';

export interface CardContentProps {
  board: PlaitBoard;
  element: CardElement;
}

export const CardContent: React.FC<CardContentProps> = ({ board, element }) => {
  const { t } = i18nInsidePlaitHook();

  const handleInsertImage = async () => {
    try {
      const imageFile = await fileOpen({
        description: 'Image',
        extensions: Object.keys(
          IMAGE_MIME_TYPES
        ) as (keyof typeof IMAGE_MIME_TYPES)[],
      });
      const dataURL = await getDataURL(imageFile);
      const image = await loadHTMLImageElement(dataURL);
      const imageItem = buildImage(image, dataURL, 220);
      setCardData(board, element, { image: imageItem });
    } catch (error) {
      // 用户取消选择，忽略
    }
  };

  const stop = (event: React.PointerEvent) => {
    event.stopPropagation();
  };

  // popup-toolbar text styles: fontColor is inherited by title/content,
  // fontSize scales the content (title keeps its visual offset of +2px);
  // the title divider follows the border color (null border = invisible)
  const fontColor = element.fontColor ?? undefined;
  const fontSize = element.fontSize;
  const dividerColor =
    element.strokeColor === null ? 'transparent' : element.strokeColor || undefined;
  const titleStyle = {
    ...(fontSize
      ? { fontSize: `${fontSize + 2}px`, lineHeight: `${fontSize + 8}px` }
      : {}),
    ...(dividerColor ? { borderBottomColor: dividerColor } : {}),
  };
  const contentStyle = fontSize
    ? { lineHeight: `${Math.round(fontSize * 1.45)}px` }
    : undefined;

  return (
    <div
      className="drawnix-card"
      style={{ color: fontColor, fontSize: fontSize ? `${fontSize}px` : undefined }}
    >
      <div
        className="drawnix-card__title"
        style={titleStyle}
        contentEditable
        suppressContentEditableWarning
        onPointerDown={stop}
        onBlur={(event) => {
          const value = event.currentTarget.innerText.trim();
          if (value !== element.title) {
            setCardData(board, element, { title: value });
          }
        }}
      >
        {element.title}
      </div>
      <div
        className="drawnix-card__content"
        style={contentStyle}
        contentEditable
        suppressContentEditableWarning
        onPointerDown={stop}
        onBlur={(event) => {
          const value = event.currentTarget.innerText;
          if (value !== element.content) {
            setCardData(board, element, { content: value });
          }
        }}
      >
        {element.content}
      </div>
      {element.image && (
        <div className="drawnix-card__image-wrap" onPointerDown={stop}>
          <img
            className="drawnix-card__image"
            src={element.image.url}
            draggable={false}
          />
          <span
            className="drawnix-card__remove-image"
            onClick={() => setCardData(board, element, { image: undefined })}
          >
            ×
          </span>
        </div>
      )}
      <div className="drawnix-card__footer">
        <button
          type="button"
          className="drawnix-card__insert-image"
          onPointerDown={stop}
          onClick={handleInsertImage}
        >
          {t('card.insertImage')}
        </button>
      </div>
    </div>
  );
};

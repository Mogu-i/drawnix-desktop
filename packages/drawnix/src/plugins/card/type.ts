import { BasicShapes, PlaitGeometry } from '@plait/draw';

// Cards are stored as native geometry elements so that @plait/draw treats
// them like any other shape: arrows can bind to their connector points (the
// four edge midpoints provided by the `rectangle` engine), while moving,
// resizing and hit-testing all come from the draw plugins for free.
export const CARD_GEOMETRY_TYPE = 'geometry';

// use the enum member so the shape stays assignable to CardElement['shape']
export const CARD_GEOMETRY_SHAPE = BasicShapes.rectangle;

// Marker field distinguishing card elements from plain geometries.
export const CARD_TYPE = 'card';

export const CARD_WIDTH = 260;

export const CARD_HEIGHT = 180;

export interface CardImageData {
  url: string;
  width: number;
  height: number;
}

export interface CardElement extends PlaitGeometry {
  shape: BasicShapes.rectangle;
  customType: typeof CARD_TYPE;
  title: string;
  content: string;
  image?: CardImageData;
  // the card renders its own contentEditable instead of the slate text
  // used by @plait/draw, so text marks are stored on these fields
  fontColor?: string | null;
  fontSize?: number;
}

export const Card = {
  isCard: (value: unknown): value is CardElement => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      'customType' in value &&
      (value as { type: string }).type === CARD_GEOMETRY_TYPE &&
      (value as { customType: string }).customType === CARD_TYPE
    );
  },
};

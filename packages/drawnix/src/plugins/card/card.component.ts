import {
  ACTIVE_STROKE_WIDTH,
  OnContextChanged,
  PlaitBoard,
  PlaitPluginElementContext,
  RectangleClient,
} from '@plait/core';
import {
  ActiveGenerator,
  CommonElementFlavour,
  createActiveGenerator,
} from '@plait/common';
import { ArrowLineAutoCompleteGenerator } from '@plait/draw';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { CardContent } from './card-content';
import { CardElement } from './type';
import './card.scss';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

type Rectangle = { x: number; y: number; width: number; height: number };

export class CardComponent
  extends CommonElementFlavour<CardElement, PlaitBoard>
  implements OnContextChanged<CardElement, PlaitBoard>
{
  activeGenerator!: ActiveGenerator<CardElement>;

  // Draws the four connector dots around the selected card; the draw plugin
  // (withArrowLineAutoComplete) reads this generator to render hover
  // reactions and start quick arrow creation from a dot.
  lineAutoCompleteGenerator!: ArrowLineAutoCompleteGenerator;

  private root: Root | null = null;

  private rectEl: SVGRectElement | null = null;

  private foreignObjectEl: SVGForeignObjectElement | null = null;

  initializeGenerator() {
    this.activeGenerator = createActiveGenerator(this.board, {
      getRectangle: (element: CardElement) =>
        RectangleClient.getRectangleByPoints(element.points),
      getStrokeWidth: () => ACTIVE_STROKE_WIDTH,
      getStrokeOpacity: () => 1,
      hasResizeHandle: () => true,
    });
    this.lineAutoCompleteGenerator = new ArrowLineAutoCompleteGenerator(
      this.board
    );
    this.getRef().addGenerator(
      ArrowLineAutoCompleteGenerator.key,
      this.lineAutoCompleteGenerator
    );
    // mirrors GeometryComponent: both selection chrome and connector dots
    // must be redrawn whenever the active section is updated
    this.getRef().updateActiveSection = () => {
      this.activeGenerator.processDrawing(
        this.element,
        PlaitBoard.getActiveHost(this.board),
        { selected: this.selected }
      );
      this.lineAutoCompleteGenerator.processDrawing(
        this.element,
        PlaitBoard.getActiveHost(this.board),
        { selected: this.selected }
      );
    };
  }

  initialize(): void {
    super.initialize();
    this.initializeGenerator();
    this.renderCard();
    this.activeGenerator.processDrawing(
      this.element,
      PlaitBoard.getActiveHost(this.board),
      { selected: this.selected }
    );
    this.lineAutoCompleteGenerator.processDrawing(
      this.element,
      PlaitBoard.getActiveHost(this.board),
      { selected: this.selected }
    );
  }

  private applyRectangle(
    node: SVGRectElement | SVGForeignObjectElement,
    rectangle: Rectangle
  ) {
    node.setAttribute('x', `${rectangle.x}`);
    node.setAttribute('y', `${rectangle.y}`);
    node.setAttribute('width', `${rectangle.width}`);
    node.setAttribute('height', `${rectangle.height}`);
  }

  // Apply the popup-toolbar colors (fill / stroke color / stroke style) as
  // inline styles so they override the class defaults in card.scss;
  // null means "no color" picked in the toolbar.
  private applyCardStyle() {
    if (!this.rectEl) {
      return;
    }
    const { fill, strokeColor, strokeStyle } = this.element;
    this.rectEl.style.fill = fill === null ? 'none' : fill || '#ffffff';
    this.rectEl.style.stroke =
      strokeColor === null ? 'none' : strokeColor || '#d0d3d9';
    this.rectEl.style.strokeDasharray =
      strokeStyle === 'dashed'
        ? '8 4'
        : strokeStyle === 'dotted'
        ? '2 4'
        : '';
  }

  private renderCard() {
    const g = this.getElementG();
    const rectangle = RectangleClient.getRectangleByPoints(this.element.points);

    const rect = document.createElementNS(SVG_NS, 'rect') as SVGRectElement;
    rect.setAttribute('class', 'drawnix-card__bg');
    rect.setAttribute('rx', '8');
    rect.setAttribute('ry', '8');
    this.applyRectangle(rect, rectangle);
    g.appendChild(rect);
    this.rectEl = rect;

    const foreignObject = document.createElementNS(
      SVG_NS,
      'foreignObject'
    ) as SVGForeignObjectElement;
    this.applyRectangle(foreignObject, rectangle);
    const container = document.createElementNS(
      XHTML_NS,
      'div'
    ) as unknown as HTMLDivElement;
    container.setAttribute('class', 'drawnix-card__host');
    foreignObject.appendChild(container);
    g.appendChild(foreignObject);
    this.foreignObjectEl = foreignObject;

    this.root = createRoot(container);
    this.root.render(
      React.createElement(CardContent, {
        board: this.board,
        element: this.element,
      })
    );
    this.applyCardStyle();
  }

  onContextChanged(
    value: PlaitPluginElementContext<CardElement, PlaitBoard>,
    previous: PlaitPluginElementContext<CardElement, PlaitBoard>
  ) {
    if (value.element !== previous.element || value.hasThemeChanged) {
      const rectangle = RectangleClient.getRectangleByPoints(
        this.element.points
      );
      if (this.rectEl) {
        this.applyRectangle(this.rectEl, rectangle);
      }
      if (this.foreignObjectEl) {
        this.applyRectangle(this.foreignObjectEl, rectangle);
      }
      const contentChanged =
        value.hasThemeChanged ||
        value.element.title !== previous.element.title ||
        value.element.content !== previous.element.content ||
        value.element.image !== previous.element.image;
      const styleChanged =
        value.element.fill !== previous.element.fill ||
        value.element.strokeColor !== previous.element.strokeColor ||
        value.element.strokeStyle !== previous.element.strokeStyle ||
        value.element.fontColor !== previous.element.fontColor ||
        value.element.fontSize !== previous.element.fontSize;
      if (styleChanged) {
        this.applyCardStyle();
      }
      if (this.root && (contentChanged || styleChanged)) {
        this.root.render(
          React.createElement(CardContent, {
            board: this.board,
            element: this.element,
          })
        );
      }
    }

    const needUpdate = value.selected !== previous.selected;
    if (needUpdate || value.selected) {
      this.activeGenerator.processDrawing(
        this.element,
        PlaitBoard.getActiveHost(this.board),
        { selected: this.selected }
      );
      this.lineAutoCompleteGenerator.processDrawing(
        this.element,
        PlaitBoard.getActiveHost(this.board),
        { selected: this.selected }
      );
    }
  }

  destroy(): void {
    super.destroy();
    this.activeGenerator?.destroy();
    this.lineAutoCompleteGenerator?.destroy();
    if (this.root) {
      const root = this.root;
      this.root = null;
      setTimeout(() => {
        root.unmount();
      }, 0);
    }
  }
}

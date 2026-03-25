import type { LayoutResult } from '../layout/types.js';
import type { Tree } from '../model/Tree.js';
import type { EventBus } from '../interaction/EventBus.js';
import { createNodeCard } from './NodeCard.js';
import { paintEdges } from './EdgePainter.js';

const NS = 'http://www.w3.org/2000/svg';

const BTN_H = 24;
const BTN_MIN_W = 80;
const BTN_MARGIN_TOP = 12;

export class SVGRenderer {
  readonly svg: SVGSVGElement;
  readonly canvas: SVGGElement;
  private edgeLayer: SVGGElement;
  private coupleLayer: SVGGElement;
  private nodeLayer: SVGGElement;
  private buttonLayer: SVGGElement;
  private selectedId: string | null = null;
  private onToggleExpand: ((famId: string) => void) | null = null;

  constructor(container: HTMLElement, private bus: EventBus) {
    this.svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
    this.svg.setAttribute('class', 'ftv-svg');
    this.svg.style.cssText = 'width:100%;height:100%;display:block;cursor:grab;';

    this.canvas = document.createElementNS(NS, 'g') as SVGGElement;
    this.canvas.setAttribute('class', 'ftv-canvas');

    this.edgeLayer = document.createElementNS(NS, 'g') as SVGGElement;
    this.edgeLayer.setAttribute('class', 'ftv-layer-edges');

    this.coupleLayer = document.createElementNS(NS, 'g') as SVGGElement;
    this.coupleLayer.setAttribute('class', 'ftv-layer-couples');

    this.nodeLayer = document.createElementNS(NS, 'g') as SVGGElement;
    this.nodeLayer.setAttribute('class', 'ftv-layer-nodes');

    this.buttonLayer = document.createElementNS(NS, 'g') as SVGGElement;
    this.buttonLayer.setAttribute('class', 'ftv-layer-buttons');

    this.canvas.appendChild(this.edgeLayer);
    this.canvas.appendChild(this.coupleLayer);
    this.canvas.appendChild(this.nodeLayer);
    this.canvas.appendChild(this.buttonLayer);
    this.svg.appendChild(this.canvas);
    container.appendChild(this.svg);

    // Deselect on canvas click
    this.svg.addEventListener('click', () => {
      this.setSelected(null);
    });
  }

  setToggleExpandHandler(handler: (famId: string) => void): void {
    this.onToggleExpand = handler;
  }

  render(layout: LayoutResult, tree: Tree): void {
    // Clear layers
    while (this.edgeLayer.firstChild) this.edgeLayer.removeChild(this.edgeLayer.firstChild);
    while (this.coupleLayer.firstChild) this.coupleLayer.removeChild(this.coupleLayer.firstChild);
    while (this.nodeLayer.firstChild) this.nodeLayer.removeChild(this.nodeLayer.firstChild);
    while (this.buttonLayer.firstChild) this.buttonLayer.removeChild(this.buttonLayer.firstChild);

    // Draw edges first
    paintEdges(layout.edges, layout.nodes, this.edgeLayer, this.coupleLayer, layout.coupleMidX);

    // Draw nodes
    for (const layoutNode of layout.nodes.values()) {
      const individual = tree.getIndividual(layoutNode.id) ?? null;
      const card = createNodeCard(layoutNode, individual, this.bus);
      if (layoutNode.id === this.selectedId) {
        card.setAttribute('class', 'ftv-node ftv-node--selected');
      }
      this.nodeLayer.appendChild(card);
    }

    // Draw expand/collapse buttons
    for (const btn of layout.expandButtons) {
      this.buttonLayer.appendChild(this._createExpandButton(btn));
    }
  }

  private _createExpandButton(btn: LayoutResult['expandButtons'][number]): SVGGElement {
    const label = btn.expanded ? '▲' : `▼ ${btn.childCount}`;

    const g = document.createElementNS(NS, 'g') as SVGGElement;
    g.setAttribute('class', `ftv-expand-btn${btn.expanded ? ' ftv-expand-btn--expanded' : ''}`);

    // Always draw a vertical stub from the couple-connector level down to the
    // top of this button, so there is a visible connection even when collapsed.
    const btnY = btn.parentBottomY + BTN_MARGIN_TOP;

    // For single-parent families, also draw the horizontal arm from the card edge to btn.x
    if (btn.armFromX !== undefined) {
      const arm = document.createElementNS(NS, 'line') as SVGLineElement;
      arm.setAttribute('x1', String(Math.round(btn.armFromX)));
      arm.setAttribute('y1', String(Math.round(btn.parentMidY)));
      arm.setAttribute('x2', String(Math.round(btn.x)));
      arm.setAttribute('y2', String(Math.round(btn.parentMidY)));
      arm.setAttribute('stroke', '#94a3b8');
      arm.setAttribute('stroke-width', '2');
      arm.setAttribute('pointer-events', 'none');
      g.appendChild(arm);
    }

    const stub = document.createElementNS(NS, 'line') as SVGLineElement;
    stub.setAttribute('x1', String(Math.round(btn.x)));
    stub.setAttribute('y1', String(Math.round(btn.parentMidY)));
    stub.setAttribute('x2', String(Math.round(btn.x)));
    stub.setAttribute('y2', String(Math.round(btnY)));
    stub.setAttribute('stroke', '#94a3b8');
    stub.setAttribute('stroke-width', '2');
    stub.setAttribute('pointer-events', 'none');
    g.appendChild(stub);

    // Junction dot at the couple-connector level (mirrors the dot EdgePainter draws when expanded)
    const dot = document.createElementNS(NS, 'circle') as SVGCircleElement;
    dot.setAttribute('cx', String(Math.round(btn.x)));
    dot.setAttribute('cy', String(Math.round(btn.parentMidY)));
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', '#94a3b8');
    dot.setAttribute('pointer-events', 'none');
    g.appendChild(dot);

    g.setAttribute('data-fam-id', btn.famId);
    g.style.cursor = 'pointer';

    // Measure text to size the pill; approximate 7px per char
    const textW = Math.max(BTN_MIN_W, label.length * 7 + 20);
    const btnX = btn.x - textW / 2;

    // Pill background
    const rect = document.createElementNS(NS, 'rect') as SVGRectElement;
    rect.setAttribute('x', String(Math.round(btnX)));
    rect.setAttribute('y', String(Math.round(btnY)));
    rect.setAttribute('width', String(Math.round(textW)));
    rect.setAttribute('height', String(BTN_H));
    rect.setAttribute('rx', String(BTN_H / 2));
    rect.setAttribute('class', 'ftv-expand-btn__bg');
    g.appendChild(rect);

    // Label text
    const text = document.createElementNS(NS, 'text') as SVGTextElement;
    text.setAttribute('x', String(Math.round(btn.x)));
    text.setAttribute('y', String(Math.round(btnY + BTN_H / 2 + 5)));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'ftv-expand-btn__label');
    text.textContent = label;
    g.appendChild(text);

    g.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onToggleExpand?.(btn.famId);
    });

    return g;
  }

  setSelected(id: string | null): void {
    // Remove previous selection
    if (this.selectedId) {
      const prev = this.nodeLayer.querySelector(`[data-id="${CSS.escape(this.selectedId)}"]`);
      if (prev) {
        prev.setAttribute('class', 'ftv-node');
      }
    }

    this.selectedId = id;

    if (id) {
      const el = this.nodeLayer.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (el) {
        el.setAttribute('class', 'ftv-node ftv-node--selected');
      }
    }
  }

  destroy(): void {
    this.svg.remove();
  }
}

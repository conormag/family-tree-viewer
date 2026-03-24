export interface PanZoomState {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;

export class PanZoom {
  private state: PanZoomState = { x: 0, y: 0, scale: 1 };
  private canvas: SVGGElement | null = null;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private lastTouches: Touch[] = [];

  constructor(private svg: SVGSVGElement) {
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);

    svg.addEventListener('mousedown', this.onMouseDown);
    svg.addEventListener('mousemove', this.onMouseMove);
    svg.addEventListener('mouseup', this.onMouseUp);
    svg.addEventListener('mouseleave', this.onMouseUp);
    svg.addEventListener('wheel', this.onWheel, { passive: false });
    svg.addEventListener('touchstart', this.onTouchStart, { passive: false });
    svg.addEventListener('touchmove', this.onTouchMove, { passive: false });
    svg.addEventListener('touchend', this.onTouchEnd);
  }

  setCanvas(canvas: SVGGElement): void {
    this.canvas = canvas;
    this.applyTransform();
  }

  private applyTransform(): void {
    if (!this.canvas) return;
    this.canvas.setAttribute(
      'transform',
      `translate(${this.state.x},${this.state.y}) scale(${this.state.scale})`,
    );
  }

  private getSVGPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    this.isDragging = true;
    this.dragStart = { x: e.clientX - this.state.x, y: e.clientY - this.state.y };
    this.svg.style.cursor = 'grabbing';
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    this.state.x = e.clientX - this.dragStart.x;
    this.state.y = e.clientY - this.dragStart.y;
    this.applyTransform();
  }

  private onMouseUp(): void {
    this.isDragging = false;
    this.svg.style.cursor = 'grab';
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const pt = this.getSVGPoint(e.clientX, e.clientY);
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.state.scale * delta));

    // Zoom toward cursor
    this.state.x = pt.x - (pt.x - this.state.x) * (newScale / this.state.scale);
    this.state.y = pt.y - (pt.y - this.state.y) * (newScale / this.state.scale);
    this.state.scale = newScale;
    this.applyTransform();
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    this.lastTouches = Array.from(e.touches);
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    const touches = Array.from(e.touches);

    if (touches.length === 1 && this.lastTouches.length === 1) {
      // Single finger pan
      const dx = touches[0].clientX - this.lastTouches[0].clientX;
      const dy = touches[0].clientY - this.lastTouches[0].clientY;
      this.state.x += dx;
      this.state.y += dy;
      this.applyTransform();
    } else if (touches.length === 2 && this.lastTouches.length === 2) {
      // Two-finger pinch zoom
      const prevDist = Math.hypot(
        this.lastTouches[1].clientX - this.lastTouches[0].clientX,
        this.lastTouches[1].clientY - this.lastTouches[0].clientY,
      );
      const newDist = Math.hypot(
        touches[1].clientX - touches[0].clientX,
        touches[1].clientY - touches[0].clientY,
      );
      if (prevDist > 0) {
        const delta = newDist / prevDist;
        const centerX = (touches[0].clientX + touches[1].clientX) / 2;
        const centerY = (touches[0].clientY + touches[1].clientY) / 2;
        const pt = this.getSVGPoint(centerX, centerY);
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.state.scale * delta));
        this.state.x = pt.x - (pt.x - this.state.x) * (newScale / this.state.scale);
        this.state.y = pt.y - (pt.y - this.state.y) * (newScale / this.state.scale);
        this.state.scale = newScale;
        this.applyTransform();
      }
    }

    this.lastTouches = touches;
  }

  private onTouchEnd(e: TouchEvent): void {
    this.lastTouches = Array.from(e.touches);
  }

  fitToContainer(totalWidth: number, totalHeight: number, padding = 40): void {
    const svgRect = this.svg.getBoundingClientRect();
    const containerWidth = svgRect.width || 800;
    const containerHeight = svgRect.height || 600;

    if (totalWidth === 0 || totalHeight === 0) return;

    const scaleX = (containerWidth - padding * 2) / totalWidth;
    const scaleY = (containerHeight - padding * 2) / totalHeight;
    const scale = Math.min(scaleX, scaleY, MAX_SCALE);
    const clampedScale = Math.max(MIN_SCALE, scale);

    this.state.scale = clampedScale;
    this.state.x = (containerWidth - totalWidth * clampedScale) / 2;
    this.state.y = (containerHeight - totalHeight * clampedScale) / 2;
    this.applyTransform();
  }

  getState(): PanZoomState {
    return { ...this.state };
  }

  destroy(): void {
    this.svg.removeEventListener('mousedown', this.onMouseDown);
    this.svg.removeEventListener('mousemove', this.onMouseMove);
    this.svg.removeEventListener('mouseup', this.onMouseUp);
    this.svg.removeEventListener('mouseleave', this.onMouseUp);
    this.svg.removeEventListener('wheel', this.onWheel);
    this.svg.removeEventListener('touchstart', this.onTouchStart);
    this.svg.removeEventListener('touchmove', this.onTouchMove);
    this.svg.removeEventListener('touchend', this.onTouchEnd);
  }
}

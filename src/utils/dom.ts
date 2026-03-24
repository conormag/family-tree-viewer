import { ALL_STYLES } from '../styles.js';

const STYLE_ID = 'ftv-styles-v1';

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = ALL_STYLES;
  document.head.appendChild(el);
}

export function resolveContainer(container: string | HTMLElement): HTMLElement {
  if (typeof container === 'string') {
    const el = document.querySelector<HTMLElement>(container);
    if (!el) throw new Error(`FamilyTreeViewer: container "${container}" not found`);
    return el;
  }
  return container;
}

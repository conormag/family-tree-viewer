export const PANEL_STYLES = `
.ftv-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 360px;
  background: white;
  box-shadow: -4px 0 24px rgba(0,0,0,0.12);
  transform: translateX(100%);
  transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
  overflow-y: auto;
  z-index: 10;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1e293b;
}
.ftv-panel--open {
  transform: translateX(0);
}
.ftv-panel__header {
  padding: 20px 20px 12px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ftv-panel__name {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}
.ftv-panel__close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 20px;
  color: #64748b;
  padding: 4px 8px;
  border-radius: 4px;
}
.ftv-panel__close:hover { background: #f1f5f9; }
.ftv-panel__body { padding: 16px 20px; }
.ftv-panel__section { margin-bottom: 20px; }
.ftv-panel__section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
  margin: 0 0 8px;
}
.ftv-panel__dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; }
.ftv-panel__dt { font-size: 12px; color: #64748b; font-weight: 500; }
.ftv-panel__dd { font-size: 13px; margin: 0; }
.ftv-panel__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.ftv-btn {
  padding: 7px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  background: white;
  color: #374151;
  transition: background 0.15s;
}
.ftv-btn:hover { background: #f8fafc; }
.ftv-btn--primary { background: #3b82f6; color: white; border-color: #3b82f6; }
.ftv-btn--primary:hover { background: #2563eb; }
.ftv-btn--danger { color: #ef4444; border-color: #fca5a5; }
.ftv-btn--danger:hover { background: #fef2f2; }
.ftv-form { display: flex; flex-direction: column; gap: 12px; }
.ftv-form__row { display: flex; flex-direction: column; gap: 4px; }
.ftv-form__label { font-size: 12px; font-weight: 500; color: #374151; }
.ftv-form__input, .ftv-form__select, .ftv-form__textarea {
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  color: #1e293b;
  width: 100%;
  box-sizing: border-box;
  background: white;
}
.ftv-form__input:focus, .ftv-form__select:focus, .ftv-form__textarea:focus {
  outline: 2px solid #3b82f6;
  outline-offset: -1px;
  border-color: #3b82f6;
}
.ftv-form__textarea { min-height: 80px; resize: vertical; font-family: inherit; }
.ftv-form__actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
`;

export const NODE_STYLES = `
.ftv-node { transition: filter 0.15s; }
.ftv-node:hover .ftv-node__bg { stroke: #94a3b8; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.08)); }
.ftv-node--selected .ftv-node__bg { stroke: #3b82f6 !important; stroke-width: 2.5 !important; }
.ftv-node__name { dominant-baseline: auto; }
.ftv-node__dates { dominant-baseline: auto; }
.ftv-expand-btn__bg {
  fill: #f0f9ff;
  stroke: #7dd3fc;
  stroke-width: 1.5;
  transition: fill 0.15s;
}
.ftv-expand-btn:hover .ftv-expand-btn__bg { fill: #bae6fd; }
.ftv-expand-btn--expanded .ftv-expand-btn__bg { fill: #e0f2fe; stroke: #38bdf8; }
.ftv-expand-btn__label {
  font-size: 12px;
  font-weight: 600;
  fill: #0284c7;
  font-family: system-ui, -apple-system, sans-serif;
  pointer-events: none;
  dominant-baseline: auto;
}
`;

export const DARK_STYLES = `
.ftv--dark .ftv-panel { background: #1e293b; color: #f1f5f9; border-left: 1px solid #334155; }
.ftv--dark .ftv-panel__header { border-bottom-color: #334155; }
.ftv--dark .ftv-panel__close { color: #94a3b8; }
.ftv--dark .ftv-panel__close:hover { background: #334155; }
.ftv--dark .ftv-panel__dt { color: #94a3b8; }
.ftv--dark .ftv-panel__dd { color: #e2e8f0; }
.ftv--dark .ftv-btn { background: #334155; border-color: #475569; color: #e2e8f0; }
.ftv--dark .ftv-btn:hover { background: #3e4f66; }
.ftv--dark .ftv-btn--primary { background: #3b82f6; color: white; border-color: #3b82f6; }
.ftv--dark .ftv-form__input, .ftv--dark .ftv-form__select, .ftv--dark .ftv-form__textarea {
  background: #334155; border-color: #475569; color: #f1f5f9;
}
.ftv--dark .ftv-form__label { color: #cbd5e1; }
.ftv--dark .ftv-node__bg { fill: #1e293b !important; }
.ftv--dark .ftv-node__name { fill: #f1f5f9 !important; }
.ftv--dark svg { background: #0f172a; }
`;

export const ALL_STYLES = PANEL_STYLES + NODE_STYLES + DARK_STYLES;

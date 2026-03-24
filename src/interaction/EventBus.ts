import type { Tree } from '../model/Tree.js';

type Events = {
  'node:click': { id: string };
  'node:hover': { id: string | null };
  'tree:change': { tree: Tree };
};

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers: { [K in keyof Events]?: Array<Handler<Events[K]>> } = {};

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event]!.push(handler);
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    const list = this.handlers[event];
    if (!list) return;
    this.handlers[event] = list.filter(h => h !== handler) as typeof list;
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const list = this.handlers[event];
    if (!list) return;
    for (const h of list) {
      h(payload);
    }
  }
}

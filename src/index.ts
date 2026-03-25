import { parseGedcom } from './gedcom/parser.js';
import { serializeGedcom } from './gedcom/serializer.js';
import { buildTree, Tree } from './model/Tree.js';
import { computeLayout } from './layout/engine.js';
import { SVGRenderer } from './renderer/SVGRenderer.js';
import { PanZoom } from './interaction/PanZoom.js';
import { EventBus } from './interaction/EventBus.js';
import { SidePanel } from './ui/SidePanel.js';
import { EditEngine } from './edit/EditEngine.js';
import { injectStyles, resolveContainer } from './utils/dom.js';
import type { GedcomNode } from './gedcom/types.js';

export interface FamilyTreeViewerOptions {
  gedcom?: string;
  rootId?: string;
  onSave?: (gedcom: string) => void;
  theme?: 'light' | 'dark';
  readonly?: boolean;
}

export class FamilyTreeViewer {
  private container: HTMLElement;
  private bus: EventBus;
  private renderer: SVGRenderer;
  private panZoom: PanZoom;
  private tree: Tree;
  private editEngine: EditEngine;
  private sidePanel: SidePanel;
  private header: GedcomNode | null = null;
  private options: FamilyTreeViewerOptions;
  private expandedFamilies: Set<string> = new Set();

  constructor(container: string | HTMLElement, options: FamilyTreeViewerOptions = {}) {
    this.options = options;
    this.container = resolveContainer(container);

    // Ensure relative positioning for absolute children
    const pos = getComputedStyle(this.container).position;
    if (pos === 'static') {
      this.container.style.position = 'relative';
    }

    // Inject CSS (idempotent)
    injectStyles();

    // Apply theme
    this.container.classList.remove('ftv--light', 'ftv--dark');
    this.container.classList.add(options.theme === 'dark' ? 'ftv--dark' : 'ftv--light');

    // Core state
    this.tree = new Tree();
    this.bus = new EventBus();
    this.editEngine = new EditEngine(this.tree, this.bus);

    // Renderer
    this.renderer = new SVGRenderer(this.container, this.bus);
    this.renderer.setToggleExpandHandler((famId) => this._toggleExpand(famId));

    // Pan/zoom
    this.panZoom = new PanZoom(this.renderer.svg);
    this.panZoom.setCanvas(this.renderer.canvas);

    // Side panel
    this.sidePanel = new SidePanel(
      this.container,
      this.tree,
      this.editEngine,
      options.readonly ?? false,
      (parentId) => this._handleAddChild(parentId),
      (individualId) => this._handleAddSpouse(individualId),
    );

    // Wire events
    this.bus.on('node:click', ({ id }) => {
      this.renderer.setSelected(id);
      this.sidePanel.open(id);
    });

    this.bus.on('tree:change', () => {
      this._rerender();
      if (options.onSave) {
        options.onSave(this.getGedcom());
      }
    });

    // Load initial GEDCOM
    if (options.gedcom) {
      this.loadGedcom(options.gedcom);
    }
  }

  loadGedcom(text: string): void {
    const nodes = parseGedcom(text);

    // Check for ANSEL encoding
    const headNode = nodes.find(n => n.tag === 'HEAD');
    if (headNode) {
      const charNode = headNode.children.find(c => c.tag === 'CHAR');
      if (charNode && charNode.value.toUpperCase() === 'ANSEL') {
        console.warn('FamilyTreeViewer: ANSEL-encoded GEDCOM detected. Assuming UTF-8 — characters may not display correctly.');
      }
      this.header = headNode;
    }

    this._afterTreeLoad(buildTree(nodes));
  }

  private _afterTreeLoad(tree: Tree): void {
    this.tree = tree;
    this.editEngine = new EditEngine(this.tree, this.bus);
    this.sidePanel['tree'] = this.tree;
    this.sidePanel['editEngine'] = this.editEngine;
    this.expandedFamilies = this._computeInitialExpanded();
    this._rerender();
    setTimeout(() => this.fitToScreen(), 0);
  }

  async loadWikiTree(id: string, options: { depth?: number; apiBase?: string } = {}): Promise<void> {
    const { loadWikiTreeData } = await import('./loaders/wikitree.js');
    const { tree, rootId } = await loadWikiTreeData(id, options.depth ?? 3, options.apiBase);
    this.header = null;
    this.options.rootId = rootId;
    this._afterTreeLoad(tree);
  }

  getGedcom(): string {
    return serializeGedcom(this.tree, this.header);
  }

  fitToScreen(): void {
    const layout = computeLayout(this.tree, this.options.rootId, undefined, this.expandedFamilies);
    this.panZoom.fitToContainer(layout.totalWidth, layout.totalHeight);
  }

  selectPerson(id: string): void {
    this.renderer.setSelected(id);
    this.sidePanel.open(id);
  }

  destroy(): void {
    this.panZoom.destroy();
    this.renderer.destroy();
    this.sidePanel.destroy();
  }

  private _computeInitialExpanded(): Set<string> {
    // Expand root-level families — those where at least one parent is a root ancestor
    // (has no familyAsChild, or that family isn't in the tree)
    const expanded = new Set<string>();
    for (const fam of this.tree.getAllFamilies()) {
      if (fam.childIds.length === 0) continue;

      const hIsRoot = !fam.husbandId || (() => {
        const h = this.tree.getIndividual(fam.husbandId!);
        return !h || !h.familyAsChild || !this.tree.getFamily(h.familyAsChild);
      })();

      const wIsRoot = !fam.wifeId || (() => {
        const w = this.tree.getIndividual(fam.wifeId!);
        return !w || !w.familyAsChild || !this.tree.getFamily(w.familyAsChild);
      })();

      if (hIsRoot || wIsRoot) {
        expanded.add(fam.id);
      }
    }
    return expanded;
  }

  private _toggleExpand(famId: string): void {
    if (this.expandedFamilies.has(famId)) {
      // Collapse: remove this family and any descendant families that are only
      // reachable through it
      this._collapseFamily(famId);
    } else {
      this.expandedFamilies.add(famId);
    }
    this._rerender();
  }

  private _collapseFamily(famId: string): void {
    // Walk the family tree structure downward from famId, collecting every
    // descendant family (via children → their spouse-families → grandchildren …).
    // We use structure, not visibility, so that children who happen to be spouses
    // of independently-visible people (root ancestors) are also collapsed correctly.
    const toCollapse = new Set<string>([famId]);
    const queue = [famId];

    while (queue.length > 0) {
      const fid = queue.shift()!;
      const fam = this.tree.getFamily(fid);
      if (!fam) continue;

      for (const childId of fam.childIds) {
        const child = this.tree.getIndividual(childId);
        if (!child) continue;
        for (const spouseFamId of child.familiesAsSpouse) {
          if (!toCollapse.has(spouseFamId)) {
            toCollapse.add(spouseFamId);
            queue.push(spouseFamId);
          }
        }
      }
    }

    for (const fid of toCollapse) {
      this.expandedFamilies.delete(fid);
    }
  }

  private _rerender(): void {
    const layout = computeLayout(this.tree, this.options.rootId, undefined, this.expandedFamilies);
    this.renderer.render(layout, this.tree);
    this.sidePanel.refresh();
  }

  private _handleAddChild(parentId: string): void {
    const parent = this.tree.getIndividual(parentId);
    if (!parent) return;

    // Find or create a family for this parent
    let famId = parent.familiesAsSpouse[0];
    if (!famId) {
      const fam = this.tree.addFamily({
        childIds: [],
        ...(parent.sex === 'F' ? { wifeId: parentId } : { husbandId: parentId }),
      });
      parent.familiesAsSpouse.push(fam.id);
      famId = fam.id;
    }

    // Ensure the family is expanded so the new child is visible
    this.expandedFamilies.add(famId);

    const child = this.editEngine.addChild(famId, {
      givenName: 'New',
      surname: parent.surname,
      sex: 'U',
      events: [],
      notes: [],
    });

    this.sidePanel.open(child.id);
  }

  private _handleAddSpouse(individualId: string): void {
    const ind = this.tree.getIndividual(individualId);
    if (!ind) return;

    const spouse = this.editEngine.addSpouse(individualId, {
      givenName: 'New',
      surname: '',
      sex: ind.sex === 'M' ? 'F' : ind.sex === 'F' ? 'M' : 'U',
      events: [],
      notes: [],
    });

    this.sidePanel.open(spouse.id);
  }
}

// Re-export types for consumers
export type { Individual, Family, Sex, EventRecord } from './model/types.js';
export type { GedcomNode } from './gedcom/types.js';
export { parseGedcom } from './gedcom/parser.js';
export { serializeGedcom } from './gedcom/serializer.js';
export { buildTree } from './model/Tree.js';

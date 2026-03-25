import type { Tree } from '../model/Tree.js';
import type { Family } from '../model/types.js';
import type { LayoutNode, LayoutEdge, LayoutResult } from './types.js';

export interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  hGap?: number;
  coupleGap?: number;
  vGap?: number;
  componentGap?: number;
}

const DEFAULTS = {
  nodeWidth: 180,
  nodeHeight: 100,
  hGap: 60,
  coupleGap: 20,
  vGap: 120,
  componentGap: 120,
};

// ---------------------------------------------------------------------------
// Compute the set of visible individual IDs based on expand state
// ---------------------------------------------------------------------------
export function getVisibleSet(tree: Tree, expandedFamilies: Set<string>): Set<string> {
  const visibleIds = new Set<string>();
  const queue: string[] = [];

  // Seed root ancestors, but only those who are in a "root family" — a family
  // where the other parent is also a root ancestor (or there is no other parent).
  // Root ancestors who are only married to descendants (e.g. a spouse brought in
  // from outside the known lineage) are NOT seeded directly; they become visible
  // via the BFS spouse-add when their non-root partner is reached. This ensures
  // that collapsing a family hides those in-married spouses correctly.
  for (const ind of tree.getAllIndividuals()) {
    const isRootAncestor = !ind.familyAsChild || !tree.getFamily(ind.familyAsChild);
    if (!isRootAncestor) continue;

    // Standalone person with no families — always show.
    if (ind.familiesAsSpouse.length === 0) { queue.push(ind.id); continue; }

    // Seed if at least one family qualifies as a root family: the other parent
    // is also a root ancestor (or absent, i.e. single-parent family).
    let inRootFamily = false;
    for (const famId of ind.familiesAsSpouse) {
      const fam = tree.getFamily(famId);
      if (!fam) continue;
      const otherId = fam.husbandId === ind.id ? fam.wifeId : fam.husbandId;
      if (!otherId) { inRootFamily = true; break; }                    // single-parent family
      const other = tree.getIndividual(otherId);
      const otherIsRoot = !other?.familyAsChild || !tree.getFamily(other.familyAsChild);
      if (otherIsRoot) { inRootFamily = true; break; }
    }
    if (inRootFamily) queue.push(ind.id);
  }

  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const ind = tree.getIndividual(id);
    if (!ind) continue;
    visibleIds.add(id);

    // Always show spouses of visible individuals
    for (const famId of ind.familiesAsSpouse) {
      const fam = tree.getFamily(famId);
      if (!fam) continue;

      const spouseId = fam.husbandId === id ? fam.wifeId : fam.husbandId;
      if (spouseId && !visited.has(spouseId)) {
        // Don't show a spouse who is a child of a collapsed (or unknown) family —
        // collapsing their parent family should hide them even as a partner.
        const spouseInd = tree.getIndividual(spouseId);
        const spouseParentFam = spouseInd?.familyAsChild
          ? tree.getFamily(spouseInd.familyAsChild)
          : null;
        const spouseParentCollapsed =
          spouseParentFam !== null &&
          spouseParentFam !== undefined &&
          !expandedFamilies.has(spouseParentFam.id);
        if (!spouseParentCollapsed) queue.push(spouseId);
      }

      // If this family is expanded, show children
      if (expandedFamilies.has(famId)) {
        for (const childId of fam.childIds) {
          if (!visited.has(childId)) queue.push(childId);
        }
      }
    }
  }

  return visibleIds;
}

// ---------------------------------------------------------------------------
// Union-find: detect disconnected family islands
// ---------------------------------------------------------------------------
function detectComponents(tree: Tree, indIds: string[]): Map<string, string> {
  const indSet = new Set(indIds);
  const parent = new Map<string, string>();

  function find(id: string): string {
    if (!parent.has(id)) parent.set(id, id);
    const p = parent.get(id)!;
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  }

  function union(a: string, b: string): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const id of indIds) find(id);

  for (const fam of tree.getAllFamilies()) {
    const members = [fam.husbandId, fam.wifeId, ...fam.childIds].filter(
      (id): id is string => id !== undefined && id !== '' && indSet.has(id),
    );
    for (let i = 1; i < members.length; i++) union(members[0], members[i]);
  }

  const result = new Map<string, string>();
  for (const id of indIds) result.set(id, find(id));
  return result;
}

// ---------------------------------------------------------------------------
// Layout a single connected component — bottom-up Reingold-Tilford style.
//
// Key insight: compute each family's subtree width recursively (bottom-up),
// then assign X positions top-down by centering each couple over their
// allocated children block. This guarantees no sibling-group interleaving
// and no crossing parent-child lines.
// ---------------------------------------------------------------------------
function layoutComponent(
  indIds: string[],
  families: Family[],
  tree: Tree,
  expandedFamilies: Set<string> | undefined,
  nodeWidth: number,
  hGap: number,
  coupleGap: number,
): { genMap: Map<string, number>; xMap: Map<string, number> } {
  const indSet = new Set(indIds);
  const individuals = indIds.map(id => tree.getIndividual(id)!).filter(Boolean);
  const famById = new Map(families.map(f => [f.id, f]));
  const famIds = new Set(families.map(f => f.id));

  // ── Phase 1: Generation assignment ───────────────────────────────────────
  // BFS parent→child (no spouse crossing), then iteratively align spouses and
  // re-propagate children until stable.
  const genMap = new Map<string, number>();

  const rootAncestors = individuals.filter(
    ind => !ind.familyAsChild || !tree.getFamily(ind.familyAsChild),
  );
  if (rootAncestors.length === 0 && individuals.length > 0) {
    rootAncestors.push(individuals[0]);
  }

  const genQueue: Array<{ id: string; gen: number }> = rootAncestors.map(a => ({
    id: a.id,
    gen: 0,
  }));

  while (genQueue.length > 0) {
    const { id, gen } = genQueue.shift()!;
    const existing = genMap.get(id);
    if (existing !== undefined) {
      if (gen < existing) {
        genMap.set(id, gen);
        for (const child of tree.getChildren(id)) {
          if (indSet.has(child.id)) genQueue.push({ id: child.id, gen: gen + 1 });
        }
      }
      continue;
    }
    genMap.set(id, gen);
    for (const child of tree.getChildren(id)) {
      if (indSet.has(child.id)) genQueue.push({ id: child.id, gen: gen + 1 });
    }
  }

  for (const ind of individuals) {
    if (!genMap.has(ind.id)) genMap.set(ind.id, 0);
  }

  // Iteratively align spouses and re-propagate children until nothing changes
  let outerChanged = true;
  while (outerChanged) {
    outerChanged = false;

    let changed = true;
    while (changed) {
      changed = false;
      for (const fam of families) {
        const hGen = fam.husbandId ? genMap.get(fam.husbandId) : undefined;
        const wGen = fam.wifeId ? genMap.get(fam.wifeId) : undefined;
        if (hGen !== undefined && wGen !== undefined && hGen !== wGen) {
          const alignGen = Math.max(hGen, wGen);
          if (hGen !== alignGen) { genMap.set(fam.husbandId!, alignGen); changed = true; outerChanged = true; }
          if (wGen !== alignGen) { genMap.set(fam.wifeId!, alignGen); changed = true; outerChanged = true; }
        } else if (hGen !== undefined && wGen === undefined && fam.wifeId && indSet.has(fam.wifeId)) {
          genMap.set(fam.wifeId, hGen); changed = true; outerChanged = true;
        } else if (wGen !== undefined && hGen === undefined && fam.husbandId && indSet.has(fam.husbandId)) {
          genMap.set(fam.husbandId, wGen); changed = true; outerChanged = true;
        }
      }
    }

    changed = true;
    while (changed) {
      changed = false;
      for (const fam of families) {
        const parentGen =
          (fam.husbandId && genMap.get(fam.husbandId) !== undefined)
            ? genMap.get(fam.husbandId)!
            : (fam.wifeId && genMap.get(fam.wifeId) !== undefined)
              ? genMap.get(fam.wifeId)!
              : undefined;
        if (parentGen === undefined) continue;
        for (const childId of fam.childIds) {
          if (!indSet.has(childId)) continue;
          const existing = genMap.get(childId);
          const expected = parentGen + 1;
          if (existing === undefined || existing < expected) {
            genMap.set(childId, expected);
            changed = true;
            outerChanged = true;
          }
        }
      }
    }
  }

  // ── Phase 2: Bottom-up subtree width computation ──────────────────────────
  // coupleWidth: space needed for just the visible couple
  function coupleW(fam: Family): number {
    const h = !!(fam.husbandId && indSet.has(fam.husbandId));
    const w = !!(fam.wifeId && indSet.has(fam.wifeId));
    return h && w ? 2 * nodeWidth + coupleGap : nodeWidth;
  }

  // slotWidth: width allocated to one child in the children row.
  // If the child has their own family in this component, it equals that
  // family's full subtree width; otherwise just nodeWidth for a leaf.
  const widthCache = new Map<string, number>();

  function slotW(childId: string): number {
    const child = tree.getIndividual(childId);
    if (!child) return nodeWidth;
    for (const fid of child.familiesAsSpouse) {
      if (famIds.has(fid)) return subtreeW(fid);
    }
    return nodeWidth;
  }

  function subtreeW(famId: string): number {
    if (widthCache.has(famId)) return widthCache.get(famId)!;
    const fam = famById.get(famId);
    if (!fam) { widthCache.set(famId, nodeWidth); return nodeWidth; }

    const cw = coupleW(fam);
    const expanded = expandedFamilies === undefined || expandedFamilies.has(famId);
    const children = fam.childIds.filter(id => indSet.has(id));

    if (!expanded || children.length === 0) {
      widthCache.set(famId, cw); return cw;
    }

    let childW = 0;
    for (let i = 0; i < children.length; i++) {
      if (i > 0) childW += hGap;
      childW += slotW(children[i]);
    }
    const w = Math.max(cw, childW);
    widthCache.set(famId, w);
    return w;
  }

  // Pre-compute all family widths bottom-up
  for (const fam of families) subtreeW(fam.id);

  // ── Phase 3: Identify root families ──────────────────────────────────────
  // A family is a root family if none of its visible parents is a child of
  // another visible family in this component. These are placed top-level;
  // all other families are placed recursively as children.
  const rootFamilies = families.filter(fam => {
    for (const parentId of [fam.husbandId, fam.wifeId]) {
      if (!parentId || !indSet.has(parentId)) continue;
      const ind = tree.getIndividual(parentId);
      if (ind?.familyAsChild && famIds.has(ind.familyAsChild)) return false;
    }
    return true;
  });

  // ── Phase 4: Top-down X placement ────────────────────────────────────────
  const xMap = new Map<string, number>();
  const placed = new Set<string>();

  function placeFam(famId: string, leftX: number): void {
    const fam = famById.get(famId);
    if (!fam) return;

    const w = subtreeW(famId);
    const cw = coupleW(fam);
    const hasH = !!(fam.husbandId && indSet.has(fam.husbandId));
    const hasW = !!(fam.wifeId && indSet.has(fam.wifeId));

    // Center the couple within the full subtree width
    const coupleLeft = leftX + (w - cw) / 2;

    if (hasH && !placed.has(fam.husbandId!)) {
      xMap.set(fam.husbandId!, coupleLeft);
      placed.add(fam.husbandId!);
    }
    if (hasW) {
      const wx = hasH ? coupleLeft + nodeWidth + coupleGap : coupleLeft;
      if (!placed.has(fam.wifeId!)) {
        xMap.set(fam.wifeId!, wx);
        placed.add(fam.wifeId!);
      }
    }

    const expanded = expandedFamilies === undefined || expandedFamilies.has(famId);
    const children = fam.childIds.filter(id => indSet.has(id));
    if (!expanded || children.length === 0) return;

    // Compute total children width so we can centre the block under the couple
    let totalChildW = 0;
    for (let i = 0; i < children.length; i++) {
      if (i > 0) totalChildW += hGap;
      totalChildW += slotW(children[i]);
    }

    // Start the children block centred within the subtree (mirrors how the
    // couple itself is centred). This ensures the child block's midpoint
    // aligns with the couple's midpoint when coupleW !== totalChildW.
    let cx = leftX + (w - totalChildW) / 2;
    for (const childId of children) {
      const sw = slotW(childId);
      placeChild(childId, cx, sw);
      cx += sw + hGap;
    }
  }

  function placeChild(childId: string, leftX: number, sw: number): void {
    if (placed.has(childId)) return; // already placed (pedigree-collapse guard)
    const child = tree.getIndividual(childId);
    if (!child) return;
    // If this child is a parent in their own family, recurse into that family
    for (const fid of child.familiesAsSpouse) {
      if (famIds.has(fid)) {
        placeFam(fid, leftX);
        return;
      }
    }
    // Leaf node — center within its slot
    xMap.set(childId, leftX + (sw - nodeWidth) / 2);
    placed.add(childId);
  }

  // Place root families left-to-right
  let curX = 0;
  for (const fam of rootFamilies) {
    placeFam(fam.id, curX);
    curX += subtreeW(fam.id) + hGap;
  }

  // Place any individuals not yet positioned (lone individuals, edge cases)
  for (const ind of individuals) {
    if (!xMap.has(ind.id)) {
      xMap.set(ind.id, curX);
      curX += nodeWidth + hGap;
    }
  }

  return { genMap, xMap };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export function computeLayout(
  tree: Tree,
  _rootId?: string,
  options?: LayoutOptions,
  expandedFamilies?: Set<string>,
): LayoutResult {
  const { nodeWidth, nodeHeight, hGap, coupleGap, vGap, componentGap } = {
    ...DEFAULTS,
    ...options,
  };

  const nodes = new Map<string, LayoutNode>();
  const edges: LayoutEdge[] = [];
  const coupleMidX = new Map<string, number>();

  const allIndividuals = tree.getAllIndividuals();
  if (allIndividuals.length === 0) {
    return { nodes, edges, coupleMidX, expandButtons: [], totalWidth: 0, totalHeight: 0 };
  }

  // Determine which individuals are visible
  const visibleSet = expandedFamilies !== undefined
    ? getVisibleSet(tree, expandedFamilies)
    : new Set(allIndividuals.map(i => i.id));

  const visibleIndividuals = allIndividuals.filter(i => visibleSet.has(i.id));

  // 1. Detect disconnected components (among visible individuals only)
  const componentOf = detectComponents(tree, visibleIndividuals.map(i => i.id));
  const componentGroups = new Map<string, string[]>();
  for (const ind of visibleIndividuals) {
    const comp = componentOf.get(ind.id)!;
    if (!componentGroups.has(comp)) componentGroups.set(comp, []);
    componentGroups.get(comp)!.push(ind.id);
  }

  const sortedComponents = Array.from(componentGroups.values()).sort(
    (a, b) => b.length - a.length,
  );

  // 2. Layout each component independently, then assemble side by side
  const finalGenMap = new Map<string, number>();
  const finalXMap = new Map<string, number>();
  let xOffset = 0;

  for (const indIds of sortedComponents) {
    const indSet = new Set(indIds);
    const families = tree.getAllFamilies().filter(
      f =>
        (f.husbandId && indSet.has(f.husbandId)) ||
        (f.wifeId && indSet.has(f.wifeId)) ||
        f.childIds.some(c => indSet.has(c)),
    );

    const { genMap, xMap } = layoutComponent(
      indIds,
      families,
      tree,
      expandedFamilies,
      nodeWidth,
      hGap,
      coupleGap,
    );

    const xs = Array.from(xMap.values());
    const minX = xs.length ? Math.min(...xs) : 0;
    const maxX = xs.length ? Math.max(...xs) + nodeWidth : nodeWidth;
    const compWidth = maxX - minX;

    for (const [id, x] of xMap) {
      finalXMap.set(id, x - minX + xOffset);
    }
    for (const [id, gen] of genMap) {
      finalGenMap.set(id, gen);
    }

    xOffset += compWidth + componentGap;
  }

  // 3. Create LayoutNodes
  for (const ind of visibleIndividuals) {
    const gen = finalGenMap.get(ind.id) ?? 0;
    const x = finalXMap.get(ind.id) ?? 0;
    nodes.set(ind.id, {
      id: ind.id,
      x,
      y: gen * (nodeHeight + vGap),
      width: nodeWidth,
      height: nodeHeight,
      generation: gen,
      isGhost: false,
    });
  }

  // Ghost nodes are intentionally omitted: with the bottom-up layout, a
  // single-parent family is allocated nodeWidth, and a ghost would extend
  // beyond that slot causing overlaps. Unknown spouses are represented in
  // the GEDCOM data as real (minimal) INDI records and appear as normal cards.

  // 5. Couple midpoints (for EdgePainter bus-line origins)
  // For couples: midpoint between the two cards (sits in the gap between them).
  // For single-parent: just past the relevant card edge, mirroring where the
  // midpoint would be if there were a partner — this keeps the bus line off the card.
  for (const fam of tree.getAllFamilies()) {
    const hNode = fam.husbandId ? nodes.get(fam.husbandId) : undefined;
    const wNode = fam.wifeId ? nodes.get(fam.wifeId) : undefined;
    if (hNode && wNode) {
      coupleMidX.set(fam.id, (hNode.x + hNode.width / 2 + wNode.x + wNode.width / 2) / 2);
    } else if (hNode) {
      // Arm extends to the right of the husband card
      coupleMidX.set(fam.id, hNode.x + hNode.width + coupleGap / 2);
    } else if (wNode) {
      // Arm extends to the left of the wife card
      coupleMidX.set(fam.id, wNode.x - coupleGap / 2);
    }
  }

  // 6. Edges
  for (const fam of tree.getAllFamilies()) {
    const hId = fam.husbandId;
    const wId = fam.wifeId;

    if (hId && wId && nodes.has(hId) && nodes.has(wId)) {
      edges.push({ type: 'couple', fromId: hId, toId: wId, familyId: fam.id });
    }

    const famExpanded = expandedFamilies === undefined || expandedFamilies.has(fam.id);
    const visibleParentId = (hId && nodes.has(hId)) ? hId :
                            (wId && nodes.has(wId)) ? wId : undefined;
    if (famExpanded && visibleParentId) {
      for (const childId of fam.childIds) {
        if (nodes.has(childId)) {
          edges.push({ type: 'parent-child', fromId: visibleParentId, toId: childId, familyId: fam.id });
        }
      }
    }
  }

  // 7. Expand buttons
  const expandButtons: LayoutResult['expandButtons'] = [];
  for (const fam of tree.getAllFamilies()) {
    if (fam.childIds.length === 0) continue;

    const hNode = fam.husbandId ? nodes.get(fam.husbandId) : undefined;
    const wNode = fam.wifeId ? nodes.get(fam.wifeId) : undefined;
    if (!hNode && !wNode) continue;

    const hasRealHusb = hNode && !hNode.isGhost;
    const hasRealWife = wNode && !wNode.isGhost;
    if (!hasRealHusb && !hasRealWife) continue;

    const midX = coupleMidX.get(fam.id) ?? (hNode ?? wNode)!.x + nodeWidth / 2;
    const parentBottom = Math.max(
      hNode ? hNode.y + hNode.height : 0,
      wNode ? wNode.y + wNode.height : 0,
    );
    const parentMid = Math.min(
      hNode ? hNode.y + hNode.height / 2 : Infinity,
      wNode ? wNode.y + wNode.height / 2 : Infinity,
    );

    const isExpanded = expandedFamilies !== undefined && expandedFamilies.has(fam.id);

    // For single-parent families, record the card edge where the horizontal arm starts
    let armFromX: number | undefined;
    if (!(hNode && wNode)) {
      if (hNode) {
        armFromX = hNode.x + hNode.width;  // arm goes rightward
      } else if (wNode) {
        armFromX = wNode.x;                // arm goes leftward
      }
    }

    expandButtons.push({
      famId: fam.id,
      childCount: fam.childIds.length,
      x: midX,
      parentBottomY: parentBottom,
      parentMidY: parentMid === Infinity ? parentBottom - nodeHeight / 2 : parentMid,
      armFromX,
      expanded: isExpanded,
    });
  }

  // 8. Bounding box
  let maxX = 0;
  let maxY = 0;
  for (const node of nodes.values()) {
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }
  if (expandButtons.some(b => !b.expanded)) {
    maxY += 40;
  }

  return { nodes, edges, coupleMidX, expandButtons, totalWidth: maxX, totalHeight: maxY };
}

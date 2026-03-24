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

  // Seed: root ancestors (individuals with no known parent family in this tree)
  for (const ind of tree.getAllIndividuals()) {
    const isRootAncestor = !ind.familyAsChild || !tree.getFamily(ind.familyAsChild);
    if (isRootAncestor) queue.push(ind.id);
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
      if (spouseId && !visited.has(spouseId)) queue.push(spouseId);

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
// Layout a single connected component
// Returns {genMap, xMap} with x starting from 0 and no normalization applied yet.
// ---------------------------------------------------------------------------
function layoutComponent(
  indIds: string[],
  families: Family[],
  tree: Tree,
  nodeWidth: number,
  hGap: number,
  coupleGap: number,
): { genMap: Map<string, number>; xMap: Map<string, number> } {
  const indSet = new Set(indIds);
  const individuals = indIds.map(id => tree.getIndividual(id)!).filter(Boolean);

  // --- Generation assignment (BFS, parent→child only) ---
  const genMap = new Map<string, number>();

  const rootAncestors = individuals.filter(ind => !ind.familyAsChild || !tree.getFamily(ind.familyAsChild));
  if (rootAncestors.length === 0 && individuals.length > 0) {
    rootAncestors.push(individuals[0]);
  }

  const queue: Array<{ id: string; gen: number }> = rootAncestors.map(a => ({
    id: a.id,
    gen: 0,
  }));

  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;
    const existing = genMap.get(id);
    if (existing !== undefined) {
      if (gen < existing) {
        genMap.set(id, gen);
        for (const child of tree.getChildren(id)) {
          if (indSet.has(child.id)) queue.push({ id: child.id, gen: gen + 1 });
        }
      }
      continue;
    }
    genMap.set(id, gen);
    for (const child of tree.getChildren(id)) {
      if (indSet.has(child.id)) queue.push({ id: child.id, gen: gen + 1 });
    }
  }

  for (const ind of individuals) {
    if (!genMap.has(ind.id)) genMap.set(ind.id, 0);
  }

  // --- Iteratively align spouses and re-propagate children until stable ---
  // We interleave both passes because child re-propagation can push children
  // to a higher generation, which may leave their spouses (who were aligned
  // in a prior pass) stranded at a lower generation. Repeating until nothing
  // changes ensures full convergence.
  let outerChanged = true;
  while (outerChanged) {
    outerChanged = false;

    // Spouse alignment: raise the "floating" spouse to match the known one
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

    // Child re-propagation: ensure children are at least parentGen + 1
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
            outerChanged = true; // children moved — spouses may need re-alignment
          }
        }
      }
    }
  }

  // --- X-position assignment per generation row ---
  const genGroups = new Map<number, string[]>();
  for (const [id, gen] of genMap) {
    if (!genGroups.has(gen)) genGroups.set(gen, []);
    genGroups.get(gen)!.push(id);
  }

  const sortedGens = Array.from(genGroups.keys()).sort((a, b) => a - b);
  const xMap = new Map<string, number>();

  for (const gen of sortedGens) {
    const members = genGroups.get(gen)!;
    let curX = 0;
    const processedInGen = new Set<string>();

    for (const memberId of members) {
      if (processedInGen.has(memberId)) continue;
      const ind = tree.getIndividual(memberId);
      if (!ind) continue;

      // Skip if this person's spouse (from any family) was already placed first
      let isSecondarySpouse = false;
      for (const famId of ind.familiesAsSpouse) {
        const fam = tree.getFamily(famId);
        if (!fam) continue;
        const spouseId = fam.husbandId === memberId ? fam.wifeId : fam.husbandId;
        if (spouseId && processedInGen.has(spouseId)) {
          isSecondarySpouse = true;
          break;
        }
      }
      if (isSecondarySpouse) continue;

      xMap.set(memberId, curX);
      processedInGen.add(memberId);
      curX += nodeWidth + coupleGap;

      // Place the first unplaced same-generation spouse immediately after
      let spousePlaced = false;
      for (const famId of ind.familiesAsSpouse) {
        const fam = tree.getFamily(famId);
        if (!fam) continue;
        const spouseId = fam.husbandId === memberId ? fam.wifeId : fam.husbandId;
        if (
          spouseId &&
          indSet.has(spouseId) &&
          !processedInGen.has(spouseId) &&
          genMap.get(spouseId) === gen
        ) {
          xMap.set(spouseId, curX);
          processedInGen.add(spouseId);
          spousePlaced = true;
          curX += nodeWidth + hGap;
          break; // only one spouse adjacent; additional marriages handled by long connector
        }
      }

      if (!spousePlaced) {
        curX += hGap - coupleGap;
      }
    }
  }

  // --- Pass 3: Center direct children under parents ---
  // IMPORTANT: we only include a child's spouse in the cluster when that spouse
  // has NO visible parent family of their own. If the spouse IS a direct child of
  // another family, including them here would cause the two families' centerings to
  // fight over that shared pair, pushing siblings into each other. Root-ancestor
  // spouses (no parent family in the tree) are fine to include because nothing else
  // will move them.
  for (const fam of families) {
    if (fam.childIds.length === 0) continue;

    const hX = fam.husbandId ? xMap.get(fam.husbandId) : undefined;
    const wX = fam.wifeId ? xMap.get(fam.wifeId) : undefined;

    let coupleCenter: number;
    if (hX !== undefined && wX !== undefined) {
      coupleCenter = (hX + nodeWidth / 2 + wX + nodeWidth / 2) / 2;
    } else if (hX !== undefined) {
      coupleCenter = hX + nodeWidth / 2;
    } else if (wX !== undefined) {
      coupleCenter = wX + nodeWidth / 2;
    } else {
      continue;
    }

    const childGen = genMap.get(fam.childIds.find(c => indSet.has(c)) ?? '');
    const clusterIds = new Set<string>();
    for (const childId of fam.childIds) {
      if (!indSet.has(childId)) continue;
      clusterIds.add(childId);
      const childInd = tree.getIndividual(childId);
      if (!childInd) continue;
      for (const childFamId of childInd.familiesAsSpouse) {
        const childFam = tree.getFamily(childFamId);
        if (!childFam) continue;
        const spouseId =
          childFam.husbandId === childId ? childFam.wifeId : childFam.husbandId;
        if (!spouseId || !indSet.has(spouseId) || genMap.get(spouseId) !== childGen) continue;

        // Only include spouse if they have no visible parent family.
        // Spouses who are direct children of another family are left in place;
        // they will be moved by their own family's centering pass.
        const spouseInd = tree.getIndividual(spouseId);
        const spouseHasParentFam =
          spouseInd?.familyAsChild !== undefined &&
          tree.getFamily(spouseInd.familyAsChild) !== undefined;

        if (!spouseHasParentFam) {
          clusterIds.add(spouseId);
        }
      }
    }

    const clusterXs = Array.from(clusterIds)
      .map(id => xMap.get(id))
      .filter((x): x is number => x !== undefined);

    if (clusterXs.length === 0) continue;

    const clusterLeft = Math.min(...clusterXs);
    const clusterRight = Math.max(...clusterXs) + nodeWidth;
    const shift = coupleCenter - (clusterLeft + clusterRight) / 2;

    if (Math.abs(shift) > 1) {
      for (const id of clusterIds) {
        const x = xMap.get(id);
        if (x !== undefined) xMap.set(id, x + shift);
      }
    }
  }

  // --- Pass 3b: Family-cluster separation ---
  // After centering, children of one family may overlap children of another because
  // a large sibling group (e.g., 12 children) extends past the adjacent couple's position.
  // This pass groups visible children by their parent family and ensures each family's
  // sibling block is a contiguous region with at least hGap between adjacent blocks.
  {
    // Build nodeFamily: which family each node is a child of
    const nodeFamily = new Map<string, string>();
    for (const fam of families) {
      for (const childId of fam.childIds) {
        if (indSet.has(childId)) nodeFamily.set(childId, fam.id);
      }
    }

    for (const [gen, members] of genGroups) {
      // Collect nodes that have a known parent family, plus their root-ancestor spouses
      // (spouses with no parent family travel with their sibling cluster, mirroring
      // the Pass 3 centering logic — prevents them being stranded when the cluster shifts).
      const familyToMembers = new Map<string, string[]>();
      for (const id of members) {
        const famId = nodeFamily.get(id);
        if (!famId) continue;
        if (!familyToMembers.has(famId)) familyToMembers.set(famId, []);
        familyToMembers.get(famId)!.push(id);

        // Also include root-ancestor spouses of each child in the same cluster
        const childInd = tree.getIndividual(id);
        if (!childInd) continue;
        for (const spouseFamId of childInd.familiesAsSpouse) {
          const spouseFam = tree.getFamily(spouseFamId);
          if (!spouseFam) continue;
          const spouseId = spouseFam.husbandId === id ? spouseFam.wifeId : spouseFam.husbandId;
          if (!spouseId || !indSet.has(spouseId) || genMap.get(spouseId) !== gen) continue;
          // Only include spouse if they have no visible parent family
          const spouseInd = tree.getIndividual(spouseId);
          if (spouseInd?.familyAsChild && tree.getFamily(spouseInd.familyAsChild)) continue;
          if (!familyToMembers.get(famId)!.includes(spouseId)) {
            familyToMembers.get(famId)!.push(spouseId);
          }
        }
      }
      if (familyToMembers.size <= 1) continue;

      // Compute parent couple center for each cluster
      const clusters: Array<{ ids: string[]; parentCX: number }> = [];
      for (const [famId, ids] of familyToMembers) {
        const fam = families.find(f => f.id === famId);
        if (!fam) continue;
        const hX = fam.husbandId && indSet.has(fam.husbandId) ? xMap.get(fam.husbandId) : undefined;
        const wX = fam.wifeId && indSet.has(fam.wifeId) ? xMap.get(fam.wifeId) : undefined;
        let parentCX: number;
        if (hX !== undefined && wX !== undefined) parentCX = (hX + nodeWidth / 2 + wX + nodeWidth / 2) / 2;
        else if (hX !== undefined) parentCX = hX + nodeWidth / 2;
        else if (wX !== undefined) parentCX = wX + nodeWidth / 2;
        else parentCX = Math.min(...ids.map(id => xMap.get(id) ?? 0)) + nodeWidth / 2;
        clusters.push({ ids, parentCX });
      }

      // Sort clusters by parent position
      clusters.sort((a, b) => a.parentCX - b.parentCX);

      // Ensure each cluster starts after the previous one ends (with hGap)
      for (let ci = 0; ci < clusters.length - 1; ci++) {
        const left = clusters[ci];
        const right = clusters[ci + 1];
        const leftRight = Math.max(...left.ids.map(id => (xMap.get(id) ?? 0) + nodeWidth));
        const rightLeft = Math.min(...right.ids.map(id => xMap.get(id) ?? 0));
        if (rightLeft < leftRight + hGap) {
          const push = leftRight + hGap - rightLeft;
          for (const id of right.ids) xMap.set(id, (xMap.get(id) ?? 0) + push);
          right.parentCX += push;
        }
      }
    }
  }

  // --- Pass 4: Resolve x-overlaps, treating same-generation couples as units ---
  // After centering, cross-family married pairs may not be pixel-adjacent (each was
  // moved by their own family's centering independently). The sweep below pushes
  // overlapping nodes apart. Couples are treated as atomic units — when a couple is
  // pushed right, both members move together to keep them adjacent.

  // Build couple-partner map (same generation only)
  const couplePartnerMap = new Map<string, string>();
  for (const fam of families) {
    if (!fam.husbandId || !fam.wifeId) continue;
    if (!indSet.has(fam.husbandId) || !indSet.has(fam.wifeId)) continue;
    if (genMap.get(fam.husbandId) !== genMap.get(fam.wifeId)) continue;
    couplePartnerMap.set(fam.husbandId, fam.wifeId);
    couplePartnerMap.set(fam.wifeId, fam.husbandId);
  }

  // Group by generation and sweep
  const genRowIds = new Map<number, string[]>();
  for (const [id, gen] of genMap) {
    if (!genRowIds.has(gen)) genRowIds.set(gen, []);
    genRowIds.get(gen)!.push(id);
  }

  for (const [, ids] of genRowIds) {
    // Sort by x; run multiple times until stable (pushing one node may require
    // re-checking earlier pairs after a couple is snapped into adjacency).
    let sweepChanged = true;
    while (sweepChanged) {
      sweepChanged = false;
      ids.sort((a, b) => (xMap.get(a) ?? 0) - (xMap.get(b) ?? 0));

      for (let i = 0; i < ids.length - 1; i++) {
        const leftId = ids[i];
        const rightId = ids[i + 1];
        const leftX = xMap.get(leftId) ?? 0;
        const rightX = xMap.get(rightId) ?? 0;

        const areCouple = couplePartnerMap.get(leftId) === rightId;
        const minGap = areCouple ? coupleGap : hGap;
        const minRightX = leftX + nodeWidth + minGap;

        if (rightX < minRightX) {
          const push = minRightX - rightX;
          // Push rightId and all nodes to its right. If rightId has a couple
          // partner that is also in the row but further right, it will be
          // encountered by the sweep and kept adjacent naturally. If the partner
          // is to the LEFT (because centering swapped the expected order), snap
          // it to the right of leftId so the couple is adjacent.
          for (let j = i + 1; j < ids.length; j++) {
            xMap.set(ids[j], (xMap.get(ids[j]) ?? 0) + push);
          }
          sweepChanged = true;
          break; // re-sort and re-sweep after a push
        }
      }
    }

    // Final pass: ensure every couple is exactly coupleGap apart.
    // After all pushes the couple may still have a gap larger than coupleGap if
    // the two members were centered under different parents. Snap the right
    // member to sit immediately beside the left member when they are adjacent
    // in the sorted order.
    ids.sort((a, b) => (xMap.get(a) ?? 0) - (xMap.get(b) ?? 0));
    for (let i = 0; i < ids.length - 1; i++) {
      const leftId = ids[i];
      const rightId = ids[i + 1];
      if (couplePartnerMap.get(leftId) === rightId) {
        const leftX = xMap.get(leftId) ?? 0;
        const expectedRightX = leftX + nodeWidth + coupleGap;
        const actualRightX = xMap.get(rightId) ?? 0;
        if (actualRightX > expectedRightX + 1) {
          // Pull the right member closer — but only if the gap between them is
          // bigger than coupleGap AND there's no other node between them (the
          // sort means they ARE adjacent in this row).
          const pull = actualRightX - expectedRightX;
          // Shift rightId and everything to its right left by pull
          for (let j = i + 1; j < ids.length; j++) {
            xMap.set(ids[j], (xMap.get(ids[j]) ?? 0) - pull);
          }
        }
      }
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
    : new Set(allIndividuals.map(i => i.id)); // no filtering: show all

  const visibleIndividuals = allIndividuals.filter(i => visibleSet.has(i.id));

  // 1. Detect connected components (among visible individuals only)
  const componentOf = detectComponents(tree, visibleIndividuals.map(i => i.id));
  const componentGroups = new Map<string, string[]>();
  for (const ind of visibleIndividuals) {
    const comp = componentOf.get(ind.id)!;
    if (!componentGroups.has(comp)) componentGroups.set(comp, []);
    componentGroups.get(comp)!.push(ind.id);
  }

  // Sort by descending size so the biggest component comes first (top-left)
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
      nodeWidth,
      hGap,
      coupleGap,
    );

    // Normalize this component so its minimum x = 0
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

  // 3. Create LayoutNodes (visible only)
  for (const ind of visibleIndividuals) {
    const gen = finalGenMap.get(ind.id) ?? 0;
    const x = finalXMap.get(ind.id) ?? 0;
    const y = gen * (nodeHeight + vGap);
    nodes.set(ind.id, {
      id: ind.id,
      x,
      y,
      width: nodeWidth,
      height: nodeHeight,
      generation: gen,
      isGhost: false,
    });
  }

  // 4. Ghost nodes for families with only one known spouse (visible)
  let ghostCounter = 0;
  for (const fam of tree.getAllFamilies()) {
    const hasHusb = fam.husbandId && nodes.has(fam.husbandId);
    const hasWife = fam.wifeId && nodes.has(fam.wifeId);
    const hasFamilyVisible =
      (fam.husbandId && visibleSet.has(fam.husbandId)) ||
      (fam.wifeId && visibleSet.has(fam.wifeId));
    if (!hasFamilyVisible) continue;

    if (!hasHusb && hasWife && fam.wifeId) {
      const wifeNode = nodes.get(fam.wifeId);
      if (wifeNode) {
        const ghostX = wifeNode.x - nodeWidth - coupleGap;
        // Skip ghost if another real node is already at this position
        const conflict = Array.from(nodes.values()).some(
          n => !n.isGhost && n.generation === wifeNode.generation && Math.abs(n.x - ghostX) < nodeWidth,
        );
        if (!conflict) {
          const ghostId = `@GHOST${ghostCounter++}@`;
          nodes.set(ghostId, {
            id: ghostId,
            x: ghostX,
            y: wifeNode.y,
            width: nodeWidth,
            height: nodeHeight,
            generation: wifeNode.generation,
            isGhost: true,
            ghostFamilyId: fam.id,
          });
        }
      }
    } else if (hasHusb && !hasWife && fam.husbandId) {
      const husbNode = nodes.get(fam.husbandId);
      if (husbNode) {
        const ghostX = husbNode.x + nodeWidth + coupleGap;
        // Skip ghost if another real node is already at this position
        const conflict = Array.from(nodes.values()).some(
          n => !n.isGhost && n.generation === husbNode.generation && Math.abs(n.x - ghostX) < nodeWidth,
        );
        if (!conflict) {
          const ghostId = `@GHOST${ghostCounter++}@`;
          nodes.set(ghostId, {
            id: ghostId,
            x: ghostX,
            y: husbNode.y,
            width: nodeWidth,
            height: nodeHeight,
            generation: husbNode.generation,
            isGhost: true,
            ghostFamilyId: fam.id,
          });
        }
      }
    }
  }

  // 5. Compute couple midpoints (used by EdgePainter for correct bus line origin)
  for (const fam of tree.getAllFamilies()) {
    const hNode = fam.husbandId ? nodes.get(fam.husbandId) : undefined;
    const wNode = fam.wifeId ? nodes.get(fam.wifeId) : undefined;
    if (hNode && wNode) {
      coupleMidX.set(fam.id, (hNode.x + hNode.width / 2 + wNode.x + wNode.width / 2) / 2);
    } else if (hNode) {
      coupleMidX.set(fam.id, hNode.x + hNode.width / 2);
    } else if (wNode) {
      coupleMidX.set(fam.id, wNode.x + wNode.width / 2);
    }
  }

  // 6. Build edges (only for visible nodes)
  for (const fam of tree.getAllFamilies()) {
    const hId = fam.husbandId;
    const wId = fam.wifeId;

    if (hId && wId && nodes.has(hId) && nodes.has(wId)) {
      edges.push({ type: 'couple', fromId: hId, toId: wId, familyId: fam.id });
    }

    // Only draw parent-child edges when a visible parent exists (avoids dangling lines)
    const visibleParentId = (hId && nodes.has(hId)) ? hId :
                            (wId && nodes.has(wId)) ? wId : undefined;
    if (visibleParentId) {
      for (const childId of fam.childIds) {
        if (nodes.has(childId)) {
          edges.push({ type: 'parent-child', fromId: visibleParentId, toId: childId, familyId: fam.id });
        }
      }
    }
  }

  // 7. Expand buttons: one per family that has children, where at least one parent is visible
  const expandButtons: LayoutResult['expandButtons'] = [];
  for (const fam of tree.getAllFamilies()) {
    if (fam.childIds.length === 0) continue;

    // Need at least one visible parent
    const hNode = fam.husbandId ? nodes.get(fam.husbandId) : undefined;
    const wNode = fam.wifeId ? nodes.get(fam.wifeId) : undefined;
    if (!hNode && !wNode) continue;

    // Ghost nodes shouldn't show expand buttons (no real parent)
    const hasRealHusb = hNode && !hNode.isGhost;
    const hasRealWife = wNode && !wNode.isGhost;
    if (!hasRealHusb && !hasRealWife) continue;

    const midX = coupleMidX.get(fam.id) ?? (hNode ?? wNode)!.x + nodeWidth / 2;
    const parentBottom = Math.max(
      hNode ? hNode.y + hNode.height : 0,
      wNode ? wNode.y + wNode.height : 0,
    );

    const isExpanded = expandedFamilies !== undefined && expandedFamilies.has(fam.id);

    expandButtons.push({
      famId: fam.id,
      childCount: fam.childIds.length,
      x: midX,
      parentBottomY: parentBottom,
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

  // Add extra height for expand buttons below collapsed families
  if (expandButtons.some(b => !b.expanded)) {
    maxY += 40; // button height clearance
  }

  return { nodes, edges, coupleMidX, expandButtons, totalWidth: maxX, totalHeight: maxY };
}

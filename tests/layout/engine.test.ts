import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseGedcom } from '../../src/gedcom/parser.js';
import { buildTree, Tree } from '../../src/model/Tree.js';
import { computeLayout } from '../../src/layout/engine.js';

const FIXTURES = join(__dirname, '../fixtures');

function loadTree(name: string) {
  return buildTree(parseGedcom(readFileSync(join(FIXTURES, name), 'utf-8')));
}

describe('computeLayout', () => {
  it('returns empty result for empty tree', () => {
    const tree = new Tree();
    const layout = computeLayout(tree);
    expect(layout.nodes.size).toBe(0);
    expect(layout.totalWidth).toBe(0);
    expect(layout.totalHeight).toBe(0);
  });

  it('parents appear above children (lower y)', () => {
    const tree = loadTree('simple.ged');
    const layout = computeLayout(tree);

    const john = layout.nodes.get('@I1@')!;
    const thomas = layout.nodes.get('@I3@')!;
    expect(john).toBeDefined();
    expect(thomas).toBeDefined();
    expect(john.y).toBeLessThan(thomas.y);
  });

  it('couple (husband and wife) share same y', () => {
    const tree = loadTree('simple.ged');
    const layout = computeLayout(tree);

    const john = layout.nodes.get('@I1@')!;
    const mary = layout.nodes.get('@I2@')!;
    expect(john.y).toBe(mary.y);
  });

  it('child is centered under parents (within a few px)', () => {
    const tree = loadTree('simple.ged');
    const layout = computeLayout(tree);

    const john = layout.nodes.get('@I1@')!;
    const mary = layout.nodes.get('@I2@')!;
    const thomas = layout.nodes.get('@I3@')!;

    const parentCenter = (john.x + john.width / 2 + mary.x + mary.width / 2) / 2;
    const childCenter = thomas.x + thomas.width / 2;
    expect(Math.abs(parentCenter - childCenter)).toBeLessThanOrEqual(1);
  });

  it('grandparent / parent / child have 3 distinct y values', () => {
    // Build a 3-generation tree
    const tree = new Tree();
    tree._setIndividual({ id: '@I1@', givenName: 'Grand', surname: 'A', sex: 'M', events: [], notes: [], familiesAsSpouse: ['@F1@'] });
    tree._setIndividual({ id: '@I2@', givenName: 'GrandW', surname: 'A', sex: 'F', events: [], notes: [], familiesAsSpouse: ['@F1@'] });
    tree._setIndividual({ id: '@I3@', givenName: 'Parent', surname: 'A', sex: 'M', events: [], notes: [], familiesAsSpouse: ['@F2@'], familyAsChild: '@F1@' });
    tree._setIndividual({ id: '@I4@', givenName: 'ParentW', surname: 'B', sex: 'F', events: [], notes: [], familiesAsSpouse: ['@F2@'] });
    tree._setIndividual({ id: '@I5@', givenName: 'Child', surname: 'A', sex: 'U', events: [], notes: [], familiesAsSpouse: [], familyAsChild: '@F2@' });
    tree._setFamily({ id: '@F1@', husbandId: '@I1@', wifeId: '@I2@', childIds: ['@I3@'] });
    tree._setFamily({ id: '@F2@', husbandId: '@I3@', wifeId: '@I4@', childIds: ['@I5@'] });

    const layout = computeLayout(tree);

    const grandY = layout.nodes.get('@I1@')!.y;
    const parentY = layout.nodes.get('@I3@')!.y;
    const childY = layout.nodes.get('@I5@')!.y;

    const yValues = new Set([grandY, parentY, childY]);
    expect(yValues.size).toBe(3);
    expect(grandY).toBeLessThan(parentY);
    expect(parentY).toBeLessThan(childY);
  });

  it('generates edges', () => {
    const tree = loadTree('simple.ged');
    const layout = computeLayout(tree);
    expect(layout.edges.length).toBeGreaterThan(0);
  });

  it('generates couple edges', () => {
    const tree = loadTree('simple.ged');
    const layout = computeLayout(tree);
    const coupleEdges = layout.edges.filter(e => e.type === 'couple');
    expect(coupleEdges).toHaveLength(1);
  });

  it('generates parent-child edges', () => {
    const tree = loadTree('simple.ged');
    const layout = computeLayout(tree);
    const pcEdges = layout.edges.filter(e => e.type === 'parent-child');
    expect(pcEdges).toHaveLength(1);
  });

  it('handles multi-family layout without errors', () => {
    const tree = loadTree('multi-family.ged');
    expect(() => computeLayout(tree)).not.toThrow();
    const layout = computeLayout(tree);
    expect(layout.nodes.size).toBeGreaterThanOrEqual(5);
  });
});

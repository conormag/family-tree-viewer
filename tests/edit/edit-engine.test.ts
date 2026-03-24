import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseGedcom } from '../../src/gedcom/parser.js';
import { buildTree } from '../../src/model/Tree.js';
import { EventBus } from '../../src/interaction/EventBus.js';
import { EditEngine } from '../../src/edit/EditEngine.js';

const FIXTURES = join(__dirname, '../fixtures');

function loadSetup(name: string) {
  const tree = buildTree(parseGedcom(readFileSync(join(FIXTURES, name), 'utf-8')));
  const bus = new EventBus();
  const engine = new EditEngine(tree, bus);
  return { tree, bus, engine };
}

describe('EditEngine', () => {
  describe('addIndividual', () => {
    it('increases individual count', () => {
      const { tree, engine } = loadSetup('simple.ged');
      const before = tree.getAllIndividuals().length;
      engine.addIndividual({
        givenName: 'New',
        surname: 'Person',
        sex: 'U',
        events: [],
        notes: [],
        familiesAsSpouse: [],
      });
      expect(tree.getAllIndividuals()).toHaveLength(before + 1);
    });

    it('emits tree:change event', () => {
      const { bus, engine } = loadSetup('simple.ged');
      const handler = vi.fn();
      bus.on('tree:change', handler);
      engine.addIndividual({
        givenName: 'New',
        surname: 'Person',
        sex: 'U',
        events: [],
        notes: [],
        familiesAsSpouse: [],
      });
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('updateIndividual', () => {
    it('updates name fields', () => {
      const { tree, engine } = loadSetup('simple.ged');
      engine.updateIndividual('@I1@', { givenName: 'Jonathan', surname: 'Smithson' });
      const ind = tree.getIndividual('@I1@')!;
      expect(ind.givenName).toBe('Jonathan');
      expect(ind.surname).toBe('Smithson');
    });

    it('emits tree:change', () => {
      const { bus, engine } = loadSetup('simple.ged');
      const handler = vi.fn();
      bus.on('tree:change', handler);
      engine.updateIndividual('@I1@', { givenName: 'Jonathan' });
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('removeIndividual', () => {
    it('removes individual', () => {
      const { tree, engine } = loadSetup('simple.ged');
      engine.removeIndividual('@I3@');
      expect(tree.getIndividual('@I3@')).toBeUndefined();
    });

    it('cascade: removes from family childIds', () => {
      const { tree, engine } = loadSetup('simple.ged');
      engine.removeIndividual('@I3@');
      expect(tree.getFamily('@F1@')?.childIds).not.toContain('@I3@');
    });

    it('emits tree:change', () => {
      const { bus, engine } = loadSetup('simple.ged');
      const handler = vi.fn();
      bus.on('tree:change', handler);
      engine.removeIndividual('@I3@');
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('addSpouse', () => {
    it('creates a new individual', () => {
      const { tree, engine } = loadSetup('simple.ged');
      const before = tree.getAllIndividuals().length;
      engine.addSpouse('@I3@', {
        givenName: 'Anne',
        surname: 'Brown',
        sex: 'F',
        events: [],
        notes: [],
      });
      expect(tree.getAllIndividuals()).toHaveLength(before + 1);
    });

    it('creates a FAM linking them', () => {
      const { tree, engine } = loadSetup('simple.ged');
      const before = tree.getAllFamilies().length;
      engine.addSpouse('@I3@', {
        givenName: 'Anne',
        surname: 'Brown',
        sex: 'F',
        events: [],
        notes: [],
      });
      expect(tree.getAllFamilies()).toHaveLength(before + 1);
    });

    it('links spouse in familiesAsSpouse', () => {
      const { tree, engine } = loadSetup('simple.ged');
      const spouse = engine.addSpouse('@I3@', {
        givenName: 'Anne',
        surname: 'Brown',
        sex: 'F',
        events: [],
        notes: [],
      });
      const thomas = tree.getIndividual('@I3@')!;
      expect(thomas.familiesAsSpouse.length).toBeGreaterThan(0);
      expect(tree.getSpouses('@I3@').map(s => s.id)).toContain(spouse.id);
    });
  });

  describe('addChild', () => {
    it('creates new individual', () => {
      const { tree, engine } = loadSetup('simple.ged');
      const before = tree.getAllIndividuals().length;
      engine.addChild('@F1@', {
        givenName: 'Baby',
        surname: 'Smith',
        sex: 'U',
        events: [],
        notes: [],
      });
      expect(tree.getAllIndividuals()).toHaveLength(before + 1);
    });

    it('adds child to family childIds', () => {
      const { tree, engine } = loadSetup('simple.ged');
      const child = engine.addChild('@F1@', {
        givenName: 'Baby',
        surname: 'Smith',
        sex: 'U',
        events: [],
        notes: [],
      });
      expect(tree.getFamily('@F1@')?.childIds).toContain(child.id);
    });

    it('sets familyAsChild on new child', () => {
      const { tree, engine } = loadSetup('simple.ged');
      const child = engine.addChild('@F1@', {
        givenName: 'Baby',
        surname: 'Smith',
        sex: 'U',
        events: [],
        notes: [],
      });
      expect(tree.getIndividual(child.id)?.familyAsChild).toBe('@F1@');
    });
  });
});

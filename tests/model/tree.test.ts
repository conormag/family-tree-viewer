import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseGedcom } from '../../src/gedcom/parser.js';
import { buildTree, Tree } from '../../src/model/Tree.js';

const FIXTURES = join(__dirname, '../fixtures');

function loadFixture(name: string) {
  return buildTree(parseGedcom(readFileSync(join(FIXTURES, name), 'utf-8')));
}

describe('Tree', () => {
  describe('buildTree', () => {
    it('loads 3 individuals from simple.ged', () => {
      const tree = loadFixture('simple.ged');
      expect(tree.getAllIndividuals()).toHaveLength(3);
    });

    it('parses name parts correctly', () => {
      const tree = loadFixture('simple.ged');
      const john = tree.getIndividual('@I1@')!;
      expect(john.givenName).toBe('John');
      expect(john.surname).toBe('Smith');
    });

    it('parses sex correctly', () => {
      const tree = loadFixture('simple.ged');
      expect(tree.getIndividual('@I1@')!.sex).toBe('M');
      expect(tree.getIndividual('@I2@')!.sex).toBe('F');
    });

    it('parses birth event', () => {
      const tree = loadFixture('simple.ged');
      const john = tree.getIndividual('@I1@')!;
      expect(john.birth?.date).toBe('1840');
      expect(john.birth?.year).toBe(1840);
      expect(john.birth?.place).toBe('County Clare, Ireland');
    });

    it('sets familyAsChild on child', () => {
      const tree = loadFixture('simple.ged');
      const thomas = tree.getIndividual('@I3@')!;
      expect(thomas.familyAsChild).toBe('@F1@');
    });

    it('sets familiesAsSpouse on husband and wife', () => {
      const tree = loadFixture('simple.ged');
      const john = tree.getIndividual('@I1@')!;
      const mary = tree.getIndividual('@I2@')!;
      expect(john.familiesAsSpouse).toContain('@F1@');
      expect(mary.familiesAsSpouse).toContain('@F1@');
    });
  });

  describe('getChildren', () => {
    it('returns children for a parent', () => {
      const tree = loadFixture('simple.ged');
      const children = tree.getChildren('@I1@');
      expect(children).toHaveLength(1);
      expect(children[0].id).toBe('@I3@');
    });

    it('returns empty array for childless individual', () => {
      const tree = loadFixture('simple.ged');
      expect(tree.getChildren('@I3@')).toHaveLength(0);
    });

    it('returns children from multiple families', () => {
      const tree = loadFixture('multi-family.ged');
      const children = tree.getChildren('@I1@');
      expect(children).toHaveLength(2);
    });
  });

  describe('getParents', () => {
    it('returns parents for a child', () => {
      const tree = loadFixture('simple.ged');
      const parents = tree.getParents('@I3@');
      expect(parents).toHaveLength(2);
      const ids = parents.map(p => p.id);
      expect(ids).toContain('@I1@');
      expect(ids).toContain('@I2@');
    });

    it('returns empty array for individual with no FAMC', () => {
      const tree = loadFixture('simple.ged');
      expect(tree.getParents('@I1@')).toHaveLength(0);
    });
  });

  describe('getSpouses', () => {
    it('returns spouse', () => {
      const tree = loadFixture('simple.ged');
      const spouses = tree.getSpouses('@I1@');
      expect(spouses).toHaveLength(1);
      expect(spouses[0].id).toBe('@I2@');
    });

    it('returns multiple spouses for multi-family individual', () => {
      const tree = loadFixture('multi-family.ged');
      const spouses = tree.getSpouses('@I1@');
      expect(spouses).toHaveLength(2);
    });
  });

  describe('addIndividual', () => {
    it('increases individual count', () => {
      const tree = loadFixture('simple.ged');
      const before = tree.getAllIndividuals().length;
      tree.addIndividual({
        givenName: 'New',
        surname: 'Person',
        sex: 'U',
        events: [],
        notes: [],
        familiesAsSpouse: [],
      });
      expect(tree.getAllIndividuals()).toHaveLength(before + 1);
    });

    it('assigns sequential ID', () => {
      const tree = loadFixture('simple.ged');
      const ind = tree.addIndividual({
        givenName: 'New',
        surname: 'Person',
        sex: 'U',
        events: [],
        notes: [],
        familiesAsSpouse: [],
      });
      expect(ind.id).toBe('@I4@');
    });
  });

  describe('removeIndividual', () => {
    it('removes individual from tree', () => {
      const tree = loadFixture('simple.ged');
      tree.removeIndividual('@I3@');
      expect(tree.getIndividual('@I3@')).toBeUndefined();
    });

    it('cascade: removes individual from family childIds', () => {
      const tree = loadFixture('simple.ged');
      tree.removeIndividual('@I3@');
      const fam = tree.getFamily('@F1@')!;
      expect(fam.childIds).not.toContain('@I3@');
    });

    it('cascade: removes empty family when spouse removed', () => {
      const tree = new Tree();
      tree._setIndividual({ id: '@I1@', givenName: 'A', surname: 'B', sex: 'M', events: [], notes: [], familiesAsSpouse: ['@F1@'] });
      tree._setIndividual({ id: '@I2@', givenName: 'C', surname: 'D', sex: 'F', events: [], notes: [], familiesAsSpouse: ['@F1@'] });
      tree._setFamily({ id: '@F1@', husbandId: '@I1@', wifeId: '@I2@', childIds: [] });
      tree.removeIndividual('@I1@');
      expect(tree.getFamily('@F1@')).toBeUndefined();
    });

    it('cascade: nulls spouse pointer when children exist', () => {
      const tree = new Tree();
      tree._setIndividual({ id: '@I1@', givenName: 'A', surname: 'B', sex: 'M', events: [], notes: [], familiesAsSpouse: ['@F1@'] });
      tree._setIndividual({ id: '@I2@', givenName: 'C', surname: 'D', sex: 'F', events: [], notes: [], familiesAsSpouse: ['@F1@'] });
      tree._setIndividual({ id: '@I3@', givenName: 'E', surname: 'F', sex: 'M', events: [], notes: [], familiesAsSpouse: [], familyAsChild: '@F1@' });
      tree._setFamily({ id: '@F1@', husbandId: '@I1@', wifeId: '@I2@', childIds: ['@I3@'] });
      tree.removeIndividual('@I1@');
      const fam = tree.getFamily('@F1@')!;
      expect(fam).toBeDefined();
      expect(fam.husbandId).toBeUndefined();
    });
  });
});

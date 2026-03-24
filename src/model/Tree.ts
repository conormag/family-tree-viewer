import type { Individual, Family, Sex } from './types.js';
import type { GedcomNode } from '../gedcom/types.js';
import { extractYear } from '../utils/date.js';

type ChangeHandler = () => void;

export class Tree {
  private individuals = new Map<string, Individual>();
  private families = new Map<string, Family>();
  private changeHandlers: ChangeHandler[] = [];

  on(_event: 'change', handler: ChangeHandler): void {
    this.changeHandlers.push(handler);
  }

  off(_event: 'change', handler: ChangeHandler): void {
    this.changeHandlers = this.changeHandlers.filter(h => h !== handler);
  }

  private emit(_event: 'change'): void {
    for (const h of this.changeHandlers) h();
  }

  getIndividual(id: string): Individual | undefined {
    return this.individuals.get(id);
  }

  getFamily(id: string): Family | undefined {
    return this.families.get(id);
  }

  getAllIndividuals(): Individual[] {
    return Array.from(this.individuals.values());
  }

  getAllFamilies(): Family[] {
    return Array.from(this.families.values());
  }

  getParents(id: string): Individual[] {
    const ind = this.individuals.get(id);
    if (!ind?.familyAsChild) return [];
    const fam = this.families.get(ind.familyAsChild);
    if (!fam) return [];
    const parents: Individual[] = [];
    if (fam.husbandId) {
      const h = this.individuals.get(fam.husbandId);
      if (h) parents.push(h);
    }
    if (fam.wifeId) {
      const w = this.individuals.get(fam.wifeId);
      if (w) parents.push(w);
    }
    return parents;
  }

  getChildren(id: string): Individual[] {
    const ind = this.individuals.get(id);
    if (!ind) return [];
    const children: Individual[] = [];
    for (const famId of ind.familiesAsSpouse) {
      const fam = this.families.get(famId);
      if (!fam) continue;
      for (const childId of fam.childIds) {
        const child = this.individuals.get(childId);
        if (child) children.push(child);
      }
    }
    return children;
  }

  getSpouses(id: string): Individual[] {
    const ind = this.individuals.get(id);
    if (!ind) return [];
    const spouses: Individual[] = [];
    for (const famId of ind.familiesAsSpouse) {
      const fam = this.families.get(famId);
      if (!fam) continue;
      const spouseId = fam.husbandId === id ? fam.wifeId : fam.husbandId;
      if (spouseId) {
        const spouse = this.individuals.get(spouseId);
        if (spouse) spouses.push(spouse);
      }
    }
    return spouses;
  }

  getSiblings(id: string): Individual[] {
    const ind = this.individuals.get(id);
    if (!ind?.familyAsChild) return [];
    const fam = this.families.get(ind.familyAsChild);
    if (!fam) return [];
    return fam.childIds
      .filter(cid => cid !== id)
      .map(cid => this.individuals.get(cid))
      .filter((i): i is Individual => i !== undefined);
  }

  private nextIndividualId(): string {
    let max = 0;
    for (const id of this.individuals.keys()) {
      const m = id.match(/@I(\d+)@/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `@I${max + 1}@`;
  }

  private nextFamilyId(): string {
    let max = 0;
    for (const id of this.families.keys()) {
      const m = id.match(/@F(\d+)@/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `@F${max + 1}@`;
  }

  _setIndividual(ind: Individual): void {
    this.individuals.set(ind.id, ind);
  }

  _setFamily(fam: Family): void {
    this.families.set(fam.id, fam);
  }

  addIndividual(data: Omit<Individual, 'id'>): Individual {
    const id = this.nextIndividualId();
    const ind: Individual = { ...data, id };
    this.individuals.set(id, ind);
    this.emit('change');
    return ind;
  }

  updateIndividual(id: string, data: Partial<Omit<Individual, 'id'>>): void {
    const ind = this.individuals.get(id);
    if (!ind) return;
    Object.assign(ind, data);
    this.emit('change');
  }

  removeIndividual(id: string): void {
    const ind = this.individuals.get(id);
    if (!ind) return;

    // Remove from families as spouse
    for (const famId of [...ind.familiesAsSpouse]) {
      const fam = this.families.get(famId);
      if (!fam) continue;
      if (fam.childIds.length > 0) {
        // Null pointer only
        if (fam.husbandId === id) fam.husbandId = undefined;
        if (fam.wifeId === id) fam.wifeId = undefined;
      } else {
        // Remove empty family
        this.families.delete(famId);
      }
    }

    // Remove from family as child
    if (ind.familyAsChild) {
      const fam = this.families.get(ind.familyAsChild);
      if (fam) {
        fam.childIds = fam.childIds.filter(cid => cid !== id);
      }
    }

    this.individuals.delete(id);
    this.emit('change');
  }

  addFamily(data: Omit<Family, 'id'>): Family {
    const id = this.nextFamilyId();
    const fam: Family = { ...data, id };
    this.families.set(id, fam);
    this.emit('change');
    return fam;
  }

  addChildToFamily(famId: string, childId: string): void {
    const fam = this.families.get(famId);
    const child = this.individuals.get(childId);
    if (!fam || !child) return;
    if (!fam.childIds.includes(childId)) {
      fam.childIds.push(childId);
    }
    child.familyAsChild = famId;
    this.emit('change');
  }
}

function getChildValue(node: GedcomNode, tag: string): string | undefined {
  return node.children.find(c => c.tag === tag)?.value;
}

function parseSex(value: string): Individual['sex'] {
  if (value === 'M') return 'M';
  if (value === 'F') return 'F';
  return 'U';
}

export function buildTree(nodes: GedcomNode[]): Tree {
  const tree = new Tree();

  // First pass: build individuals and families
  for (const node of nodes) {
    if (node.tag === 'INDI' && node.xref) {
      const nameNode = node.children.find(c => c.tag === 'NAME');
      const nameValue = nameNode?.value ?? '';
      const surnameMatch = nameValue.match(/\/([^/]*)\//);
      const surname = surnameMatch?.[1].trim() ?? '';
      const givenName = nameValue.replace(/\/[^/]*\//, '').trim();

      const sexNode = node.children.find(c => c.tag === 'SEX');
      const sex: Sex = sexNode ? parseSex(sexNode.value) : 'U';

      // Birth
      const birtNode = node.children.find(c => c.tag === 'BIRT');
      let birth: Individual['birth'];
      if (birtNode) {
        const date = getChildValue(birtNode, 'DATE');
        const place = getChildValue(birtNode, 'PLAC');
        birth = {
          type: 'BIRT',
          ...(date !== undefined ? { date } : {}),
          ...(date !== undefined ? { year: extractYear(date) } : {}),
          ...(place !== undefined ? { place } : {}),
        };
      }

      // Death
      const deatNode = node.children.find(c => c.tag === 'DEAT');
      let death: Individual['death'];
      if (deatNode) {
        const date = getChildValue(deatNode, 'DATE');
        const place = getChildValue(deatNode, 'PLAC');
        death = {
          type: 'DEAT',
          ...(date !== undefined ? { date } : {}),
          ...(date !== undefined ? { year: extractYear(date) } : {}),
          ...(place !== undefined ? { place } : {}),
        };
      }

      // Notes
      const notes = node.children
        .filter(c => c.tag === 'NOTE')
        .map(c => c.value);

      // FAMS and FAMC — will be set in second pass via FAM records
      // But also read them from INDI record for cross-linking
      const familiesAsSpouse = node.children
        .filter(c => c.tag === 'FAMS')
        .map(c => c.value);
      const famcNode = node.children.find(c => c.tag === 'FAMC');

      const ind: Individual = {
        id: node.xref,
        givenName,
        surname,
        sex,
        events: [],
        notes,
        familiesAsSpouse,
        ...(birth !== undefined ? { birth } : {}),
        ...(death !== undefined ? { death } : {}),
        ...(famcNode !== undefined ? { familyAsChild: famcNode.value } : {}),
      };

      tree._setIndividual(ind);
    }

    if (node.tag === 'FAM' && node.xref) {
      const husbNode = node.children.find(c => c.tag === 'HUSB');
      const wifeNode = node.children.find(c => c.tag === 'WIFE');
      const childIds = node.children
        .filter(c => c.tag === 'CHIL')
        .map(c => c.value);

      const marrNode = node.children.find(c => c.tag === 'MARR');
      let marriage: Family['marriage'];
      if (marrNode) {
        const date = getChildValue(marrNode, 'DATE');
        const place = getChildValue(marrNode, 'PLAC');
        marriage = {
          type: 'MARR',
          ...(date !== undefined ? { date } : {}),
          ...(date !== undefined ? { year: extractYear(date) } : {}),
          ...(place !== undefined ? { place } : {}),
        };
      }

      const fam: Family = {
        id: node.xref,
        childIds,
        ...(husbNode !== undefined ? { husbandId: husbNode.value } : {}),
        ...(wifeNode !== undefined ? { wifeId: wifeNode.value } : {}),
        ...(marriage !== undefined ? { marriage } : {}),
      };

      tree._setFamily(fam);
    }
  }

  // Second pass: cross-link individuals from FAM records
  for (const fam of tree.getAllFamilies()) {
    // Set familyAsChild on children
    for (const childId of fam.childIds) {
      const child = tree.getIndividual(childId);
      if (child && !child.familyAsChild) {
        child.familyAsChild = fam.id;
      }
    }

    // Ensure familiesAsSpouse is set on husband and wife
    if (fam.husbandId) {
      const husb = tree.getIndividual(fam.husbandId);
      if (husb && !husb.familiesAsSpouse.includes(fam.id)) {
        husb.familiesAsSpouse.push(fam.id);
      }
    }
    if (fam.wifeId) {
      const wife = tree.getIndividual(fam.wifeId);
      if (wife && !wife.familiesAsSpouse.includes(fam.id)) {
        wife.familiesAsSpouse.push(fam.id);
      }
    }
  }

  return tree;
}

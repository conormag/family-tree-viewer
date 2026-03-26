import type { Tree } from '../model/Tree.js';
import type { Individual, Family } from '../model/types.js';
import type { EventBus } from '../interaction/EventBus.js';

export class EditEngine {
  constructor(private tree: Tree, private bus: EventBus) {}

  updateIndividual(id: string, data: Partial<Omit<Individual, 'id'>>): void {
    this.tree.updateIndividual(id, data);
    this.bus.emit('tree:change', { tree: this.tree });
  }

  updateFamily(id: string, data: Partial<Pick<Family, 'marriage'>>): void {
    this.tree.updateFamily(id, data);
    this.bus.emit('tree:change', { tree: this.tree });
  }

  addIndividual(data: Omit<Individual, 'id'>): Individual {
    const ind = this.tree.addIndividual(data);
    this.bus.emit('tree:change', { tree: this.tree });
    return ind;
  }

  removeIndividual(id: string): void {
    this.tree.removeIndividual(id);
    this.bus.emit('tree:change', { tree: this.tree });
  }

  addSpouse(individualId: string, spouseData: Omit<Individual, 'id' | 'familiesAsSpouse' | 'familyAsChild'>): Individual {
    const ind = this.tree.getIndividual(individualId);
    if (!ind) throw new Error(`Individual ${individualId} not found`);

    const spouse = this.tree.addIndividual({
      ...spouseData,
      familiesAsSpouse: [],
    });

    // Create family linking them
    const husbandId = ind.sex === 'F' ? spouse.id : individualId;
    const wifeId = ind.sex === 'F' ? individualId : spouse.id;

    const fam = this.tree.addFamily({
      husbandId,
      wifeId,
      childIds: [],
    });

    // Update familiesAsSpouse on both
    this.tree.updateIndividual(individualId, {
      familiesAsSpouse: [...ind.familiesAsSpouse, fam.id],
    });
    this.tree.updateIndividual(spouse.id, {
      familiesAsSpouse: [fam.id],
    });

    this.bus.emit('tree:change', { tree: this.tree });
    return spouse;
  }

  addChild(familyId: string, childData: Omit<Individual, 'id' | 'familiesAsSpouse' | 'familyAsChild'>): Individual {
    const child = this.tree.addIndividual({
      ...childData,
      familiesAsSpouse: [],
    });

    this.tree.addChildToFamily(familyId, child.id);
    this.bus.emit('tree:change', { tree: this.tree });
    return child;
  }
}

import type { Individual } from '../model/types.js';
import type { Tree } from '../model/Tree.js';
import type { EditEngine } from '../edit/EditEngine.js';
import { extractYear } from '../utils/date.js';

type PanelState = 'closed' | 'viewing' | 'editing';

export class SidePanel {
  private el: HTMLDivElement;
  private state: PanelState = 'closed';
  private currentId: string | null = null;

  constructor(
    container: HTMLElement,
    private tree: Tree,
    private editEngine: EditEngine,
    private readonly: boolean,
    private onAddChild: (parentId: string) => void,
    private onAddSpouse: (individualId: string) => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'ftv-panel';
    container.appendChild(this.el);
  }

  open(id: string): void {
    this.currentId = id;
    this.state = 'viewing';
    this.renderView();
    this.el.classList.add('ftv-panel--open');
  }

  close(): void {
    this.state = 'closed';
    this.currentId = null;
    this.el.classList.remove('ftv-panel--open');
    this.el.innerHTML = '';
  }

  refresh(): void {
    if (this.state === 'closed' || !this.currentId) return;
    if (this.state === 'viewing') this.renderView();
  }

  private renderView(): void {
    const id = this.currentId;
    if (!id) return;
    const ind = this.tree.getIndividual(id);
    if (!ind) {
      this.close();
      return;
    }

    const fullName = [ind.givenName, ind.surname].filter(Boolean).join(' ') || 'Unknown';
    const spouses = this.tree.getSpouses(id);
    const children = this.tree.getChildren(id);

    this.el.innerHTML = `
      <div class="ftv-panel__header">
        <h2 class="ftv-panel__name">${escHtml(fullName)}</h2>
        <button class="ftv-panel__close" aria-label="Close">&times;</button>
      </div>
      <div class="ftv-panel__body">
        <div class="ftv-panel__section">
          <p class="ftv-panel__section-title">Vital Records</p>
          <dl class="ftv-panel__dl">
            <dt class="ftv-panel__dt">Born</dt>
            <dd class="ftv-panel__dd">${escHtml(formatEvent(ind.birth))}</dd>
            <dt class="ftv-panel__dt">Died</dt>
            <dd class="ftv-panel__dd">${escHtml(formatEvent(ind.death))}</dd>
            <dt class="ftv-panel__dt">Sex</dt>
            <dd class="ftv-panel__dd">${escHtml(formatSex(ind.sex))}</dd>
          </dl>
        </div>
        ${spouses.length > 0 ? `
        <div class="ftv-panel__section">
          <p class="ftv-panel__section-title">Marriages</p>
          ${spouses.map(s => {
            const sName = [s.givenName, s.surname].filter(Boolean).join(' ') || 'Unknown';
            return `<div style="font-size:13px;margin-bottom:4px;">${escHtml(sName)}</div>`;
          }).join('')}
        </div>` : ''}
        ${children.length > 0 ? `
        <div class="ftv-panel__section">
          <p class="ftv-panel__section-title">Children</p>
          ${children.map(c => {
            const cName = [c.givenName, c.surname].filter(Boolean).join(' ') || 'Unknown';
            return `<div style="font-size:13px;margin-bottom:4px;">${escHtml(cName)}</div>`;
          }).join('')}
        </div>` : ''}
        ${ind.notes.length > 0 ? `
        <div class="ftv-panel__section">
          <p class="ftv-panel__section-title">Notes</p>
          ${ind.notes.map(n => `<p style="font-size:13px;margin:0 0 4px;">${escHtml(n)}</p>`).join('')}
        </div>` : ''}
        ${!this.readonly ? `
        <div class="ftv-panel__actions">
          <button class="ftv-btn ftv-btn--primary" data-action="edit">Edit</button>
          <button class="ftv-btn" data-action="add-child">Add Child</button>
          <button class="ftv-btn" data-action="add-spouse">Add Spouse</button>
          <button class="ftv-btn ftv-btn--danger" data-action="remove">Remove</button>
        </div>` : ''}
      </div>
    `;

    this.el.querySelector('.ftv-panel__close')?.addEventListener('click', () => this.close());

    if (!this.readonly) {
      this.el.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
        this.state = 'editing';
        this.renderEdit();
      });
      this.el.querySelector('[data-action="add-child"]')?.addEventListener('click', () => {
        if (id) this.onAddChild(id);
      });
      this.el.querySelector('[data-action="add-spouse"]')?.addEventListener('click', () => {
        if (id) this.onAddSpouse(id);
      });
      this.el.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
        if (id) {
          this.editEngine.removeIndividual(id);
          this.close();
        }
      });
    }
  }

  private renderEdit(): void {
    const id = this.currentId;
    if (!id) return;
    const ind = this.tree.getIndividual(id);
    if (!ind) return;

    this.el.innerHTML = `
      <div class="ftv-panel__header">
        <h2 class="ftv-panel__name">Edit Person</h2>
        <button class="ftv-panel__close" aria-label="Close">&times;</button>
      </div>
      <div class="ftv-panel__body">
        <form class="ftv-form" id="ftv-edit-form">
          <div class="ftv-form__row">
            <label class="ftv-form__label" for="ftv-given">Given Name</label>
            <input class="ftv-form__input" id="ftv-given" name="givenName" type="text" value="${escAttr(ind.givenName)}">
          </div>
          <div class="ftv-form__row">
            <label class="ftv-form__label" for="ftv-surname">Surname</label>
            <input class="ftv-form__input" id="ftv-surname" name="surname" type="text" value="${escAttr(ind.surname)}">
          </div>
          <div class="ftv-form__row">
            <label class="ftv-form__label" for="ftv-sex">Sex</label>
            <select class="ftv-form__select" id="ftv-sex" name="sex">
              <option value="M"${ind.sex === 'M' ? ' selected' : ''}>Male</option>
              <option value="F"${ind.sex === 'F' ? ' selected' : ''}>Female</option>
              <option value="U"${ind.sex === 'U' ? ' selected' : ''}>Unknown</option>
            </select>
          </div>
          <div class="ftv-form__row">
            <label class="ftv-form__label" for="ftv-bdate">Birth Date (GEDCOM format)</label>
            <input class="ftv-form__input" id="ftv-bdate" name="birthDate" type="text" value="${escAttr(ind.birth?.date ?? '')}">
          </div>
          <div class="ftv-form__row">
            <label class="ftv-form__label" for="ftv-bplace">Birth Place</label>
            <input class="ftv-form__input" id="ftv-bplace" name="birthPlace" type="text" value="${escAttr(ind.birth?.place ?? '')}">
          </div>
          <div class="ftv-form__row">
            <label class="ftv-form__label" for="ftv-ddate">Death Date (GEDCOM format)</label>
            <input class="ftv-form__input" id="ftv-ddate" name="deathDate" type="text" value="${escAttr(ind.death?.date ?? '')}">
          </div>
          <div class="ftv-form__row">
            <label class="ftv-form__label" for="ftv-dplace">Death Place</label>
            <input class="ftv-form__input" id="ftv-dplace" name="deathPlace" type="text" value="${escAttr(ind.death?.place ?? '')}">
          </div>
          <div class="ftv-form__row">
            <label class="ftv-form__label" for="ftv-notes">Notes</label>
            <textarea class="ftv-form__textarea" id="ftv-notes" name="notes">${escHtml(ind.notes.join('\n'))}</textarea>
          </div>
          <div class="ftv-form__actions">
            <button type="button" class="ftv-btn" id="ftv-cancel">Cancel</button>
            <button type="submit" class="ftv-btn ftv-btn--primary">Save</button>
          </div>
        </form>
      </div>
    `;

    this.el.querySelector('.ftv-panel__close')?.addEventListener('click', () => this.close());
    this.el.querySelector('#ftv-cancel')?.addEventListener('click', () => {
      this.state = 'viewing';
      this.renderView();
    });

    this.el.querySelector('#ftv-edit-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);

      const givenName = String(formData.get('givenName') ?? '').trim();
      const surname = String(formData.get('surname') ?? '').trim();
      const sex = String(formData.get('sex') ?? 'U') as Individual['sex'];
      const birthDate = String(formData.get('birthDate') ?? '').trim();
      const birthPlace = String(formData.get('birthPlace') ?? '').trim();
      const deathDate = String(formData.get('deathDate') ?? '').trim();
      const deathPlace = String(formData.get('deathPlace') ?? '').trim();
      const notesRaw = String(formData.get('notes') ?? '').trim();
      const notes = notesRaw ? notesRaw.split('\n').filter(Boolean) : [];

      const birth: Individual['birth'] = (birthDate || birthPlace) ? {
        type: 'BIRT',
        ...(birthDate ? { date: birthDate, year: extractYear(birthDate) } : {}),
        ...(birthPlace ? { place: birthPlace } : {}),
      } : undefined;

      const death: Individual['death'] = (deathDate || deathPlace) ? {
        type: 'DEAT',
        ...(deathDate ? { date: deathDate, year: extractYear(deathDate) } : {}),
        ...(deathPlace ? { place: deathPlace } : {}),
      } : undefined;

      this.editEngine.updateIndividual(id, {
        givenName,
        surname,
        sex,
        notes,
        birth,
        death,
      });

      this.state = 'viewing';
      this.renderView();
    });
  }

  destroy(): void {
    this.el.remove();
  }
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(s: string): string {
  return escHtml(s);
}

function formatEvent(ev: { date?: string; place?: string } | undefined): string {
  if (!ev) return '—';
  const parts = [ev.date, ev.place].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function formatSex(sex: string): string {
  return sex === 'M' ? 'Male' : sex === 'F' ? 'Female' : 'Unknown';
}

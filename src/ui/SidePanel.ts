import type { Individual, EventRecord } from '../model/types.js';
import type { Tree } from '../model/Tree.js';
import type { EditEngine } from '../edit/EditEngine.js';
import { extractYear } from '../utils/date.js';

type PanelState = 'closed' | 'viewing' | 'editing';

const EVENT_LABELS: Record<string, string> = {
  ADOP: 'Adoption',   BAPM: 'Baptism',       BARM: 'Bar Mitzvah',
  BASM: 'Bas Mitzvah', BLES: 'Blessing',     BURI: 'Burial',
  CENS: 'Census',     CHR: 'Christening',    CHRA: 'Adult Christening',
  CONF: 'Confirmation', CREM: 'Cremation',   EMIG: 'Emigration',
  EVEN: 'Event',      FCOM: 'First Communion', GRAD: 'Graduation',
  IMMI: 'Immigration', NATU: 'Naturalization', OCCU: 'Occupation',
  ORDN: 'Ordination', PROB: 'Probate',       RELI: 'Religion',
  RESI: 'Residence',  RETI: 'Retirement',    TITL: 'Title',
  WILL: 'Will',
};

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
    if (!ind) { this.close(); return; }

    const fullName = [ind.givenName, ind.surname].filter(Boolean).join(' ') || 'Unknown';
    const parents = this.tree.getParents(id);
    const children = this.tree.getChildren(id);

    // Build marriages with family records
    const marriages = ind.familiesAsSpouse.map(famId => {
      const fam = this.tree.getFamily(famId);
      if (!fam) return null;
      const spouseId = fam.husbandId === id ? fam.wifeId : fam.husbandId;
      const spouse = spouseId ? this.tree.getIndividual(spouseId) : undefined;
      return { famId, fam, spouse };
    }).filter((m): m is NonNullable<typeof m> => m !== null);

    this.el.innerHTML = `
      <div class="ftv-panel__header">
        <div class="ftv-panel__header-main">
          ${ind.photoUrl ? `<img class="ftv-panel__photo" src="${escAttr(ind.photoUrl)}" alt="">` : ''}
          <h2 class="ftv-panel__name">${escHtml(fullName)}</h2>
        </div>
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
        ${parents.length > 0 ? `
        <div class="ftv-panel__section">
          <p class="ftv-panel__section-title">Parents</p>
          ${parents.map(p => {
            const pName = [p.givenName, p.surname].filter(Boolean).join(' ') || 'Unknown';
            return `<div class="ftv-panel__person-link">${escHtml(pName)}</div>`;
          }).join('')}
        </div>` : ''}
        ${ind.events.length > 0 ? `
        <div class="ftv-panel__section">
          <p class="ftv-panel__section-title">Life Events</p>
          <dl class="ftv-panel__dl">
            ${ind.events.map(ev => `
              <dt class="ftv-panel__dt">${escHtml(EVENT_LABELS[ev.type] ?? ev.type)}</dt>
              <dd class="ftv-panel__dd">${escHtml(formatEvent(ev))}</dd>
            `).join('')}
          </dl>
        </div>` : ''}
        ${marriages.length > 0 ? `
        <div class="ftv-panel__section">
          <p class="ftv-panel__section-title">Marriages</p>
          ${marriages.map(({ fam, spouse }) => {
            const sName = spouse
              ? [spouse.givenName, spouse.surname].filter(Boolean).join(' ') || 'Unknown'
              : 'Unknown';
            const marriageDetail = fam.marriage ? formatEvent(fam.marriage) : '';
            return `
              <div class="ftv-panel__person-link">${escHtml(sName)}</div>
              ${marriageDetail ? `<div class="ftv-panel__sub-detail">${escHtml(marriageDetail)}</div>` : ''}
            `;
          }).join('')}
        </div>` : ''}
        ${children.length > 0 ? `
        <div class="ftv-panel__section">
          <p class="ftv-panel__section-title">Children</p>
          ${children.map(c => {
            const cName = [c.givenName, c.surname].filter(Boolean).join(' ') || 'Unknown';
            return `<div class="ftv-panel__person-link">${escHtml(cName)}</div>`;
          }).join('')}
        </div>` : ''}
        ${ind.notes.length > 0 ? `
        <div class="ftv-panel__section">
          <p class="ftv-panel__section-title">Notes</p>
          ${ind.notes.map(n => `<p class="ftv-panel__note">${escHtml(n)}</p>`).join('')}
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

    // Build marriages list
    const marriages = ind.familiesAsSpouse.map(famId => {
      const fam = this.tree.getFamily(famId);
      if (!fam) return null;
      const spouseId = fam.husbandId === id ? fam.wifeId : fam.husbandId;
      const spouse = spouseId ? this.tree.getIndividual(spouseId) : undefined;
      return { famId, fam, spouse };
    }).filter((m): m is NonNullable<typeof m> => m !== null);

    this.el.innerHTML = `
      <div class="ftv-panel__header">
        <div class="ftv-panel__header-main">
          <h2 class="ftv-panel__name">Edit Person</h2>
        </div>
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
            <label class="ftv-form__label" for="ftv-photo">Photo URL</label>
            <input class="ftv-form__input" id="ftv-photo" name="photoUrl" type="text" placeholder="https://…" value="${escAttr(ind.photoUrl ?? '')}">
          </div>
          <div class="ftv-form__section-header">Birth &amp; Death</div>
          <div class="ftv-form__row">
            <label class="ftv-form__label" for="ftv-bdate">Birth date</label>
            <input class="ftv-form__input" id="ftv-bdate" name="birthDate" type="text" placeholder="e.g. 1 JAN 1850 or ABT 1850" value="${escAttr(ind.birth?.date ?? '')}">
          </div>
          <div class="ftv-form__row">
            <label class="ftv-form__label" for="ftv-bplace">Birth place</label>
            <input class="ftv-form__input" id="ftv-bplace" name="birthPlace" type="text" value="${escAttr(ind.birth?.place ?? '')}">
          </div>
          <div class="ftv-form__row">
            <label class="ftv-form__label" for="ftv-ddate">Death date</label>
            <input class="ftv-form__input" id="ftv-ddate" name="deathDate" type="text" placeholder="e.g. 15 MAR 1920 or BEF 1930" value="${escAttr(ind.death?.date ?? '')}">
          </div>
          <div class="ftv-form__row">
            <label class="ftv-form__label" for="ftv-dplace">Death place</label>
            <input class="ftv-form__input" id="ftv-dplace" name="deathPlace" type="text" value="${escAttr(ind.death?.place ?? '')}">
          </div>
          <div class="ftv-form__section-header">Life Events</div>
          <div id="ftv-events-container"></div>
          <button type="button" class="ftv-btn" id="ftv-add-event">+ Add Event</button>
          ${marriages.length > 0 ? `
          <div class="ftv-form__section-header">Marriages</div>
          ${marriages.map(({ famId, fam, spouse }) => {
            const sName = spouse
              ? [spouse.givenName, spouse.surname].filter(Boolean).join(' ') || 'Unknown'
              : 'Unknown';
            return `
            <div class="ftv-form__subsection" data-fam-id="${escAttr(famId)}">
              <div class="ftv-form__subsection-title">${escHtml(sName)}</div>
              <div class="ftv-form__row">
                <label class="ftv-form__label">Marriage date</label>
                <input class="ftv-form__input ftv-marr-date" type="text" placeholder="e.g. 15 JUN 1880" value="${escAttr(fam.marriage?.date ?? '')}">
              </div>
              <div class="ftv-form__row">
                <label class="ftv-form__label">Marriage place</label>
                <input class="ftv-form__input ftv-marr-place" type="text" value="${escAttr(fam.marriage?.place ?? '')}">
              </div>
            </div>`;
          }).join('')}` : ''}
          <div class="ftv-form__section-header">Notes</div>
          <div class="ftv-form__row">
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

    // Render initial event rows
    const eventsContainer = this.el.querySelector('#ftv-events-container') as HTMLElement;
    renderEventRows(eventsContainer, [...ind.events]);

    // Add event button
    this.el.querySelector('#ftv-add-event')?.addEventListener('click', () => {
      const current = collectEventsFromContainer(eventsContainer);
      current.push({ type: 'EVEN' });
      renderEventRows(eventsContainer, current);
    });

    // Form submit
    this.el.querySelector('#ftv-edit-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);

      const givenName = String(formData.get('givenName') ?? '').trim();
      const surname = String(formData.get('surname') ?? '').trim();
      const sex = String(formData.get('sex') ?? 'U') as Individual['sex'];
      const photoUrl = String(formData.get('photoUrl') ?? '').trim() || undefined;
      const birthDate = String(formData.get('birthDate') ?? '').trim();
      const birthPlace = String(formData.get('birthPlace') ?? '').trim();
      const deathDate = String(formData.get('deathDate') ?? '').trim();
      const deathPlace = String(formData.get('deathPlace') ?? '').trim();
      const notesRaw = String(formData.get('notes') ?? '').trim();
      const notes = notesRaw ? notesRaw.split('\n').filter(Boolean) : [];
      const events = collectEventsFromContainer(eventsContainer);

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
        givenName, surname, sex, notes, birth, death, events, photoUrl,
      });

      // Save marriage edits per family
      form.querySelectorAll('[data-fam-id]').forEach(sub => {
        const famId = (sub as HTMLElement).dataset.famId!;
        const marrDate = (sub.querySelector('.ftv-marr-date') as HTMLInputElement).value.trim();
        const marrPlace = (sub.querySelector('.ftv-marr-place') as HTMLInputElement).value.trim();
        const marriage: Individual['birth'] = (marrDate || marrPlace) ? {
          type: 'MARR',
          ...(marrDate ? { date: marrDate, year: extractYear(marrDate) } : {}),
          ...(marrPlace ? { place: marrPlace } : {}),
        } : undefined;
        this.editEngine.updateFamily(famId, { marriage });
      });

      this.state = 'viewing';
      this.renderView();
    });
  }

  destroy(): void {
    this.el.remove();
  }
}

// ---------------------------------------------------------------------------
// Event row helpers (module-level so they can be called recursively)
// ---------------------------------------------------------------------------

function renderEventRows(container: HTMLElement, events: EventRecord[]): void {
  container.innerHTML = events.map((ev, i) => `
    <div class="ftv-event-row" data-idx="${i}">
      <div class="ftv-event-row__top">
        <select class="ftv-form__select ftv-event-type">
          ${Object.entries(EVENT_LABELS).map(([k, v]) =>
            `<option value="${k}"${ev.type === k ? ' selected' : ''}>${escHtml(v)}</option>`
          ).join('')}
        </select>
        <button type="button" class="ftv-btn ftv-btn--danger ftv-event-remove">&times;</button>
      </div>
      <div class="ftv-event-row__bottom">
        <input class="ftv-form__input ftv-event-date" type="text" placeholder="Date" value="${escAttr(ev.date ?? '')}">
        <input class="ftv-form__input ftv-event-place" type="text" placeholder="Place" value="${escAttr(ev.place ?? '')}">
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.ftv-event-remove').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const current = collectEventsFromContainer(container);
      current.splice(i, 1);
      renderEventRows(container, current);
    });
  });
}

function collectEventsFromContainer(container: HTMLElement): EventRecord[] {
  return Array.from(container.querySelectorAll('.ftv-event-row')).map(row => {
    const type = (row.querySelector('.ftv-event-type') as HTMLSelectElement).value;
    const date = (row.querySelector('.ftv-event-date') as HTMLInputElement).value.trim();
    const place = (row.querySelector('.ftv-event-place') as HTMLInputElement).value.trim();
    return {
      type,
      ...(date ? { date, year: extractYear(date) } : {}),
      ...(place ? { place } : {}),
    } as EventRecord;
  });
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

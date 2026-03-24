import type { LayoutNode } from '../layout/types.js';
import type { Individual } from '../model/types.js';

const NS = 'http://www.w3.org/2000/svg';

const GENDER_COLORS: Record<string, string> = {
  M: '#3b82f6',
  F: '#ec4899',
  U: '#94a3b8',
};

// Circle is at cx=(width-26)=154, r=22 → left edge at x=132.
// Text clip ends at x=124 (8px gap before the circle).
const TEXT_CLIP_X = 8;        // start (just after gender bar)
const TEXT_CLIP_RIGHT = 124;  // end (8px gap before circle left edge at 132)
const TEXT_CLIP_WIDTH = TEXT_CLIP_RIGHT - TEXT_CLIP_X; // 116

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(NS, tag);
}

/** Sanitize an xref like "@I1@" to a valid XML id fragment "I1" */
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function createNodeCard(
  layoutNode: LayoutNode,
  individual: Individual | null,
  bus: { emit: (event: 'node:click', payload: { id: string }) => void; on: (event: 'node:hover', handler: (p: { id: string | null }) => void) => void },
): SVGGElement {
  const g = svgEl('g');
  g.setAttribute('class', 'ftv-node');
  g.setAttribute('data-id', layoutNode.id);
  g.setAttribute('transform', `translate(${layoutNode.x},${layoutNode.y})`);
  g.style.cursor = 'pointer';

  const { width, height } = layoutNode;

  // Clip path keeps name/dates text from bleeding under the avatar circle.
  // Defined inside this card's <g> so coords are in card-local space.
  const clipId = `ftv-clip-${sanitizeId(layoutNode.id)}`;
  const defs = svgEl('defs');
  const clipPath = svgEl('clipPath');
  clipPath.id = clipId;
  const clipRect = svgEl('rect');
  clipRect.setAttribute('x', String(TEXT_CLIP_X));
  clipRect.setAttribute('y', '0');
  clipRect.setAttribute('width', String(TEXT_CLIP_WIDTH));
  clipRect.setAttribute('height', String(height));
  clipPath.appendChild(clipRect);
  defs.appendChild(clipPath);
  g.appendChild(defs);

  // Background rect
  const rect = svgEl('rect');
  rect.setAttribute('class', 'ftv-node__bg');
  rect.setAttribute('width', String(width));
  rect.setAttribute('height', String(height));
  rect.setAttribute('rx', '8');
  rect.setAttribute('fill', layoutNode.isGhost ? '#f8fafc' : 'white');
  rect.setAttribute('stroke', layoutNode.isGhost ? '#cbd5e1' : '#e2e8f0');
  rect.setAttribute('stroke-width', '1.5');
  if (layoutNode.isGhost) {
    rect.setAttribute('stroke-dasharray', '6 3');
  }
  g.appendChild(rect);

  if (layoutNode.isGhost || !individual) {
    const unknownText = svgEl('text');
    unknownText.setAttribute('x', String(width / 2));
    unknownText.setAttribute('y', String(height / 2 + 5));
    unknownText.setAttribute('text-anchor', 'middle');
    unknownText.setAttribute('font-size', '13');
    unknownText.setAttribute('fill', '#94a3b8');
    unknownText.textContent = 'Unknown';
    g.appendChild(unknownText);
    return g;
  }

  // Gender color bar
  const genderColor = GENDER_COLORS[individual.sex] ?? GENDER_COLORS['U'];
  const genderBar = svgEl('rect');
  genderBar.setAttribute('class', 'ftv-node__gender-bar');
  genderBar.setAttribute('width', '6');
  genderBar.setAttribute('height', String(height));
  genderBar.setAttribute('rx', '4');
  genderBar.setAttribute('fill', genderColor);
  g.appendChild(genderBar);

  // Name — clipped so it can't bleed under the avatar circle
  const fullName = [individual.givenName, individual.surname].filter(Boolean).join(' ');
  const displayName = fullName || 'Unknown';

  const nameText = svgEl('text');
  nameText.setAttribute('class', 'ftv-node__name');
  nameText.setAttribute('x', '18');
  nameText.setAttribute('y', '32');
  nameText.setAttribute('font-weight', '700');
  nameText.setAttribute('font-size', '14');
  nameText.setAttribute('fill', '#1e293b');
  nameText.setAttribute('clip-path', `url(#${clipId})`);
  nameText.textContent = displayName;

  // Tooltip shows full name when text is clipped
  const title = svgEl('title');
  title.textContent = displayName;
  nameText.appendChild(title);

  g.appendChild(nameText);

  // Dates — also clipped for the same reason
  const birthYear = individual.birth?.year;
  const deathYear = individual.death?.year;
  let datesStr = '';
  if (birthYear) datesStr += `b.${birthYear}`;
  if (deathYear) datesStr += (datesStr ? ' · ' : '') + `d.${deathYear}`;

  if (datesStr) {
    const datesText = svgEl('text');
    datesText.setAttribute('class', 'ftv-node__dates');
    datesText.setAttribute('x', '18');
    datesText.setAttribute('y', '52');
    datesText.setAttribute('font-size', '12');
    datesText.setAttribute('fill', '#64748b');
    datesText.setAttribute('clip-path', `url(#${clipId})`);
    datesText.textContent = datesStr;
    g.appendChild(datesText);
  }

  // Avatar circle
  const photo = svgEl('circle');
  photo.setAttribute('class', 'ftv-node__photo');
  photo.setAttribute('cx', String(width - 26));
  photo.setAttribute('cy', String(height / 2));
  photo.setAttribute('r', '22');
  photo.setAttribute('fill', '#f1f5f9');
  photo.setAttribute('stroke', '#cbd5e1');
  photo.setAttribute('stroke-width', '1');
  g.appendChild(photo);

  // Gender initial in circle
  const initial = svgEl('text');
  initial.setAttribute('x', String(width - 26));
  initial.setAttribute('y', String(height / 2 + 5));
  initial.setAttribute('text-anchor', 'middle');
  initial.setAttribute('font-size', '16');
  initial.setAttribute('fill', genderColor);
  initial.textContent = individual.sex === 'U' ? '?' : individual.sex;
  g.appendChild(initial);

  // Click handler
  g.addEventListener('click', (e) => {
    e.stopPropagation();
    bus.emit('node:click', { id: layoutNode.id });
  });

  return g;
}

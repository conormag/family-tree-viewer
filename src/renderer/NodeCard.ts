import type { LayoutNode } from '../layout/types.js';
import type { Individual } from '../model/types.js';

const NS = 'http://www.w3.org/2000/svg';

// Material-style gender palette — darker shade for header band, lighter for body
const GENDER_HEADER: Record<string, string> = {
  M: '#1565C0',
  F: '#AD1457',
  U: '#37474F',
};

const GENDER_BODY: Record<string, string> = {
  M: '#1976D2',
  F: '#C2185B',
  U: '#455A64',
};

const AVATAR_RING: Record<string, string> = {
  M: '#90CAF9',
  F: '#F48FB1',
  U: '#90A4AE',
};

const HEADER_HEIGHT = 56;
const AVATAR_R = 24;

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

  // Ghost / unknown node
  if (layoutNode.isGhost || !individual) {
    const rect = svgEl('rect');
    rect.setAttribute('class', 'ftv-node__bg');
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(height));
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', '#263238');
    rect.setAttribute('stroke', '#546E7A');
    rect.setAttribute('stroke-width', '1.5');
    rect.setAttribute('stroke-dasharray', '6 3');
    g.appendChild(rect);

    const unknownText = svgEl('text');
    unknownText.setAttribute('x', String(width / 2));
    unknownText.setAttribute('y', String(height / 2 + 5));
    unknownText.setAttribute('text-anchor', 'middle');
    unknownText.setAttribute('font-size', '13');
    unknownText.setAttribute('fill', '#78909C');
    unknownText.textContent = 'Unknown';
    g.appendChild(unknownText);
    return g;
  }

  const sex = individual.sex ?? 'U';
  const headerColor = GENDER_HEADER[sex] ?? GENDER_HEADER['U'];
  const bodyColor = GENDER_BODY[sex] ?? GENDER_BODY['U'];
  const ringColor = AVATAR_RING[sex] ?? AVATAR_RING['U'];

  // Clip path for avatar overlap area — keeps name text from going under the avatar
  const clipId = `ftv-clip-${sanitizeId(layoutNode.id)}`;
  const defs = svgEl('defs');
  const clipPath = svgEl('clipPath');
  clipPath.id = clipId;
  const clipRect = svgEl('rect');
  clipRect.setAttribute('x', '10');
  clipRect.setAttribute('y', '0');
  clipRect.setAttribute('width', String(width - AVATAR_R * 2 - 20));
  clipRect.setAttribute('height', String(height));
  clipPath.appendChild(clipRect);
  defs.appendChild(clipPath);
  g.appendChild(defs);

  // Card shadow filter
  const filterId = `ftv-shadow-${sanitizeId(layoutNode.id)}`;
  const filter = svgEl('filter');
  filter.id = filterId;
  filter.setAttribute('x', '-10%');
  filter.setAttribute('y', '-10%');
  filter.setAttribute('width', '120%');
  filter.setAttribute('height', '130%');
  const feDropShadow = document.createElementNS(NS, 'feDropShadow');
  feDropShadow.setAttribute('dx', '0');
  feDropShadow.setAttribute('dy', '2');
  feDropShadow.setAttribute('stdDeviation', '3');
  feDropShadow.setAttribute('flood-color', 'rgba(0,0,0,0.25)');
  filter.appendChild(feDropShadow);
  defs.appendChild(filter);

  // Body background (full card)
  const bodyRect = svgEl('rect');
  bodyRect.setAttribute('class', 'ftv-node__bg');
  bodyRect.setAttribute('width', String(width));
  bodyRect.setAttribute('height', String(height));
  bodyRect.setAttribute('rx', '8');
  bodyRect.setAttribute('fill', bodyColor);
  bodyRect.setAttribute('filter', `url(#${filterId})`);
  g.appendChild(bodyRect);

  // Header band (top portion, darker shade)
  const headerClipId = `ftv-hclip-${sanitizeId(layoutNode.id)}`;
  const headerClipPath = svgEl('clipPath');
  headerClipPath.id = headerClipId;
  const headerClipRect = svgEl('rect');
  headerClipRect.setAttribute('x', '0');
  headerClipRect.setAttribute('y', '0');
  headerClipRect.setAttribute('width', String(width));
  headerClipRect.setAttribute('height', String(HEADER_HEIGHT));
  headerClipRect.setAttribute('rx', '8');
  headerClipPath.appendChild(headerClipRect);
  defs.appendChild(headerClipPath);

  const headerRect = svgEl('rect');
  headerRect.setAttribute('x', '0');
  headerRect.setAttribute('y', '0');
  headerRect.setAttribute('width', String(width));
  headerRect.setAttribute('height', String(HEADER_HEIGHT + 4)); // overlap a few px so no gap
  headerRect.setAttribute('fill', headerColor);
  headerRect.setAttribute('clip-path', `url(#${headerClipId})`);
  g.appendChild(headerRect);

  // Avatar circle — sits on the right, straddling the header/body boundary
  const avatarCX = width - AVATAR_R - 8;
  const avatarCY = HEADER_HEIGHT;

  // Avatar ring (semi-transparent)
  const avatarRing = svgEl('circle');
  avatarRing.setAttribute('cx', String(avatarCX));
  avatarRing.setAttribute('cy', String(avatarCY));
  avatarRing.setAttribute('r', String(AVATAR_R + 3));
  avatarRing.setAttribute('fill', 'none');
  avatarRing.setAttribute('stroke', ringColor);
  avatarRing.setAttribute('stroke-width', '2');
  avatarRing.setAttribute('opacity', '0.6');
  g.appendChild(avatarRing);

  // Avatar circle fill (background, always present)
  const avatar = svgEl('circle');
  avatar.setAttribute('class', 'ftv-node__photo');
  avatar.setAttribute('cx', String(avatarCX));
  avatar.setAttribute('cy', String(avatarCY));
  avatar.setAttribute('r', String(AVATAR_R));
  avatar.setAttribute('fill', headerColor);
  avatar.setAttribute('stroke', ringColor);
  avatar.setAttribute('stroke-width', '2');
  g.appendChild(avatar);

  if (individual.photoUrl) {
    // Clip the photo to the avatar circle
    const photoClipId = `ftv-pclip-${sanitizeId(layoutNode.id)}`;
    const photoClip = svgEl('clipPath');
    photoClip.id = photoClipId;
    const photoClipCircle = svgEl('circle');
    photoClipCircle.setAttribute('cx', String(avatarCX));
    photoClipCircle.setAttribute('cy', String(avatarCY));
    photoClipCircle.setAttribute('r', String(AVATAR_R));
    photoClip.appendChild(photoClipCircle);
    defs.appendChild(photoClip);

    const img = svgEl('image');
    img.setAttribute('href', individual.photoUrl);
    img.setAttribute('x', String(avatarCX - AVATAR_R));
    img.setAttribute('y', String(avatarCY - AVATAR_R));
    img.setAttribute('width', String(AVATAR_R * 2));
    img.setAttribute('height', String(AVATAR_R * 2));
    img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    img.setAttribute('clip-path', `url(#${photoClipId})`);
    g.appendChild(img);
  } else {
    // Gender initial in avatar
    const initial = svgEl('text');
    initial.setAttribute('x', String(avatarCX));
    initial.setAttribute('y', String(avatarCY + 6));
    initial.setAttribute('text-anchor', 'middle');
    initial.setAttribute('font-size', '16');
    initial.setAttribute('font-weight', '600');
    initial.setAttribute('fill', 'white');
    initial.setAttribute('opacity', '0.85');
    initial.textContent = sex === 'U' ? '?' : sex;
    g.appendChild(initial);
  }

  // Name — split across two lines in header band
  const givenName = individual.givenName || '';
  const surname = individual.surname || '';
  const fullName = [givenName, surname].filter(Boolean).join(' ');
  const displayName = fullName || 'Unknown';

  // Line 1: given name (bold)
  const givenText = svgEl('text');
  givenText.setAttribute('class', 'ftv-node__name');
  givenText.setAttribute('x', '10');
  givenText.setAttribute('y', '22');
  givenText.setAttribute('font-weight', '700');
  givenText.setAttribute('font-size', '13');
  givenText.setAttribute('fill', 'white');
  givenText.setAttribute('clip-path', `url(#${clipId})`);
  givenText.textContent = givenName || displayName;
  const title = svgEl('title');
  title.textContent = displayName;
  givenText.appendChild(title);
  g.appendChild(givenText);

  // Line 2: surname (lighter weight, slightly less opaque)
  if (surname) {
    const surnameText = svgEl('text');
    surnameText.setAttribute('x', '10');
    surnameText.setAttribute('y', '39');
    surnameText.setAttribute('font-weight', '500');
    surnameText.setAttribute('font-size', '12');
    surnameText.setAttribute('fill', 'rgba(255,255,255,0.85)');
    surnameText.setAttribute('clip-path', `url(#${clipId})`);
    surnameText.textContent = surname;
    g.appendChild(surnameText);
  }

  // Dates — in body area, below header
  const birthYear = individual.birth?.year;
  const deathYear = individual.death?.year;
  let datesStr = '';
  if (birthYear) datesStr += `b. ${birthYear}`;
  if (deathYear) datesStr += (datesStr ? ' · ' : '') + `d. ${deathYear}`;

  if (datesStr) {
    const datesText = svgEl('text');
    datesText.setAttribute('class', 'ftv-node__dates');
    datesText.setAttribute('x', '10');
    datesText.setAttribute('y', String(HEADER_HEIGHT + 20));
    datesText.setAttribute('font-size', '11');
    datesText.setAttribute('fill', 'rgba(255,255,255,0.80)');
    datesText.setAttribute('clip-path', `url(#${clipId})`);
    datesText.textContent = datesStr;
    g.appendChild(datesText);
  }

  // Place (birth place) if no dates and space available
  const birthPlace = individual.birth?.place;
  if (birthPlace && !datesStr) {
    const placeText = svgEl('text');
    placeText.setAttribute('x', '10');
    placeText.setAttribute('y', String(HEADER_HEIGHT + 20));
    placeText.setAttribute('font-size', '11');
    placeText.setAttribute('fill', 'rgba(255,255,255,0.70)');
    placeText.setAttribute('clip-path', `url(#${clipId})`);
    placeText.textContent = birthPlace;
    g.appendChild(placeText);
  }

  // Click handler
  g.addEventListener('click', (e) => {
    e.stopPropagation();
    bus.emit('node:click', { id: layoutNode.id });
  });

  return g;
}

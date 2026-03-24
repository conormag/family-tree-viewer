import type { GedcomNode } from './types.js';
import type { Tree } from '../model/Tree.js';

const CRLF = '\r\n';
const MAX_LINE_LEN = 248;

function line(level: number, tag: string, value?: string, xref?: string): string {
  const parts: string[] = [String(level)];
  if (xref) parts.push(xref);
  parts.push(tag);
  if (value) parts.push(value);
  return parts.join(' ');
}

function wrapValue(level: number, tag: string, value: string, xref?: string): string[] {
  const firstLine = line(level, tag, value.slice(0, MAX_LINE_LEN), xref);
  const lines = [firstLine];
  let remaining = value.slice(MAX_LINE_LEN);
  while (remaining.length > 0) {
    lines.push(line(level + 1, 'CONT', remaining.slice(0, MAX_LINE_LEN)));
    remaining = remaining.slice(MAX_LINE_LEN);
  }
  return lines;
}

function serializeNode(node: GedcomNode, outputLines: string[]): void {
  const parts: string[] = [String(node.level)];
  if (node.xref) parts.push(node.xref);
  parts.push(node.tag);
  if (node.value) parts.push(node.value);
  outputLines.push(parts.join(' '));
  for (const child of node.children) {
    serializeNode(child, outputLines);
  }
}

export function serializeGedcom(tree: Tree, header: GedcomNode | null): string {
  const outputLines: string[] = [];

  // HEAD
  if (header) {
    serializeNode(header, outputLines);
  } else {
    outputLines.push('0 HEAD');
    outputLines.push('1 GEDC');
    outputLines.push('2 VERS 5.5.1');
    outputLines.push('1 CHAR UTF-8');
  }

  // INDIs
  for (const ind of tree.getAllIndividuals()) {
    outputLines.push(line(0, 'INDI', undefined, ind.id));

    // NAME
    const nameValue = ind.givenName
      ? `${ind.givenName} /${ind.surname}/`
      : `/${ind.surname}/`;
    outputLines.push(...wrapValue(1, 'NAME', nameValue));

    // SEX
    if (ind.sex !== 'U') {
      outputLines.push(line(1, 'SEX', ind.sex));
    }

    // BIRT
    if (ind.birth) {
      outputLines.push(line(1, 'BIRT'));
      if (ind.birth.date) outputLines.push(line(2, 'DATE', ind.birth.date));
      if (ind.birth.place) outputLines.push(line(2, 'PLAC', ind.birth.place));
    }

    // DEAT
    if (ind.death) {
      outputLines.push(line(1, 'DEAT'));
      if (ind.death.date) outputLines.push(line(2, 'DATE', ind.death.date));
      if (ind.death.place) outputLines.push(line(2, 'PLAC', ind.death.place));
    }

    // FAMS
    for (const famId of ind.familiesAsSpouse) {
      outputLines.push(line(1, 'FAMS', famId));
    }

    // FAMC
    if (ind.familyAsChild) {
      outputLines.push(line(1, 'FAMC', ind.familyAsChild));
    }

    // NOTEs
    for (const note of ind.notes) {
      outputLines.push(...wrapValue(1, 'NOTE', note));
    }
  }

  // FAMs
  for (const fam of tree.getAllFamilies()) {
    outputLines.push(line(0, 'FAM', undefined, fam.id));
    if (fam.husbandId) outputLines.push(line(1, 'HUSB', fam.husbandId));
    if (fam.wifeId) outputLines.push(line(1, 'WIFE', fam.wifeId));
    for (const childId of fam.childIds) {
      outputLines.push(line(1, 'CHIL', childId));
    }
    if (fam.marriage) {
      outputLines.push(line(1, 'MARR'));
      if (fam.marriage.date) outputLines.push(line(2, 'DATE', fam.marriage.date));
      if (fam.marriage.place) outputLines.push(line(2, 'PLAC', fam.marriage.place));
    }
  }

  outputLines.push('0 TRLR');

  return outputLines.join(CRLF) + CRLF;
}

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseGedcom } from '../../src/gedcom/parser.js';

const FIXTURES = join(__dirname, '../fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8');
}

describe('parseGedcom', () => {
  it('parses simple.ged — correct individual and family counts', () => {
    const text = loadFixture('simple.ged');
    const nodes = parseGedcom(text);
    const indis = nodes.filter(n => n.tag === 'INDI');
    const fams = nodes.filter(n => n.tag === 'FAM');
    expect(indis).toHaveLength(3);
    expect(fams).toHaveLength(1);
  });

  it('parses name correctly', () => {
    const text = loadFixture('simple.ged');
    const nodes = parseGedcom(text);
    const john = nodes.find(n => n.tag === 'INDI' && n.xref === '@I1@');
    expect(john).toBeDefined();
    const nameNode = john!.children.find(c => c.tag === 'NAME');
    expect(nameNode?.value).toBe('John /Smith/');
  });

  it('parses xref correctly on INDI nodes', () => {
    const nodes = parseGedcom(loadFixture('simple.ged'));
    const ids = nodes.filter(n => n.tag === 'INDI').map(n => n.xref);
    expect(ids).toContain('@I1@');
    expect(ids).toContain('@I2@');
    expect(ids).toContain('@I3@');
  });

  it('parses nested children (BIRT/DATE)', () => {
    const nodes = parseGedcom(loadFixture('simple.ged'));
    const john = nodes.find(n => n.xref === '@I1@')!;
    const birt = john.children.find(c => c.tag === 'BIRT');
    expect(birt).toBeDefined();
    const date = birt!.children.find(c => c.tag === 'DATE');
    expect(date?.value).toBe('1840');
  });

  it('strips BOM from input', () => {
    const text = '\uFEFF' + loadFixture('simple.ged');
    const nodes = parseGedcom(text);
    expect(nodes[0].tag).toBe('HEAD');
  });

  it('normalizes CRLF line endings', () => {
    const text = loadFixture('simple.ged').replace(/\n/g, '\r\n');
    const nodes = parseGedcom(text);
    const indis = nodes.filter(n => n.tag === 'INDI');
    expect(indis).toHaveLength(3);
  });

  it('parses multi-family.ged — 2 families, 5 individuals', () => {
    const nodes = parseGedcom(loadFixture('multi-family.ged'));
    expect(nodes.filter(n => n.tag === 'INDI')).toHaveLength(5);
    expect(nodes.filter(n => n.tag === 'FAM')).toHaveLength(2);
  });

  it('handles unicode (Irish fada names)', () => {
    const nodes = parseGedcom(loadFixture('unicode.ged'));
    const seamus = nodes.find(n => n.xref === '@I1@')!;
    const name = seamus.children.find(c => c.tag === 'NAME');
    expect(name?.value).toBe('Séamus /Mac Cárthaigh/');
  });

  it('merges CONC nodes into parent value', () => {
    // GEDCOM spec: CONC appends directly (no space added by parser).
    // Writers must ensure trailing space if splitting between words.
    const text = `0 HEAD
1 CHAR UTF-8
0 @I1@ INDI
1 NAME John /Smith/
1 NOTE This is a very long note that
2 CONC continues here
0 TRLR
`;
    const nodes = parseGedcom(text);
    const ind = nodes.find(n => n.xref === '@I1@')!;
    const note = ind.children.find(c => c.tag === 'NOTE');
    // Direct concatenation per GEDCOM spec: no space between 'that' and 'continues'
    expect(note?.value).toBe('This is a very long note thatcontinues here');
    // CONC should be removed from children
    expect(note?.children.find(c => c.tag === 'CONC')).toBeUndefined();
  });

  it('merges CONT nodes with newline', () => {
    const text = `0 HEAD
1 CHAR UTF-8
0 @I1@ INDI
1 NAME John /Smith/
1 NOTE First line
2 CONT Second line
0 TRLR
`;
    const nodes = parseGedcom(text);
    const ind = nodes.find(n => n.xref === '@I1@')!;
    const note = ind.children.find(c => c.tag === 'NOTE');
    expect(note?.value).toBe('First line\nSecond line');
  });

  it('handles HEAD node with no xref', () => {
    const nodes = parseGedcom(loadFixture('simple.ged'));
    const head = nodes.find(n => n.tag === 'HEAD');
    expect(head).toBeDefined();
    expect(head?.xref).toBeUndefined();
    expect(head?.level).toBe(0);
  });

  it('ignores empty lines', () => {
    const text = `0 HEAD\n\n1 CHAR UTF-8\n\n0 TRLR\n`;
    const nodes = parseGedcom(text);
    expect(nodes).toHaveLength(2);
  });
});

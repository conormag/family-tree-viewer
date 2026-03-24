import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseGedcom } from '../../src/gedcom/parser.js';
import { serializeGedcom } from '../../src/gedcom/serializer.js';
import { buildTree } from '../../src/model/Tree.js';

const FIXTURES = join(__dirname, '../fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8');
}

describe('serializeGedcom', () => {
  it('round-trip: parse → build → serialize → parse yields same individual count', () => {
    const original = loadFixture('simple.ged');
    const nodes = parseGedcom(original);
    const tree = buildTree(nodes);
    const serialized = serializeGedcom(tree, null);
    const reparsed = parseGedcom(serialized);
    expect(reparsed.filter(n => n.tag === 'INDI')).toHaveLength(3);
  });

  it('round-trip: parse → build → serialize → parse yields same family count', () => {
    const original = loadFixture('simple.ged');
    const tree = buildTree(parseGedcom(original));
    const serialized = serializeGedcom(tree, null);
    const reparsed = parseGedcom(serialized);
    expect(reparsed.filter(n => n.tag === 'FAM')).toHaveLength(1);
  });

  it('round-trip preserves individual name', () => {
    const tree = buildTree(parseGedcom(loadFixture('simple.ged')));
    const serialized = serializeGedcom(tree, null);
    const reparsed = parseGedcom(serialized);
    const john = reparsed.find(n => n.xref === '@I1@')!;
    const name = john.children.find(c => c.tag === 'NAME');
    expect(name?.value).toBe('John /Smith/');
  });

  it('outputs CRLF line endings', () => {
    const tree = buildTree(parseGedcom(loadFixture('simple.ged')));
    const serialized = serializeGedcom(tree, null);
    expect(serialized).toContain('\r\n');
    // Every line end should be CRLF
    const lfOnly = serialized.replace(/\r\n/g, '').includes('\n');
    expect(lfOnly).toBe(false);
  });

  it('TRLR is the last record', () => {
    const tree = buildTree(parseGedcom(loadFixture('simple.ged')));
    const serialized = serializeGedcom(tree, null);
    const lines = serialized.split('\r\n').filter(Boolean);
    expect(lines[lines.length - 1]).toBe('0 TRLR');
  });

  it('includes HEAD when not provided', () => {
    const tree = buildTree(parseGedcom(loadFixture('simple.ged')));
    const serialized = serializeGedcom(tree, null);
    expect(serialized).toMatch(/^0 HEAD/);
  });

  it('round-trip preserves birth date', () => {
    const tree = buildTree(parseGedcom(loadFixture('simple.ged')));
    const serialized = serializeGedcom(tree, null);
    const reparsed = parseGedcom(serialized);
    const john = reparsed.find(n => n.xref === '@I1@')!;
    const birt = john.children.find(c => c.tag === 'BIRT')!;
    const date = birt.children.find(c => c.tag === 'DATE');
    expect(date?.value).toBe('1840');
  });

  it('round-trip on unicode fixture', () => {
    const tree = buildTree(parseGedcom(loadFixture('unicode.ged')));
    const serialized = serializeGedcom(tree, null);
    const reparsed = parseGedcom(serialized);
    const seamus = reparsed.find(n => n.xref === '@I1@')!;
    const name = seamus.children.find(c => c.tag === 'NAME');
    expect(name?.value).toBe('Séamus /Mac Cárthaigh/');
  });
});

import type { GedcomNode } from './types.js';

interface RawLine {
  level: number;
  xref?: string;
  tag: string;
  value: string;
}

const LINE_RE = /^(\d+)\s+(?:(@[^@]+@)\s+)?(\w+)(?:\s+(.*))?$/;

function tokenize(text: string): RawLine[] {
  // Strip BOM, normalize CRLF→LF
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const result: RawLine[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;

    const m = LINE_RE.exec(line);
    if (!m) continue;

    const level = parseInt(m[1], 10);
    // For level-0: m[2] could be the xref OR the tag might come first
    // Pattern: "0 @I1@ INDI" → m[2]="@I1@", m[3]="INDI"
    // Pattern: "0 HEAD" → m[2]=undefined, m[3]="HEAD"
    const xref = m[2];
    const tag = m[3];
    const value = m[4] ?? '';

    result.push({ level, xref, tag, value });
  }

  return result;
}

function buildTree(rawLines: RawLine[]): GedcomNode[] {
  const roots: GedcomNode[] = [];
  const stack: GedcomNode[] = [];

  for (const raw of rawLines) {
    const node: GedcomNode = {
      level: raw.level,
      tag: raw.tag,
      value: raw.value,
      children: [],
    };
    if (raw.xref !== undefined) {
      node.xref = raw.xref;
    }

    // Pop until top has lower level
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node);
    } else {
      roots.push(node);
    }

    stack.push(node);
  }

  return roots;
}

function mergeConcCont(nodes: GedcomNode[]): void {
  for (const node of nodes) {
    // Recursively process children first
    mergeConcCont(node.children);

    // Find leading CONC/CONT nodes and merge into this node's value
    const toRemove: number[] = [];
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child.tag === 'CONC') {
        node.value += child.value;
        toRemove.push(i);
      } else if (child.tag === 'CONT') {
        node.value += '\n' + child.value;
        toRemove.push(i);
      }
    }

    // Remove in reverse order
    for (let i = toRemove.length - 1; i >= 0; i--) {
      node.children.splice(toRemove[i], 1);
    }
  }
}

export function parseGedcom(text: string): GedcomNode[] {
  const rawLines = tokenize(text);
  const roots = buildTree(rawLines);
  mergeConcCont(roots);
  return roots;
}

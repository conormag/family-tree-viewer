export interface GedcomNode {
  level: number;
  xref?: string;      // e.g. "@I1@" — only level-0 records
  tag: string;
  value: string;
  children: GedcomNode[];
}

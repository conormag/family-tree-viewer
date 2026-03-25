export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  generation: number;
  isGhost: boolean;
  /** Family id this ghost node was synthesized for */
  ghostFamilyId?: string;
}

export interface LayoutEdge {
  type: 'parent-child' | 'couple';
  fromId: string;
  toId: string;
  /** For parent-child: the family id linking them */
  familyId?: string;
}

export interface ExpandButton {
  famId: string;
  childCount: number;
  /** SVG center-x of the button */
  x: number;
  /** SVG top-y of the parent cards' bottom edge (button sits just below) */
  parentBottomY: number;
  /** Y of the couple connector line (card mid-height) — stub is drawn from here */
  parentMidY: number;
  /** For single-parent families: x of the card edge where the horizontal arm starts */
  armFromX?: number;
  expanded: boolean;
}

export interface LayoutResult {
  nodes: Map<string, LayoutNode>;
  edges: LayoutEdge[];
  /** Family id → X midpoint between the couple, used for parent-child bus lines */
  coupleMidX: Map<string, number>;
  /** One entry per family that has children (collapsed or expanded) */
  expandButtons: ExpandButton[];
  totalWidth: number;
  totalHeight: number;
}

import type { LayoutNode, LayoutEdge } from '../layout/types.js';

const NS = 'http://www.w3.org/2000/svg';

const STAGGER = 14;    // px between overlapping bus lines
const DOT_R   = 4;     // radius of junction dots

function svgLine(x1: number, y1: number, x2: number, y2: number): SVGLineElement {
  const line = document.createElementNS(NS, 'line');
  line.setAttribute('x1', String(Math.round(x1)));
  line.setAttribute('y1', String(Math.round(y1)));
  line.setAttribute('x2', String(Math.round(x2)));
  line.setAttribute('y2', String(Math.round(y2)));
  line.setAttribute('stroke', '#94a3b8');
  line.setAttribute('stroke-width', '2');
  return line;
}

function svgDot(cx: number, cy: number): SVGCircleElement {
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('cx', String(Math.round(cx)));
  c.setAttribute('cy', String(Math.round(cy)));
  c.setAttribute('r', String(DOT_R));
  c.setAttribute('fill', '#94a3b8');
  return c;
}

interface BusData {
  familyId: string;
  dropX: number;
  parentMidY: number;
  childNodes: LayoutNode[];
  busLeft: number;
  busRight: number;
  ym: number;
  /** For single-parent families: x of the card edge where the arm starts */
  armFromX?: number;
}

export function paintEdges(
  edges: LayoutEdge[],
  nodes: Map<string, LayoutNode>,
  edgeLayer: SVGGElement,
  coupleLayer: SVGGElement,
  coupleMidX: Map<string, number>,
): void {
  // Which families have a real couple connector (both parents visible)?
  const coupledFamilies = new Set<string>();
  for (const edge of edges) {
    if (edge.type === 'couple' && edge.familyId) coupledFamilies.add(edge.familyId);
  }

  // Draw couple connectors
  for (const edge of edges) {
    if (edge.type !== 'couple') continue;
    const fromNode = nodes.get(edge.fromId);
    const toNode   = nodes.get(edge.toId);
    if (!fromNode || !toNode) continue;

    const left  = fromNode.x < toNode.x ? fromNode : toNode;
    const right = fromNode.x < toNode.x ? toNode   : fromNode;
    const y = left.y + left.height / 2;
    const line = svgLine(left.x + left.width, y, right.x, y);
    line.setAttribute('class', 'ftv-edge ftv-edge--couple');
    coupleLayer.appendChild(line);
  }

  // Group parent-child edges by family
  const familyChildEdges = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.type !== 'parent-child' || !edge.familyId) continue;
    if (!familyChildEdges.has(edge.familyId)) familyChildEdges.set(edge.familyId, []);
    familyChildEdges.get(edge.familyId)!.push(edge.toId);
  }

  // Build BusData for every family with visible children
  const busList: BusData[] = [];

  for (const [familyId, childIds] of familyChildEdges) {
    const childNodes = childIds
      .map(id => nodes.get(id))
      .filter((n): n is LayoutNode => n !== undefined);
    if (childNodes.length === 0) continue;

    const dropX = coupleMidX.get(familyId);
    if (dropX === undefined) continue;

    const parentEdge = edges.find(e => e.type === 'parent-child' && e.familyId === familyId);
    const parentNode = parentEdge ? nodes.get(parentEdge.fromId) : undefined;
    if (!parentNode) continue;

    const parentMidY    = parentNode.y + parentNode.height / 2;
    const firstChildTop = Math.min(...childNodes.map(n => n.y));
    const rawYm         = (parentNode.y + parentNode.height + firstChildTop) / 2;

    const childCenters = childNodes.map(n => n.x + n.width / 2);
    const busLeft  = Math.min(...childCenters, dropX);
    const busRight = Math.max(...childCenters, dropX);

    // For single-parent families, compute where the horizontal arm starts
    let armFromX: number | undefined;
    if (!coupledFamilies.has(familyId)) {
      // arm runs from the near card edge to dropX at parentMidY
      armFromX = (parentNode.x + parentNode.width / 2 < dropX)
        ? parentNode.x + parentNode.width   // husband — arm goes rightward
        : parentNode.x;                     // wife    — arm goes leftward
    }

    busList.push({ familyId, dropX, parentMidY, childNodes, busLeft, busRight, ym: rawYm, armFromX });
  }

  // Stagger overlapping bus lines
  busList.sort((a, b) => a.busLeft - b.busLeft);
  for (let i = 0; i < busList.length; i++) {
    for (let j = 0; j < i; j++) {
      const xOverlap = Math.min(busList[i].busRight, busList[j].busRight)
                     - Math.max(busList[i].busLeft,  busList[j].busLeft);
      if (xOverlap > 4 && Math.abs(busList[i].ym - busList[j].ym) < STAGGER / 2) {
        busList[i].ym = busList[j].ym + STAGGER;
      }
    }
  }

  // Draw all buses
  for (const bus of busList) {
    const { dropX, parentMidY, childNodes, busLeft, busRight, ym, armFromX } = bus;

    // Horizontal arm for single-parent families (runs from card edge to dropX)
    if (armFromX !== undefined) {
      edgeLayer.appendChild(svgLine(armFromX, parentMidY, dropX, parentMidY));
    }

    // Junction dot where the couple/arm line meets the vertical drop
    edgeLayer.appendChild(svgDot(dropX, parentMidY));

    // Vertical drop from couple-connector level down to bus Y
    edgeLayer.appendChild(svgLine(dropX, parentMidY, dropX, ym));

    if (childNodes.length === 1) {
      const cx       = childNodes[0].x + childNodes[0].width / 2;
      const childTop = childNodes[0].y;
      edgeLayer.appendChild(svgLine(dropX, ym, cx, ym));
      edgeLayer.appendChild(svgLine(cx, ym, cx, childTop));
    } else {
      // Horizontal bus across all child centers
      edgeLayer.appendChild(svgLine(busLeft, ym, busRight, ym));

      // Vertical stem to each child
      for (const child of childNodes) {
        const cx = child.x + child.width / 2;
        edgeLayer.appendChild(svgLine(cx, ym, cx, child.y));
      }
    }
  }
}

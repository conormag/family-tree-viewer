import type { LayoutNode, LayoutEdge } from '../layout/types.js';

const NS = 'http://www.w3.org/2000/svg';

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

export function paintEdges(
  edges: LayoutEdge[],
  nodes: Map<string, LayoutNode>,
  edgeLayer: SVGGElement,
  coupleLayer: SVGGElement,
  coupleMidX: Map<string, number>,
): void {
  // Group parent-child edges by familyId to draw shared horizontal bus lines
  const familyChildEdges = new Map<string, { childIds: string[] }>();

  for (const edge of edges) {
    if (edge.type === 'couple') {
      const fromNode = nodes.get(edge.fromId);
      const toNode = nodes.get(edge.toId);
      if (!fromNode || !toNode) continue;

      // Draw between whichever node is on the left and the one on the right
      const leftNode = fromNode.x < toNode.x ? fromNode : toNode;
      const rightNode = fromNode.x < toNode.x ? toNode : fromNode;
      const y = leftNode.y + leftNode.height / 2;
      const line = svgLine(leftNode.x + leftNode.width, y, rightNode.x, y);
      line.setAttribute('class', 'ftv-edge ftv-edge--couple');
      coupleLayer.appendChild(line);
    } else if (edge.type === 'parent-child' && edge.familyId) {
      const existing = familyChildEdges.get(edge.familyId);
      if (existing) {
        existing.childIds.push(edge.toId);
      } else {
        familyChildEdges.set(edge.familyId, { childIds: [edge.toId] });
      }
    }
  }

  // Draw parent-child edges with a shared horizontal bus per family
  for (const [familyId, { childIds }] of familyChildEdges) {
    const childNodes = childIds
      .map(id => nodes.get(id))
      .filter((n): n is LayoutNode => n !== undefined);

    if (childNodes.length === 0) continue;

    // Use the couple midpoint as the drop origin (not just one parent's center)
    const dropX = coupleMidX.get(familyId);
    if (dropX === undefined) continue;

    // Find a parent node to get the y coordinate for the top of the stub
    const childCenters = childNodes.map(n => n.x + n.width / 2);
    const firstChildTop = Math.min(...childNodes.map(n => n.y));

    // Get parent bottom y — use the node whose center is closest to dropX
    // We need a parent y; look up any node at the right generation
    const parentY = firstChildTop - 120; // vGap default; approximate if node not found
    // Try to get it properly from the edge's fromId
    const parentEdge = edges.find(e => e.type === 'parent-child' && e.familyId === familyId);
    const parentNode = parentEdge ? nodes.get(parentEdge.fromId) : undefined;
    const parentBottom = parentNode ? parentNode.y + parentNode.height : parentY;

    const ym = (parentBottom + firstChildTop) / 2;

    // Vertical stub from parent couple midpoint down to ym
    edgeLayer.appendChild(svgLine(dropX, parentBottom, dropX, ym));

    if (childNodes.length === 1) {
      const childCenterX = childNodes[0].x + childNodes[0].width / 2;
      const childTop = childNodes[0].y;
      // Elbow: horizontal from dropX to child center, then down to child
      edgeLayer.appendChild(svgLine(dropX, ym, childCenterX, ym));
      edgeLayer.appendChild(svgLine(childCenterX, ym, childCenterX, childTop));
    } else {
      const busLeft = Math.min(...childCenters);
      const busRight = Math.max(...childCenters);

      // Horizontal bus line across all child centers
      edgeLayer.appendChild(svgLine(busLeft, ym, busRight, ym));

      // Vertical stub from dropX to bus (if not already covered by the bus extent)
      if (dropX < busLeft) {
        edgeLayer.appendChild(svgLine(dropX, ym, busLeft, ym));
      } else if (dropX > busRight) {
        edgeLayer.appendChild(svgLine(busRight, ym, dropX, ym));
      }

      // Vertical stub from bus down to each child
      for (const child of childNodes) {
        const cx = child.x + child.width / 2;
        edgeLayer.appendChild(svgLine(cx, ym, cx, child.y));
      }
    }
  }
}

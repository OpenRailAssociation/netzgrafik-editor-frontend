import {Port} from "../../models/port.model";
import {Node} from "../../models/node.model";
import {Transition} from "../../models/transition.model";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {groupBy} from "../../utils/collection";

export function getPortOppositeNodeId(port: Port, nodeId: number): number {
  const ts = port.getTrainrunSection();
  return ts.getSourceNodeId() === nodeId ? ts.getTargetNodeId() : ts.getSourceNodeId();
}

export type SidesComponent = {node: Node; side: PortAlignment}[];

/**
 * Splits a network into as many independent components as possible, with "independent" meaning
 * here that ordering the ports of one can never change the best port ordering of another.
 *
 * It groups node sides, not nodes: independence is per side, so one node can have one side belong
 * to a component, and another side belong to a different one.
 *
 * Node sides are grouped only when they are coupled. Two things couple them:
 *   1. The two ends of a bundle (a link of at least two parallel sections between two nodes)
 *   2. The sides joined by at least two pass-through sections sharing a side within a node
 *
 * A single section couples nothing (one lone link between two nodes, or one lone pass-through
 * section inside a node), so it is a "bridge" that gets cut.
 *
 * And because cuts happen at these bridges exactly, two components can share a node (each owning a
 * different subset of its ports) or even a trainrun (its ports falling on either side of a cut).
 */
export function getComponents(nodes: Node[]): SidesComponent[] {
  // Helpers to manage what group each port is in:
  const portGroupsIds = new Map<number, number>();
  const getPortRoot = (portId: number): number => {
    let root = portId;
    while (portGroupsIds.get(root) !== root) root = portGroupsIds.get(root)!;
    while (portId !== root) {
      const next = portGroupsIds.get(portId)!;
      portGroupsIds.set(portId, root);
      portId = next;
    }
    return root;
  };
  const mergePortGroups = (portAId: number, portBId: number) =>
    portGroupsIds.set(getPortRoot(portAId), getPortRoot(portBId));

  const allPorts = nodes.flatMap((node) => node.getPorts().map((port) => ({port, node})));
  const sectionPorts = groupBy(
    allPorts.map(({port}) => port),
    (p) => p.getTrainrunSectionId(),
  );

  // Each port is in its own group initially:
  allPorts.forEach(({port}) => portGroupsIds.set(port.getId(), port.getId()));

  nodes.forEach((node) => {
    const id = node.getId();

    // 0. Group all ports on the same side
    // Ports on the same side of the same node are grouped together
    groupBy(node.getPorts(), (p) => p.getPositionAlignment()).forEach((side) =>
      side.forEach((p) => mergePortGroups(p.getId(), side[0].getId())),
    );

    // 1. Bundle link:
    // A link with at least two parallel sections groups all its ports together
    groupBy(node.getPorts(), (p) => getPortOppositeNodeId(p, id)).forEach((linkPorts) => {
      if (linkPorts.length < 2) return;
      linkPorts.forEach((p) =>
        sectionPorts
          .get(p.getTrainrunSectionId())!
          .forEach((q) => mergePortGroups(p.getId(), q.getId())),
      );
    });

    // 2. Shared-side transition:
    // When two or more trainruns pass through a node sharing at least one side, the ports of all
    // the related sections (of these trainruns, in that node) are grouped together
    const transitionsBySide = new Map<PortAlignment, Transition[]>();
    node.getTransitions().forEach((t) => {
      const sides = new Set([
        node.getPort(t.getPortId1()).getPositionAlignment(),
        node.getPort(t.getPortId2()).getPositionAlignment(),
      ]);
      sides.forEach((side) => {
        const group = transitionsBySide.get(side);
        if (group) group.push(t);
        else transitionsBySide.set(side, [t]);
      });
    });
    transitionsBySide.forEach((group) => {
      if (group.length < 2) return;
      group.forEach((t) => {
        mergePortGroups(t.getPortId1(), t.getPortId2());
        mergePortGroups(t.getPortId1(), group[0].getPortId1());
      });
    });
  });

  // Translate "ports groups" to "sides components":
  // A component is worth ordering only if some side holds at least two ports
  const orderableRoots = new Set<number>();
  nodes.forEach((node) =>
    groupBy(node.getPorts(), (p) => p.getPositionAlignment()).forEach((side) => {
      if (side.length >= 2) orderableRoots.add(getPortRoot(side[0].getId()));
    }),
  );

  const componentsByRoot = new Map<number, SidesComponent>();
  nodes.forEach((node) =>
    groupBy(node.getPorts(), (p) => p.getPositionAlignment()).forEach((sidePorts, side) => {
      const root = getPortRoot(sidePorts[0].getId());
      if (!orderableRoots.has(root)) return;
      const component = componentsByRoot.get(root);
      if (component) component.push({node, side});
      else componentsByRoot.set(root, [{node, side}]);
    }),
  );

  return [...componentsByRoot.values()];
}

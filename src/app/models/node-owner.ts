/**
 * Every connection and transition belongs to one node. Keeping a direct reference
 * to that node allows fast lookup without searching the list of nodes. This allows
 * to improve the overall Netzgrafik-Editor performance, e.g. paning.
 *
 * This interface breaks the Node -> Connection/Transition -> Node import cycle:
 * the models depend on NodeOwner instead of Node. When the full Node is needed,
 * NodeService checks the reference with instanceof before returning it.
 */
export interface NodeOwner {
  getId(): number;
  getBetriebspunktName(): string;
  getFullName(): string;
}

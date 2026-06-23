import {Injectable} from "@angular/core";
import {Node} from "../../models/node.model";
import {NodeService} from "../data/node.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {ViewportCullService} from "../ui/viewport.cull.service";

@Injectable({
  providedIn: "root",
})
export class AutoLayoutService {
  constructor(
    private readonly nodeService: NodeService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly viewportCullService: ViewportCullService,
  ) {}

  private updateRendering() {
    this.nodeService.initPortOrdering();

    this.trainrunSectionService.getTrainrunSections().forEach((ts) => {
      ts.routeEdgeAndPlaceText();
      // Note: don't call updateTransitionsAndConnections() here as it would
      // re-apply spatial port ordering, undoing the optimized ordering from
      // initPortOrdering().
    });

    this.viewportCullService.onViewportChangeUpdateRendering(true);
  }

  callRobustAutomaticNodeLayouting() {
    console.log("Running Spring Layout…");

    const nodes = this.nodeService.getNodes();
    const edges: Array<{source: Node; target: Node}> = [];

    // Build edge list from ports
    //
    //                          . --------.
    //                          |         |
    //  --- trainrunSection ----o         |
    //  --- trainrunSection ----o  NODE A |
    //  --- trainrunSection ----o--- t ---o----- trainrunSection ----
    //                          |         |
    //                          '---------'
    //  o : port with reference to trainrunSection
    //  t : transition with reference to trainrunSection

    nodes.forEach((n) => {
      n.getPorts().forEach((p) => {
        const opp = p.getOppositeNode(n.getId());

        const transition = n.getTransitionFromPortId(p.getId());
        const trainrun = transition?.getTrainrun();
        const trainrunSection = p.getTrainrunSection();

        console.log(
          "node:",
          n,
          "OppNode:",
          opp,
          "Port:",
          p,
          "Transition:",
          transition,
          "TrainrunSection:",
          trainrunSection,
          "Trainrun:",
          trainrun,
        );

        if (opp) {
          edges.push({source: n, target: opp});
        }
      });
    });

    // Spring layout parameters
    const ITERATIONS = 200;
    const SPRING_LENGTH = 150;
    const SPRING_STRENGTH = 0.01;
    const REPULSION = 50000;
    const DAMPING = 0.85;

    // Initialize velocities (FIX: number keys instead of string)
    const velocity = new Map<number, {x: number; y: number}>();
    nodes.forEach((n) => velocity.set(n.getId(), {x: 0, y: 0}));

    for (let iter = 0; iter < ITERATIONS; iter++) {
      // Forces per node
      const forces = new Map<number, {x: number; y: number}>();
      nodes.forEach((n) => forces.set(n.getId(), {x: 0, y: 0}));

      // --- REPULSION (Coulomb) ---
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];

          const dx = a.getPositionX() - b.getPositionX();
          const dy = a.getPositionY() - b.getPositionY();
          const distSq = dx * dx + dy * dy || 0.01;
          const force = REPULSION / distSq;

          const fx = (dx / Math.sqrt(distSq)) * force;
          const fy = (dy / Math.sqrt(distSq)) * force;

          forces.get(a.getId())!.x += fx;
          forces.get(a.getId())!.y += fy;
          forces.get(b.getId())!.x -= fx;
          forces.get(b.getId())!.y -= fy;
        }
      }

      // --- SPRINGS (Hooke) ---
      edges.forEach((e) => {
        const a = e.source;
        const b = e.target;

        const dx = b.getPositionX() - a.getPositionX();
        const dy = b.getPositionY() - a.getPositionY();
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;

        const displacement = dist - SPRING_LENGTH;
        const force = SPRING_STRENGTH * displacement;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        forces.get(a.getId())!.x += fx;
        forces.get(a.getId())!.y += fy;
        forces.get(b.getId())!.x -= fx;
        forces.get(b.getId())!.y -= fy;
      });

      // --- UPDATE POSITIONS ---
      nodes.forEach((n) => {
        const f = forces.get(n.getId())!;
        const v = velocity.get(n.getId())!;

        // Apply damping
        v.x = (v.x + f.x) * DAMPING;
        v.y = (v.y + f.y) * DAMPING;

        n.setPosition(n.getPositionX() + v.x, n.getPositionY() + v.y);
      });
    }

    console.log("Spring Layout finished.");

    // Trigger rendering updates
    this.nodeService.nodesUpdated();
    this.nodeService.transitionsUpdated();
    this.nodeService.connectionsUpdated();
    this.trainrunSectionService.trainrunSectionsUpdated();
    this.updateRendering();
  }
}

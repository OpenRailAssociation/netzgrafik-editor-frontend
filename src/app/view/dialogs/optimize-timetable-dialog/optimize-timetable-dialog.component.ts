import {ChangeDetectionStrategy, Component, OnDestroy, TemplateRef, ViewChild} from "@angular/core";
import {SbbDialog, SbbDialogConfig, type SbbDialogRef} from "@sbb-esta/angular/dialog";
import {Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {NodeService} from "../../../services/data/node.service";
import {TrainrunService} from "../../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../../services/data/trainrunsection.service";
import {UndoService} from "../../../services/data/undo.service";
import {OptimizeTimetableService} from "../../../services/optimization/optimize-timetable.service";
import {OptimizationPolicyService} from "../../../services/optimization/optimization-policy.service";
import {
  createDefaultOptimizationPolicy,
  OptimizationPolicy,
} from "../../../services/optimization/optimization-policy.model";
import {compareSolutions} from "../../../services/optimization/optimization-solution-comparator";
import {
  OptimizeTimetableResult,
  OptimizeTimetableSolution,
  TimeChange,
} from "../../../services/optimization/optimize-timetable.model";

import {ResourceService} from "../../../services/data/resource.service";
import {InfrastructureEstimatorService} from "../../../services/infrastructure/infrastructure-estimator.service";
import {FilterService} from "../../../services/ui/filter.service";
import {
  KnotenAuslastungDataPreparation,
  KnotenAuslastungSnapshot,
} from "../../knoten-auslastung-view/knoten.auslastung.data.preparation";

export interface NodeChangeGroup {
  nodeId: number;
  nodeName: string;
  changes: TimeChange[];
}

@Component({
  selector: "sbb-optimize-timetable-dialog",
  templateUrl: "./optimize-timetable-dialog.component.html",
  styleUrls: ["./optimize-timetable-dialog.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class OptimizeTimetableDialogComponent implements OnDestroy {
  @ViewChild("optimizeTimetableDialogTemplate", {static: true})
  optimizeTimetableDialogTemplate: TemplateRef<void>;

  maxTracks = 2;
  policy: OptimizationPolicy = createDefaultOptimizationPolicy();
  selectedNodeCount = 0;
  result: OptimizeTimetableResult = undefined;
  selectedSolution: OptimizeTimetableSolution = undefined;
  nodeGroups: NodeChangeGroup[] = [];
  selectedNodeId: number = undefined;
  occupancyBefore: KnotenAuslastungSnapshot = undefined;
  occupancyAfter: KnotenAuslastungSnapshot = undefined;
  private readonly baselineOccupancy = new Map<number, KnotenAuslastungSnapshot>();
  private readonly occupancyPreparation: KnotenAuslastungDataPreparation;

  private previewSolution: OptimizeTimetableSolution = undefined;
  private committed = false;
  private seed = 1;
  private dialogRef: SbbDialogRef<void, unknown> = undefined;
  private readonly destroyed = new Subject<void>();

  constructor(
    private readonly dialog: SbbDialog,
    private readonly uiInteractionService: UiInteractionService,
    private readonly nodeService: NodeService,
    private readonly trainrunService: TrainrunService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly undoService: UndoService,
    private readonly optimizeTimetableService: OptimizeTimetableService,
    private readonly optimizationPolicyService: OptimizationPolicyService,
    resourceService: ResourceService,
    infrastructureEstimatorService: InfrastructureEstimatorService,
    filterService: FilterService,
  ) {
    this.policy = this.optimizationPolicyService.policy;
    this.occupancyPreparation = new KnotenAuslastungDataPreparation(
      trainrunService,
      resourceService,
      trainrunSectionService,
      infrastructureEstimatorService,
      filterService,
      nodeService,
    );
    this.uiInteractionService.optimizeTimetableDialog
      .pipe(takeUntil(this.destroyed))
      .subscribe(() => this.openDialog());
  }

  ngOnDestroy() {
    this.occupancyPreparation.destroy();
    this.destroyed.next();
    this.destroyed.complete();
  }

  get rankedSolutions(): OptimizeTimetableSolution[] {
    return this.result === undefined
      ? []
      : [...this.result.solutions].sort((a, b) => compareSolutions(a, b, this.policy));
  }

  get enabledObjectives() {
    return [...this.policy.objectives]
      .filter((objective) => objective.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  onPolicyChange(policy: OptimizationPolicy): void {
    const hardRulesChanged = this.policy.hardConstraints.some((constraint) => {
      const next = policy.hardConstraints.find((item) => item.id === constraint.id);
      return next?.enabled !== constraint.enabled || next?.value !== constraint.value;
    });
    this.policy = policy;
    if (hardRulesChanged) {
      this.revalidateSolutions();
    }
  }

  selectBaseline(): void {
    this.revertPreview();
    this.selectedSolution = undefined;
    this.nodeGroups = [];
    this.selectedNodeId = undefined;
    this.occupancyBefore = undefined;
    this.occupancyAfter = undefined;
  }

  storePolicy(): void {
    this.policy = this.optimizationPolicyService.storePolicy(this.policy);
  }

  resetRanking(): void {
    this.onPolicyChange({
      ...this.policy,
      objectives: createDefaultOptimizationPolicy().objectives,
    });
  }

  onMaxTracksChange(value: number): void {
    this.maxTracks = Math.max(1, Math.floor(value || 1));
    this.revalidateSolutions();
  }

  private revalidateSolutions(): void {
    if (this.result === undefined) {
      return;
    }
    const selected = this.selectedSolution;
    this.revertPreview();
    const options = {
      maxTracksPerSection: this.maxTracks,
      selectedNodeIds: this.nodeService.getSelectedNodes().map((node) => node.getId()),
      policy: this.policy,
    };
    this.result.baselineKpi.edgesOverLimitBefore = this.result.baselineEdges.filter(
      (edge) => edge.inScope && edge.tracksBefore > this.maxTracks,
    ).length;
    this.result.baselineKpi.edgesOverLimitAfter = this.result.baselineKpi.edgesOverLimitBefore;
    this.result.solutions.forEach((solution) => {
      const changedEdges = new Map(solution.edges.map((edge) => [edge.edgeId, edge]));
      const beforeOver = this.result.baselineKpi.edgesOverLimitBefore;
      let afterOver = beforeOver;
      this.result.baselineEdges.forEach((baseline) => {
        if (!baseline.inScope) {
          return;
        }
        const changed = changedEdges.get(baseline.edgeId);
        if (changed !== undefined) {
          afterOver +=
            Number(changed.tracksAfter > this.maxTracks) -
            Number(baseline.tracksBefore > this.maxTracks);
        }
      });
      solution.kpi.edgesOverLimitBefore = beforeOver;
      solution.kpi.edgesOverLimitAfter = Math.max(0, afterOver);
      solution.valid = this.optimizeTimetableService.isSolutionValid(
        solution,
        this.nodeService.getNodes(),
        this.trainrunSectionService.getTrainrunSections(),
        options,
        this.result.baselineEdges,
      );
    });
    if (selected?.valid) {
      this.selectedSolution = selected;
      this.preview(selected);
    } else {
      this.selectedSolution = undefined;
      this.nodeGroups = [];
      this.occupancyBefore = undefined;
      this.occupancyAfter = undefined;
    }
  }

  openDialog() {
    if (this.dialogRef !== undefined) {
      return;
    }
    this.result = undefined;
    this.selectedSolution = undefined;
    this.nodeGroups = [];
    this.selectedNodeId = undefined;
    this.occupancyBefore = undefined;
    this.occupancyAfter = undefined;
    this.baselineOccupancy.clear();
    this.previewSolution = undefined;
    this.committed = false;
    this.seed = 1;
    this.selectedNodeCount = this.nodeService.getSelectedNodes().length;
    this.undoService.pauseUndoRecording();

    const config = new SbbDialogConfig();
    config.width = "1250px";
    config.maxWidth = "95vw";
    config.maxHeight = "90vh";
    config.id = "OptimizeTimetableDialogId";
    this.dialogRef = this.dialog.open(this.optimizeTimetableDialogTemplate, config);
    this.dialogRef.afterClosed().subscribe(() => this.onClosed());
  }

  optimize() {
    this.seed = 1;
    this.runOptimization(undefined);
  }

  /** Restarts the search from the selected proposal with a new seed. */
  continueOptimization() {
    this.seed++;
    this.runOptimization(this.selectedSolution?.assignment);
  }

  selectSolution(solution: OptimizeTimetableSolution) {
    if (!solution.valid) {
      return;
    }
    this.selectedSolution = solution;
    this.preview(solution);
    this.nodeGroups = this.groupChangesByNode(solution.changes);
    const keep = this.nodeGroups.some((g) => g.nodeId === this.selectedNodeId);
    this.selectNode(keep ? this.selectedNodeId : this.nodeGroups[0]?.nodeId);
  }

  selectNode(nodeId: number) {
    this.selectedNodeId = nodeId;
    const node = nodeId === undefined ? undefined : this.nodeService.getNodeFromId(nodeId);
    if (this.selectedSolution === undefined || node === undefined) {
      this.occupancyBefore = undefined;
      this.occupancyAfter = undefined;
      return;
    }
    this.occupancyBefore = this.baselineOccupancy.get(nodeId);
    this.occupancyAfter = this.occupancyPreparation.getSnapshot(node);
  }

  /** Steps through the changed nodes (-1 = previous, +1 = next). */
  stepNode(direction: number) {
    const count = this.nodeGroups.length;
    if (count === 0) {
      return;
    }
    const index = this.nodeGroups.findIndex((g) => g.nodeId === this.selectedNodeId);
    this.selectNode(this.nodeGroups[(index + direction + count) % count].nodeId);
  }

  getSelectedNodeIndex(): number {
    return this.nodeGroups.findIndex((g) => g.nodeId === this.selectedNodeId);
  }

  apply() {
    if (this.selectedSolution === undefined) {
      return;
    }
    this.committed = true;
    this.undoService.startUndoRecording();
    this.undoService.pushCurrentVersion(true);
    this.dialogRef?.close();
  }

  cancel() {
    this.dialogRef?.close();
  }

  getFieldLabel(change: TimeChange): string {
    switch (change.field) {
      case "sourceDeparture":
        return $localize`:@@app.view.dialogs.optimize-timetable-dialog.field.departure:Departure ${change.sourceNodeName}:node:`;
      case "sourceArrival":
        return $localize`:@@app.view.dialogs.optimize-timetable-dialog.field.arrival:Arrival ${change.sourceNodeName}:node:`;
      case "targetDeparture":
        return $localize`:@@app.view.dialogs.optimize-timetable-dialog.field.departure:Departure ${change.targetNodeName}:node:`;
      case "targetArrival":
        return $localize`:@@app.view.dialogs.optimize-timetable-dialog.field.arrival:Arrival ${change.targetNodeName}:node:`;
      case "travelTime":
        return $localize`:@@app.view.dialogs.optimize-timetable-dialog.field.travel-time:Travel time`;
      case "backwardTravelTime":
        return $localize`:@@app.view.dialogs.optimize-timetable-dialog.field.backward-travel-time:Travel time (return)`;
      default:
        return change.field;
    }
  }

  getChangeMinute(change: TimeChange): string {
    return this.isTimeField(change) ? this.formatValue(((change.newValue % 60) + 60) % 60) : "";
  }

  formatValue(value: number): string {
    return (Math.round(value * 100) / 100).toString();
  }

  formatSigned(value: number): string {
    const rounded = Math.round(value * 100) / 100;
    return rounded > 0 ? `+${rounded}` : `${rounded}`;
  }

  private isTimeField(change: TimeChange): boolean {
    return change.field !== "travelTime" && change.field !== "backwardTravelTime";
  }

  /**
   * Groups the changes by the node where the time changes (sorted by node name),
   * inside a node by the new minute ascending; travel time changes are listed
   * at the source node after the times.
   */
  private groupChangesByNode(changes: TimeChange[]): NodeChangeGroup[] {
    const groups = new Map<number, NodeChangeGroup>();
    changes.forEach((change) => {
      const atSource = change.field.startsWith("source") || !this.isTimeField(change);
      const nodeId = atSource ? change.sourceNodeId : change.targetNodeId;
      const nodeName = atSource ? change.sourceNodeName : change.targetNodeName;
      if (!groups.has(nodeId)) {
        groups.set(nodeId, {nodeId, nodeName, changes: []});
      }
      groups.get(nodeId).changes.push(change);
    });
    const sortKey = (c: TimeChange) =>
      this.isTimeField(c) ? ((c.newValue % 60) + 60) % 60 : 60 + c.newValue;
    const result = [...groups.values()];
    result.forEach((g) =>
      g.changes.sort(
        (a, b) => sortKey(a) - sortKey(b) || a.trainrunName.localeCompare(b.trainrunName),
      ),
    );
    return result.sort((a, b) => a.nodeName.localeCompare(b.nodeName));
  }

  private runOptimization(startAssignment: Record<string, number>) {
    this.revertPreview();
    this.result = this.optimizeTimetableService.optimize(
      this.nodeService.getNodes(),
      this.trainrunSectionService.getTrainrunSections(),
      {
        maxTracksPerSection: this.maxTracks,
        selectedNodeIds: this.nodeService.getSelectedNodes().map((n) => n.getId()),
        seed: this.seed,
        startAssignment,
        policy: this.policy,
      },
    );
    this.selectedSolution = undefined;
    this.nodeGroups = [];
    this.occupancyBefore = undefined;
    this.occupancyAfter = undefined;
    this.baselineOccupancy.clear();
    const changedNodeIds = new Set(
      this.result.solutions.flatMap((solution) =>
        this.groupChangesByNode(solution.changes).map((group) => group.nodeId),
      ),
    );
    changedNodeIds.forEach((nodeId) => {
      this.baselineOccupancy.set(
        nodeId,
        this.occupancyPreparation.getSnapshot(this.nodeService.getNodeFromId(nodeId)),
      );
    });
    if (this.result.solutions.length > 0) {
      this.selectSolution(this.result.solutions[0]);
    }
  }

  /** Shows a proposal in the Netzgrafik (reverted on cancel). */
  private preview(solution: OptimizeTimetableSolution) {
    this.revertPreview();
    this.optimizeTimetableService.applySolution(
      solution,
      this.trainrunSectionService.getTrainrunSections(),
    );
    this.previewSolution = solution;
    this.refreshNetzgrafik(solution);
  }

  private revertPreview() {
    if (this.previewSolution === undefined) {
      return;
    }
    const solution = this.previewSolution;
    this.previewSolution = undefined;
    this.optimizeTimetableService.revertSolution(
      solution,
      this.trainrunSectionService.getTrainrunSections(),
    );
    this.refreshNetzgrafik(solution);
  }

  private refreshNetzgrafik(solution: OptimizeTimetableSolution) {
    this.optimizeTimetableService
      .getChangedTrainrunSectionIds(solution)
      .forEach((id) => this.trainrunService.propagateConsecutiveTimesForTrainrun(id));
    this.nodeService.validateAllConnections();
    this.trainrunService.trainrunsUpdated();
    this.trainrunSectionService.trainrunSectionsUpdated();
    this.nodeService.nodesUpdated();
    this.nodeService.connectionsUpdated();
  }

  private onClosed() {
    if (!this.committed) {
      this.revertPreview();
      this.undoService.startUndoRecording();
    }
    this.previewSolution = undefined;
    this.dialogRef = undefined;
  }
}

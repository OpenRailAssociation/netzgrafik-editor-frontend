import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  TemplateRef,
  ViewChild,
} from "@angular/core";
import {SbbDialog, SbbDialogConfig, type SbbDialogRef} from "@sbb-esta/angular/dialog";
import {SbbTableDataSource} from "@sbb-esta/angular/table";
import {Subject} from "rxjs";
import {take, takeUntil} from "rxjs/operators";
import {I18nService} from "../../../core/i18n/i18n.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {NodeService} from "../../../services/data/node.service";
import {TrainrunService} from "../../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../../services/data/trainrunsection.service";
import {UndoService} from "../../../services/data/undo.service";
import {optimizationEdgeId} from "../../../services/optimization/optimize-timetable.chains";
import {OptimizeTimetableService} from "../../../services/optimization/optimize-timetable.service";
import {OptimizationPolicyService} from "../../../services/optimization/optimization-policy.service";
import {
  createDefaultOptimizationPolicy,
  OptimizationPolicy,
} from "../../../services/optimization/optimization-policy.model";
import {
  compareSolutions,
  solutionSoftCost,
} from "../../../services/optimization/optimization-solution-comparator";
import {SearchProgress} from "../../../services/optimization/optimize-timetable.search";
import {
  EdgeTrackKpi,
  ImmutableTrackConflict,
  OptimizeTimetableKpi,
  OptimizeTimetableOptions,
  OptimizeTimetableResult,
  OptimizeTimetableSolution,
  TimeChange,
  TrackConflictBlockerReason,
} from "../../../services/optimization/optimize-timetable.model";

import {ResourceService} from "../../../services/data/resource.service";
import {InfrastructureEstimatorService} from "../../../services/infrastructure/infrastructure-estimator.service";
import {FilterService} from "../../../services/ui/filter.service";
import {ConfirmationDialogParameter} from "../confirmation-dialog/confirmation-dialog.component";
import {
  KnotenAuslastungDataPreparation,
  KnotenAuslastungSnapshot,
} from "../../knoten-auslastung-view/knoten.auslastung.data.preparation";

const SEARCH_TIME_BUDGETS_MS = [4000, 8000, 16000, 32000, 64000] as const;

export interface NodeChangeGroup {
  nodeId: number;
  nodeName: string;
  changes: TimeChange[];
  changedTrainrunCount: number;
  expanded: boolean;
}

interface SectionTrackEdgeRow extends EdgeTrackKpi {
  changed: boolean;
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

  policy: OptimizationPolicy = createDefaultOptimizationPolicy();
  selectedNodeCount = 0;
  selectedSectionCount = 0;
  scopeUsesSelectedTrainrun = false;
  result: OptimizeTimetableResult = undefined;
  isOptimizing = false;
  isGeneratingDiagnostics = false;
  optimizationProgressPercent = 0;
  optimizationIterations = 0;
  liveSolution: OptimizeTimetableSolution = undefined;
  searchEffortLevel = 2;
  readonly searchEffortTicks = [0, 25, 50, 75, 100];
  readonly searchEffortLevelKeys = [
    "app.view.dialogs.optimize-timetable-dialog.search-effort-very-fast",
    "app.view.dialogs.optimize-timetable-dialog.search-effort-fast",
    "app.view.dialogs.optimize-timetable-dialog.search-effort-balanced",
    "app.view.dialogs.optimize-timetable-dialog.search-effort-thorough",
    "app.view.dialogs.optimize-timetable-dialog.search-effort-very-thorough",
  ];
  showTrackOverview = true;
  trackOverviewExpanded = true;
  resultsPanelExpanded = false;
  infeasibleSolutionsExpanded = false;
  showAllSectionTracks = false;
  isConfirmingInvalidApply = false;
  selectedSolution: OptimizeTimetableSolution = undefined;
  nodeGroups: NodeChangeGroup[] = [];
  selectedNodeId: number = undefined;
  hoveredTrainrunId: number | null = null;
  occupancyBefore: KnotenAuslastungSnapshot = undefined;
  occupancyAfter: KnotenAuslastungSnapshot = undefined;
  readonly trackOverviewColumns = ["fromNodeName", "toNodeName", "tracksBefore", "topology"];
  readonly sectionTrackDataSource = new SbbTableDataSource<SectionTrackEdgeRow>([]);
  sectionTrackSort: {active: string; direction: "asc" | "desc" | ""} = {
    active: "tracksAfter",
    direction: "desc",
  };
  readonly trackOverviewDataSource = new SbbTableDataSource<EdgeTrackKpi>([]);
  private trackOverviewSort: {active: string; direction: "asc" | "desc" | ""} = {
    active: "tracksBefore",
    direction: "desc",
  };
  private readonly baselineOccupancy = new Map<number, KnotenAuslastungSnapshot>();
  private readonly occupancyPreparation: KnotenAuslastungDataPreparation;
  private storedPolicy: OptimizationPolicy;
  private resultPolicySnapshot: string;

  private previewSolution: OptimizeTimetableSolution = undefined;
  private scopeNodeIds: number[] = [];
  private scopeCorridorEdgeIds: string[] = [];
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
    private readonly filterService: FilterService,
    private readonly ngZone: NgZone,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly translateService: I18nService,
  ) {
    this.policy = this.optimizationPolicyService.policy;
    this.storedPolicy = this.policy;
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
    const feasible = this.allSolutions
      .filter((solution) => solution.valid)
      .sort((a, b) => compareSolutions(a, b, this.policy))
      .slice(0, 5);
    return this.infeasibleSolutionsExpanded ? [...feasible, ...this.infeasibleSolutions] : feasible;
  }

  get infeasibleSolutions(): OptimizeTimetableSolution[] {
    return this.allSolutions
      .filter((solution) => !solution.valid)
      .sort(
        (a, b) =>
          Number(b.diagnosticOnly ?? false) - Number(a.diagnosticOnly ?? false) ||
          compareSolutions(a, b, this.policy),
      )
      .slice(0, 5);
  }

  get sectionTrackColumns(): string[] {
    return [
      "section",
      "tracksBefore",
      "topologyBefore",
      "tracksAfter",
      "topologyAfter",
      ...(this.showAllSectionTracks ? ["changed"] : []),
    ];
  }

  sortSectionTrackOverview(sort: {active: string; direction: "asc" | "desc" | ""}): void {
    this.sectionTrackSort = sort;
    this.refreshSectionTrackOverview();
  }

  setShowAllSectionTracks(showAll: boolean): void {
    this.showAllSectionTracks = showAll;
    this.sectionTrackSort = showAll
      ? {active: "changed", direction: "desc"}
      : {active: "tracksAfter", direction: "desc"};
    this.refreshSectionTrackOverview();
  }

  get hasFeasibleSolution(): boolean {
    return this.allSolutions.some((solution) => solution.valid);
  }

  get feasibleSolutionCount(): number {
    return this.allSolutions.filter((solution) => solution.valid).length;
  }

  private get allSolutions(): OptimizeTimetableSolution[] {
    return [
      ...new Map(
        [
          ...(this.result?.solutions ?? []),
          ...(this.result?.infeasibleSolutions ?? []),
          ...(this.result?.diagnosticSolutions ?? []),
        ].map((solution) => [this.assignmentKey(solution.assignment), solution]),
      ).values(),
    ];
  }

  setInfeasibleSolutionsExpanded(expanded: boolean): void {
    this.infeasibleSolutionsExpanded = expanded;
    if (!expanded && this.selectedSolution?.valid === false) {
      this.selectBaseline();
    }
  }

  getSoftCost(kpi: OptimizeTimetableKpi): number {
    return solutionSoftCost({kpi}, this.policy);
  }

  get maxTracks(): number {
    return (
      this.policy.hardConstraints.find((constraint) => constraint.id === "trackLimit")?.value ?? 2
    );
  }

  get trackLimitEnabled(): boolean {
    return (
      this.policy.hardConstraints.find((constraint) => constraint.id === "trackLimit")?.enabled ??
      false
    );
  }

  get hasOutdatedResults(): boolean {
    return (
      this.result !== undefined &&
      this.resultPolicySnapshot !== undefined &&
      this.resultPolicySnapshot !== JSON.stringify(this.policy)
    );
  }

  get immutableTrackConflicts(): ImmutableTrackConflict[] {
    return this.hasOutdatedResults ? [] : (this.result?.immutableTrackConflicts ?? []);
  }

  get hasUnstoredPolicyChanges(): boolean {
    return JSON.stringify(this.policy) !== JSON.stringify(this.storedPolicy);
  }

  get searchEffortLabelKey(): string {
    return this.searchEffortLevelKeys[this.searchEffortLevel];
  }

  get searchEffortPercent(): number {
    return (this.searchEffortLevel / (SEARCH_TIME_BUDGETS_MS.length - 1)) * 100;
  }

  get searchTimeBudgetMs(): number {
    return SEARCH_TIME_BUDGETS_MS[this.searchEffortLevel] ?? 1000;
  }

  setSearchEffortLevel(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.setSearchEffortStep(Number(target.value));
  }

  setSearchEffortStep(level: number): void {
    if (!Number.isInteger(level) || level < 0 || level >= SEARCH_TIME_BUDGETS_MS.length) {
      return;
    }
    this.searchEffortLevel = level;
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
    this.refreshTrackOverview();
  }

  sortTrackOverview(sort: {active: string; direction: "asc" | "desc" | ""}): void {
    this.trackOverviewSort = sort;
    this.refreshTrackOverview();
  }

  openTrackOverview(): void {
    this.trackOverviewExpanded = true;
    this.resultsPanelExpanded = false;
  }

  openResultsPanel(): void {
    this.resultsPanelExpanded = true;
    this.trackOverviewExpanded = false;
  }

  selectBaseline(): void {
    this.revertPreview();
    this.selectedSolution = undefined;
    this.nodeGroups = [];
    this.selectedNodeId = undefined;
    this.occupancyBefore = undefined;
    this.occupancyAfter = undefined;
    this.showAllSectionTracks = false;
    this.sectionTrackSort = {active: "tracksAfter", direction: "desc"};
    this.refreshSectionTrackOverview();
    this.refreshTrackOverview();
  }

  storePolicy(): void {
    this.policy = this.optimizationPolicyService.storePolicy(this.policy);
    this.storedPolicy = this.policy;
  }

  resetRanking(): void {
    this.onPolicyChange(createDefaultOptimizationPolicy());
  }

  private revalidateSolutions(): void {
    if (this.result === undefined) {
      return;
    }
    const selected = this.selectedSolution;
    this.revertPreview();
    const options = {
      maxTracksPerSection: this.maxTracks,
      selectedNodeIds: this.scopeNodeIds,
      selectedCorridorEdgeIds: this.scopeUsesSelectedTrainrun
        ? this.scopeCorridorEdgeIds
        : undefined,
      policy: this.policy,
    };
    this.result.baselineKpi.edgesOverLimitBefore = this.result.baselineEdges.filter(
      (edge) => edge.inScope && edge.tracksBefore > this.maxTracks,
    ).length;
    this.result.baselineKpi.edgesOverLimitAfter = this.result.baselineKpi.edgesOverLimitBefore;
    const hadFeasible = this.allSolutions.some((solution) => solution.valid);
    this.allSolutions.forEach((solution) => {
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
      solution.valid =
        !solution.diagnosticOnly &&
        this.optimizeTimetableService.isSolutionValid(
          solution,
          this.getVisibleNodes(),
          this.getVisibleTrainrunSections(),
          options,
          this.result.baselineEdges,
        );
    });
    if (this.allSolutions.some((solution) => solution.valid)) {
      this.result.message = undefined;
      if (!hadFeasible) this.infeasibleSolutionsExpanded = false;
    }
    if (selected !== undefined && this.rankedSolutions.includes(selected)) {
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
    this.infeasibleSolutionsExpanded = false;
    this.resultPolicySnapshot = undefined;
    this.selectedSolution = undefined;
    this.nodeGroups = [];
    this.selectedNodeId = undefined;
    this.occupancyBefore = undefined;
    this.occupancyAfter = undefined;
    this.baselineOccupancy.clear();
    this.previewSolution = undefined;
    this.committed = false;
    this.seed = 1;
    const selectedTrainrun = this.trainrunService.getSelectedTrainrun();
    const trainrunScope = selectedTrainrun
      ? this.getTrainrunScope(selectedTrainrun.getId())
      : {nodeIds: [], edgeIds: []};
    this.scopeUsesSelectedTrainrun = trainrunScope.edgeIds.length > 0;
    this.scopeCorridorEdgeIds = this.scopeUsesSelectedTrainrun ? trainrunScope.edgeIds : [];
    this.scopeNodeIds = this.scopeUsesSelectedTrainrun
      ? trainrunScope.nodeIds
      : this.nodeService
          .getSelectedNodes()
          .filter((node) => this.filterService.filterNode(node))
          .map((node) => node.getId());
    this.trackOverviewSort = {active: "tracksBefore", direction: "desc"};
    this.showTrackOverview = true;
    this.trackOverviewExpanded = true;
    this.resultsPanelExpanded = false;
    this.selectedNodeCount = this.scopeNodeIds.length;
    this.selectedSectionCount = this.scopeCorridorEdgeIds.length;
    this.refreshTrackOverview();
    this.undoService.pauseUndoRecording();

    const config = new SbbDialogConfig();
    config.width = "1600px";
    config.maxWidth = "98vw";
    config.height = "90vh";
    config.maxHeight = "90vh";
    config.id = "OptimizeTimetableDialogId";
    this.dialogRef = this.dialog.open(this.optimizeTimetableDialogTemplate, config);
    this.dialogRef.afterClosed().subscribe(() => this.onClosed());
  }

  async optimize(): Promise<void> {
    await this.optimizeWithEngine("heuristic");
  }

  async optimizeCpSat(): Promise<void> {
    await this.optimizeWithEngine("cp-sat");
  }

  private async optimizeWithEngine(engine: "heuristic" | "cp-sat"): Promise<void> {
    if (this.isOptimizing) {
      return;
    }
    this.seed = 1;
    await this.runWithProgress(async () => {
      const startedAt = performance.now();
      await this.runOptimization(undefined, this.searchTimeBudgetMs, engine);
      if (this.result !== undefined) {
        this.result.runtimeMs = performance.now() - startedAt;
      }
    });
  }

  /** Adds another time budget to the current search session. */
  async continueOptimization(): Promise<void> {
    if (
      this.isOptimizing ||
      !this.result ||
      this.result.freeVariables === 0 ||
      this.result.searchExhausted ||
      this.hasOutdatedResults
    ) {
      return;
    }
    const result = this.result;
    const startAssignment = this.selectedSolution?.assignment;
    await this.runWithProgress(async () => {
      this.revertPreview();
      const startedAt = performance.now();
      await this.optimizeTimetableService.continueSearch(
        result,
        this.searchTimeBudgetMs,
        (progress) => this.updateProgress(progress),
      );
      result.runtimeMs += performance.now() - startedAt;
      this.updateResultView(startAssignment);
    }, result.iterations);
  }

  selectSolution(solution: OptimizeTimetableSolution) {
    this.selectedSolution = solution;
    this.refreshSectionTrackOverview();
    this.preview(solution);
    this.nodeGroups = this.groupChangesByNode(solution.changes);
    const keep = this.nodeGroups.some((g) => g.nodeId === this.selectedNodeId);
    this.selectNode(keep ? this.selectedNodeId : this.nodeGroups[0]?.nodeId);
    this.refreshTrackOverview();
  }

  selectNode(nodeId: number) {
    this.selectedNodeId = nodeId;
    this.hoveredTrainrunId = null;
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
    const solution = this.selectedSolution;
    if (
      solution === undefined ||
      !this.rankedSolutions.includes(solution) ||
      this.isOptimizing ||
      this.isConfirmingInvalidApply ||
      this.hasOutdatedResults
    ) {
      return;
    }
    if (solution.valid) {
      this.commitSelectedSolution();
      return;
    }

    this.isConfirmingInvalidApply = true;
    const confirmation = new ConfirmationDialogParameter(
      this.translateService.translate(
        "app.view.dialogs.optimize-timetable-dialog.invalid-proposal-confirm-title",
      ),
      this.translateService.translate(
        "app.view.dialogs.optimize-timetable-dialog.invalid-proposal-confirm-content",
      ),
      this.translateService.translate(
        "app.view.dialogs.optimize-timetable-dialog.invalid-proposal-confirm-apply",
      ),
      this.translateService.translate(
        "app.view.dialogs.optimize-timetable-dialog.invalid-proposal-confirm-cancel",
      ),
    );
    this.uiInteractionService
      .showConfirmationDiagramDialog(confirmation)
      .pipe(take(1), takeUntil(this.destroyed))
      .subscribe((confirmed) => {
        this.isConfirmingInvalidApply = false;
        if (
          confirmed &&
          this.selectedSolution === solution &&
          !this.isOptimizing &&
          !this.hasOutdatedResults
        ) {
          this.commitSelectedSolution();
        }
      });
  }

  private commitSelectedSolution(): void {
    this.committed = true;
    this.undoService.startUndoRecording();
    this.undoService.pushCurrentVersion(true);
    this.dialogRef?.close();
  }

  getTrackConflictReasonLabel(reason: TrackConflictBlockerReason): string {
    const keyPrefix = "app.view.dialogs.optimize-timetable-dialog.analysis";
    return this.translateService.translate(`${keyPrefix}.reason.${reason}`);
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

  getFieldAbbreviationKey(change: TimeChange): string | undefined {
    switch (change.field) {
      case "sourceDeparture":
      case "targetDeparture":
        return "app.view.dialogs.optimize-timetable-dialog.field.departure-short";
      case "sourceArrival":
      case "targetArrival":
        return "app.view.dialogs.optimize-timetable-dialog.field.arrival-short";
      default:
        return undefined;
    }
  }

  getFieldNodeName(change: TimeChange): string {
    switch (change.field) {
      case "sourceDeparture":
      case "sourceArrival":
        return change.targetNodeName;
      case "targetDeparture":
      case "targetArrival":
        return change.sourceNodeName;
      default:
        return "";
    }
  }

  getChangeMinute(change: TimeChange): string {
    return this.isTimeField(change) ? this.formatValue(((change.newValue % 60) + 60) % 60) : "";
  }

  getChangeDelta(change: TimeChange): number {
    const difference = change.newValue - change.oldValue;
    if (!this.isTimeField(change)) {
      return difference;
    }
    const wrapped = ((difference % 60) + 60) % 60;
    return wrapped > 30 ? wrapped - 60 : wrapped;
  }

  getTrainrunColor(trainrunId: number): string {
    const colorRef = this.trainrunService.getTrainrunFromId(trainrunId)?.getCategoryColorRef();
    return colorRef ? `var(--COLOR_VARIABLE_ColorRef_${colorRef}, currentColor)` : "currentColor";
  }

  highlightTrainrun(trainrunId: number, nodeId?: number): void {
    if (nodeId !== undefined && nodeId !== this.selectedNodeId) {
      return;
    }
    this.hoveredTrainrunId = trainrunId;
  }

  setTrainrunHighlight(trainrunId: number | null): void {
    this.hoveredTrainrunId = trainrunId;
  }

  clearTrainrunHighlight(trainrunId: number, nodeId?: number): void {
    if (
      (nodeId === undefined || nodeId === this.selectedNodeId) &&
      this.hoveredTrainrunId === trainrunId
    ) {
      this.hoveredTrainrunId = null;
    }
  }

  formatValue(value: number): string {
    return (Math.round(value * 100) / 100).toString();
  }

  formatSigned(value: number): string {
    const usesFlexibilityProfile = [
      "flexibilityFrequencyFirst",
      "flexibilityCategoryFirst",
    ].includes(this.policy.directorProfile);
    const decimalPlaces = usesFlexibilityProfile ? 1 : 2;
    const factor = 10 ** decimalPlaces;
    const rounded = Math.round(value * factor) / factor;
    const formatted = decimalPlaces === 1 ? rounded.toFixed(1) : `${rounded}`;
    return rounded > 0 ? `+${formatted}` : formatted;
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
        groups.set(nodeId, {
          nodeId,
          nodeName,
          changes: [],
          changedTrainrunCount: 0,
          expanded: false,
        });
      }
      groups.get(nodeId).changes.push(change);
    });
    const sortKey = (c: TimeChange) =>
      this.isTimeField(c) ? ((c.newValue % 60) + 60) % 60 : 60 + c.newValue;
    const result = [...groups.values()];
    result.forEach((g) => {
      g.changes.sort(
        (a, b) => sortKey(a) - sortKey(b) || a.trainrunName.localeCompare(b.trainrunName),
      );
      g.changedTrainrunCount = new Set(g.changes.map((change) => change.trainrunId)).size;
    });
    return result.sort((a, b) => a.nodeName.localeCompare(b.nodeName));
  }

  private async runWithProgress(
    operation: () => Promise<void>,
    initialIterations = 0,
  ): Promise<void> {
    this.isOptimizing = true;
    this.isGeneratingDiagnostics = false;
    this.optimizationProgressPercent = 0;
    this.optimizationIterations = initialIterations;
    this.liveSolution = undefined;
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      await this.ngZone.runOutsideAngular(operation);
      this.optimizationProgressPercent = 100;
    } finally {
      this.isGeneratingDiagnostics = false;
      this.isOptimizing = false;
      this.changeDetectorRef.detectChanges();
    }
  }

  private async runOptimization(
    startAssignment: Record<string, number> | undefined,
    timeBudgetMs: number,
    engine: "heuristic" | "cp-sat" = "heuristic",
  ): Promise<void> {
    this.revertPreview();
    this.resultPolicySnapshot = JSON.stringify(this.policy);
    this.optimizationProgressPercent = 0;
    this.optimizationIterations = 0;
    this.result = undefined;
    this.infeasibleSolutionsExpanded = false;
    const nodes = this.getVisibleNodes();
    const trainrunSections = this.getVisibleTrainrunSections();
    const options: OptimizeTimetableOptions = {
      maxTracksPerSection: this.maxTracks,
      selectedNodeIds: this.scopeNodeIds,
      selectedCorridorEdgeIds: this.scopeUsesSelectedTrainrun
        ? this.scopeCorridorEdgeIds
        : undefined,
      timeBudgetMs,
      seed: this.seed,
      startAssignment,
      engine,
      policy: this.policy,
      debugTrace: true,
    };
    this.result = await this.optimizeTimetableService.optimize(
      nodes,
      trainrunSections,
      options,
      (progress) => this.updateProgress(progress),
    );
    this.updateResultView();

    if (
      this.result.immutableTrackConflicts?.length &&
      !this.result.solutions.some((solution) => solution.valid)
    ) {
      const baseIterations = this.result.iterations;
      this.isGeneratingDiagnostics = true;
      this.optimizationProgressPercent = 0;
      this.optimizationIterations = baseIterations;
      this.liveSolution = undefined;
      this.changeDetectorRef.detectChanges();

      const diagnosticPolicy: OptimizationPolicy = {
        ...this.policy,
        hardConstraints: this.policy.hardConstraints.map((constraint) => ({
          ...constraint,
          enabled:
            constraint.id === "timeLocks" || constraint.id === "travelTimeLocks"
              ? false
              : constraint.enabled,
        })),
      };
      const diagnosticResult = await this.optimizeTimetableService.optimize(
        nodes,
        trainrunSections,
        {
          ...options,
          selectedNodeIds: [],
          selectedCorridorEdgeIds: undefined,
          timeBudgetMs: Math.max(250, Math.floor(timeBudgetMs / 2)),
          startAssignment: this.result.searchBestAssignment,
          seed: this.seed + 1,
          policy: diagnosticPolicy,
        },
        (progress) =>
          this.updateProgress({
            ...progress,
            iterations: baseIterations + progress.iterations,
            solution: undefined,
            solutions: undefined,
            infeasibleSolutions: undefined,
          }),
      );
      const diagnosticCandidates = new Map(
        [...diagnosticResult.solutions, ...(diagnosticResult.infeasibleSolutions ?? [])]
          .filter((solution) => solution.changes.length > 0)
          .map((solution) => [this.assignmentKey(solution.assignment), solution]),
      );
      this.result.diagnosticSolutions = [...diagnosticCandidates.values()]
        .sort((first, second) => compareSolutions(first, second, this.policy))
        .slice(0, 5)
        .map((solution, index) => ({
          ...solution,
          id: this.result.solutions.length + index,
          valid: false,
          diagnosticOnly: true,
        }));
      this.result.iterations += diagnosticResult.iterations;
      this.result.evaluatedCandidates += diagnosticResult.evaluatedCandidates;
      this.result.runtimeMs += diagnosticResult.runtimeMs;
      this.updateResultView();
    }
  }

  private updateProgress(progress: SearchProgress): void {
    this.optimizationProgressPercent = Math.min(100, Math.floor(progress.fraction * 100));
    this.optimizationIterations = progress.iterations;
    this.liveSolution = progress.solution ?? this.liveSolution;
    if (this.result !== undefined && progress.solutions !== undefined) {
      const hadFeasible = this.allSolutions.some((solution) => solution.valid);
      const candidates = new Map(
        [...this.allSolutions, ...progress.solutions, ...(progress.infeasibleSolutions ?? [])].map(
          (solution) => [this.assignmentKey(solution.assignment), solution],
        ),
      );
      const solutions = [...candidates.values()];
      const feasible = solutions.filter((solution) => solution.valid);
      this.result.infeasibleSolutions = solutions
        .filter((solution) => !solution.valid)
        .sort((first, second) => compareSolutions(first, second, this.policy))
        .slice(0, 5);
      this.result.solutions = (feasible.length > 0 ? feasible : solutions)
        .sort((first, second) => compareSolutions(first, second, this.policy))
        .slice(0, 5)
        .map((solution, id) => ({
          ...solution,
          id,
          label: $localize`:@@app.services.optimization.proposal.candidate:Candidate ${id + 1}`,
        }));
      if (feasible.length > 0) {
        this.result.message = undefined;
        if (!hadFeasible) {
          this.infeasibleSolutionsExpanded = false;
          this.selectedSolution = undefined;
          this.nodeGroups = [];
          this.occupancyBefore = undefined;
          this.occupancyAfter = undefined;
        }
      }
    }
    this.changeDetectorRef.detectChanges();
  }

  private updateResultView(preferredAssignment?: Record<string, number>): void {
    this.trackOverviewExpanded = false;
    this.resultsPanelExpanded = true;
    this.selectedSolution = undefined;
    this.refreshTrackOverview();
    this.nodeGroups = [];
    this.occupancyBefore = undefined;
    this.occupancyAfter = undefined;
    this.baselineOccupancy.clear();
    const changedNodeIds = new Set(
      this.allSolutions.flatMap((solution) =>
        this.groupChangesByNode(solution.changes).map((group) => group.nodeId),
      ),
    );
    changedNodeIds.forEach((nodeId) => {
      this.baselineOccupancy.set(
        nodeId,
        this.occupancyPreparation.getSnapshot(this.nodeService.getNodeFromId(nodeId)),
      );
    });
    const feasible = this.rankedSolutions.filter((solution) => solution.valid);
    if (feasible.length > 0) {
      const preferredKey =
        preferredAssignment === undefined ? undefined : this.assignmentKey(preferredAssignment);
      const preferredSolution =
        preferredKey === undefined
          ? undefined
          : feasible.find((solution) => this.assignmentKey(solution.assignment) === preferredKey);
      this.selectSolution(preferredSolution ?? feasible[0]);
    }
  }

  private assignmentKey(assignment: Record<string, number>): string {
    return JSON.stringify(
      Object.entries(assignment).sort(([first], [second]) => first.localeCompare(second)),
    );
  }

  private getTrainrunScope(trainrunId: number): {nodeIds: number[]; edgeIds: string[]} {
    const nodeIds = new Set<number>();
    const edgeIds = new Set<string>();
    this.getVisibleTrainrunSections()
      .filter((section) => section.getTrainrunId() === trainrunId)
      .forEach((section) => {
        const sourceNode = section.getSourceNode();
        const targetNode = section.getTargetNode();
        if (sourceNode === undefined || targetNode === undefined) {
          return;
        }
        nodeIds.add(sourceNode.getId());
        nodeIds.add(targetNode.getId());
        edgeIds.add(optimizationEdgeId(sourceNode.getId(), targetNode.getId()));
      });
    return {nodeIds: [...nodeIds], edgeIds: [...edgeIds]};
  }

  private getVisibleNodes() {
    return this.nodeService.getNodes().filter((node) => this.filterService.filterNode(node));
  }

  private getVisibleTrainrunSections() {
    return this.trainrunSectionService
      .getTrainrunSections()
      .filter((section) => this.filterService.filterTrainrunsection(section));
  }

  private refreshTrackOverview(): void {
    const baselineEdges =
      this.result?.baselineEdges ??
      this.optimizeTimetableService.estimateBaselineEdges(
        this.getVisibleNodes(),
        this.getVisibleTrainrunSections(),
        {
          maxTracksPerSection: this.maxTracks,
          selectedNodeIds: this.scopeNodeIds,
          selectedCorridorEdgeIds: this.scopeUsesSelectedTrainrun
            ? this.scopeCorridorEdgeIds
            : undefined,
          policy: this.policy,
        },
      );
    const rows = baselineEdges.filter((edge) => edge.inScope).map((edge) => ({...edge}));

    if (this.trackOverviewSort.direction !== "") {
      const direction = this.trackOverviewSort.direction === "asc" ? 1 : -1;
      const key = this.trackOverviewSort.active as keyof EdgeTrackKpi;
      rows.sort((left, right) => {
        const leftValue = left[key];
        const rightValue = right[key];
        const comparison =
          typeof leftValue === "number" && typeof rightValue === "number"
            ? leftValue - rightValue
            : String(leftValue).localeCompare(String(rightValue));
        return comparison * direction;
      });
    }
    this.trackOverviewDataSource.data = rows;
  }

  private refreshSectionTrackOverview(): void {
    const baselineEdges = (this.result?.baselineEdges ?? []).filter((edge) => edge.inScope);
    const solutionEdges = (this.selectedSolution?.edges ?? []).filter((edge) => edge.inScope);
    const solutionEdgesById = new Map(solutionEdges.map((edge) => [edge.edgeId, edge]));
    const baselineById = new Map(baselineEdges.map((edge) => [edge.edgeId, edge]));
    const sourceEdges = [
      ...new Map([...baselineEdges, ...solutionEdges].map((edge) => [edge.edgeId, edge])).values(),
    ];
    const rows: SectionTrackEdgeRow[] = sourceEdges.map((source) => {
      const baseline = baselineById.get(source.edgeId) ?? source;
      const candidate = solutionEdgesById.get(source.edgeId);
      const trackSegmentsBefore = candidate?.trackSegmentsBefore ?? baseline.trackSegments ?? [];
      const trackSegmentsAfter = candidate?.trackSegmentsAfter ?? baseline.trackSegments ?? [];
      const tracksAfter = candidate?.tracksAfter ?? baseline.tracksBefore;
      return {
        ...baseline,
        ...candidate,
        tracksAfter,
        trackSegmentsBefore,
        trackSegmentsAfter,
        changed:
          baseline.tracksBefore !== tracksAfter ||
          this.trackSegmentsDiffer(trackSegmentsBefore, trackSegmentsAfter),
      };
    });
    const visibleRows = this.showAllSectionTracks ? rows : rows.filter((row) => row.changed);

    if (this.sectionTrackSort.direction !== "") {
      const direction = this.sectionTrackSort.direction === "asc" ? 1 : -1;
      const key = this.sectionTrackSort.active;
      visibleRows.sort((left, right) => {
        const leftValue =
          key === "changed"
            ? Number(left.changed)
            : key === "section"
              ? `${left.fromNodeName} – ${left.toNodeName}`
              : left[key as keyof SectionTrackEdgeRow];
        const rightValue =
          key === "changed"
            ? Number(right.changed)
            : key === "section"
              ? `${right.fromNodeName} – ${right.toNodeName}`
              : right[key as keyof SectionTrackEdgeRow];
        const comparison =
          typeof leftValue === "number" && typeof rightValue === "number"
            ? leftValue - rightValue
            : String(leftValue).localeCompare(String(rightValue));
        return comparison * direction;
      });
    }

    this.sectionTrackDataSource.data = visibleRows;
  }

  private trackSegmentsDiffer(
    before: {start: number; end: number; tracks: number}[],
    after: {start: number; end: number; tracks: number}[],
  ): boolean {
    return (
      before.length !== after.length ||
      before.some(
        (segment, index) =>
          segment.start !== after[index].start ||
          segment.end !== after[index].end ||
          segment.tracks !== after[index].tracks,
      )
    );
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

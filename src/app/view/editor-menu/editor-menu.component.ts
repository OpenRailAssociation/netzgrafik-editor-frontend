import {Component, OnDestroy, OnInit} from "@angular/core";
import {TrainrunService} from "../../services/data/trainrun.service";
import {NodeService} from "../../services/data/node.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {StammdatenService} from "../../services/data/stammdaten.service";
import {FilterService} from "../../services/ui/filter.service";
import {DataService} from "../../services/data/data.service";
import {Vec2D} from "../../utils/vec2D";
import {EditorMode} from "./editor-mode";
import {LogService} from "../../logger/log.service";
import {AutoSaveService} from "../../services/data/auto-save.service";
import {VersionControlService} from "../../services/data/version-control.service";
import {map, takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {AnalyticsService} from "../../services/analytics/analytics.service";
import {D3Utils} from "../editor-main-view/data-views/d3.utils";
import {ShortestDistanceNode} from "../../services/analytics/algorithms/shortest-distance-node";
import {FilterWindowType} from "../filter-main-side-view/filter-main-side-view.component";
import {NoteService} from "../../services/data/note.service";
import {SbbNotificationToast} from "@sbb-esta/angular/notification-toast";
import {TimeSliderService} from "../../streckengrafik/services/time-slider.service";
import {SliderChangeInfo} from "../../streckengrafik/model/util/sliderChangeInfo";
import {IsTrainrunSelectedService} from "../../services/data/is-trainrun-section.service";
import {Node} from "../../models/node.model";
import {environment} from "../../../environments/environment";

@Component({
  selector: "sbb-editor-menu",
  templateUrl: "./editor-menu.component.html",
  styleUrls: ["./editor-menu.component.scss"],
})
export class EditorMenuComponent implements OnInit, OnDestroy {
  readonly disableBackend = environment.disableBackend;

  public zoomFactor = 100;
  public streckengrafikZoomFactor = 0;
  // Remember the zoom factor for netzgrafik when switching (e.g. to origin-destination).
  public mainZoomFactor = 100;

  public isWritable$ = this.versionControlService.variant$.pipe(map((v) => v?.isWritable));
  public modified$ = this.autoSaveService.modified$;
  public label$ = this.versionControlService.variant$.pipe(map((v) => v?.latestVersion.name));
  private destroyed = new Subject<void>();

  private trainrunIdSelected: number;

  constructor(
    private dataService: DataService,
    private trainrunService: TrainrunService,
    private nodeService: NodeService,
    private noteService: NoteService,
    public filterService: FilterService,
    private trainrunSectionService: TrainrunSectionService,
    private isTrainrunSelectedService: IsTrainrunSelectedService,
    private uiInteractionService: UiInteractionService,
    private stammdatenService: StammdatenService,
    private logger: LogService,
    private versionControlService: VersionControlService,
    private analyticsService: AnalyticsService,
    private autoSaveService: AutoSaveService,
    private _notification: SbbNotificationToast,
    private readonly timeSliderService: TimeSliderService,
  ) {
    this.uiInteractionService.zoomFactorObservable
      .pipe(takeUntil(this.destroyed))
      .subscribe((changedZoomFactor) => {
        this.zoomFactor = changedZoomFactor;
      });

    this.analyticsService.shortestDistanceNode
      .pipe(takeUntil(this.destroyed))
      .subscribe((shortestDistanceNode) => {
        this.updateAnalytics(shortestDistanceNode);
      });

    this.isTrainrunSelectedService
      .getTrainrunIdSelected()
      .pipe(takeUntil(this.destroyed))
      .subscribe((trainrunIdSelected) => {
        this.trainrunIdSelected = trainrunIdSelected;
      });

    this.timeSliderService
      .getSliderChangeObservable()
      .pipe(takeUntil(this.destroyed))
      .subscribe((sliderChangeInfo: SliderChangeInfo) => {
        this.streckengrafikZoomFactor = sliderChangeInfo.zoom;
      });
  }

  ngOnInit(): void {
    this.uiInteractionService.loadActiveTheme();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  getVariantIsWritable(): boolean {
    return this.versionControlService.getVariantIsWritable();
  }

  onZoomIn() {
    if (this.uiInteractionService.getEditorMode() === EditorMode.StreckengrafikEditing) {
      this.timeSliderService.changeZoom(this.streckengrafikZoomFactor + 2.6);
      return;
    }
    const zoomCenter = new Vec2D(0.5, 0.5);
    this.uiInteractionService.zoomIn(zoomCenter);
  }

  onZoom100() {
    if (this.uiInteractionService.getEditorMode() === EditorMode.StreckengrafikEditing) {
      this.timeSliderService.changeZoom(10.4);
      return;
    }
    const zoomCenter = new Vec2D(0.5, 0.5);
    this.uiInteractionService.zoomReset(zoomCenter);
  }

  onZoomOut() {
    if (this.uiInteractionService.getEditorMode() === EditorMode.StreckengrafikEditing) {
      this.timeSliderService.changeZoom(
        Math.min(this.streckengrafikZoomFactor, Math.max(this.streckengrafikZoomFactor - 2.6, 2.6)),
      );
      return;
    }
    const zoomCenter = new Vec2D(0.5, 0.5);
    this.uiInteractionService.zoomOut(zoomCenter);
  }

  getZoomFactor(): number {
    if (this.uiInteractionService.getEditorMode() === EditorMode.StreckengrafikEditing) {
      return Math.round(100 * (this.streckengrafikZoomFactor / 10.4));
    }
    return this.zoomFactor;
  }

  onFilter() {
    if (!this.filterService.isAnyFilterActive()) {
      if (!this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
        this.uiInteractionService.showOrCloseFilter(FilterWindowType.EDITOR_FILTER);
      }
      this.filterService.resetTemporaryDisableFilteringOfItemsInView();
    } else {
      this.filterService.toggleTemporaryDisableFilteringOfItemsInView();
    }
  }

  onTopologieEditor() {
    let editorMode = this.uiInteractionService.getEditorMode();
    if (editorMode === EditorMode.TopologyEditing) {
      editorMode = EditorMode.NetzgrafikEditing;
    } else {
      editorMode = EditorMode.TopologyEditing;
    }
    this.uiInteractionService.setEditorMode(editorMode);
  }

  isTopologyEditing(): boolean {
    return this.uiInteractionService.getEditorMode() === EditorMode.TopologyEditing;
  }

  onNoteEditor() {
    let editorMode = this.uiInteractionService.getEditorMode();
    if (editorMode === EditorMode.NoteEditing) {
      editorMode = EditorMode.NetzgrafikEditing;
    } else {
      editorMode = EditorMode.NoteEditing;
    }
    this.uiInteractionService.setEditorMode(editorMode);
  }

  isNoteEditing(): boolean {
    return this.uiInteractionService.getEditorMode() === EditorMode.NoteEditing;
  }

  isAnalytics(): boolean {
    return this.uiInteractionService.getEditorMode() === EditorMode.Analytics;
  }

  onMultiNodeMoving() {
    let editorMode = this.uiInteractionService.getEditorMode();
    if (editorMode === EditorMode.MultiNodeMoving) {
      editorMode = EditorMode.NetzgrafikEditing;
      this.nodeService.unselectAllNodes();
      this.noteService.unselectAllNotes();
      this.trainrunSectionService.unselectAllTrainrunSections();
    } else {
      editorMode = EditorMode.MultiNodeMoving;
      this.uiInteractionService.closeNodeStammdaten();
    }
    this.uiInteractionService.setEditorMode(editorMode);
  }

  isMultiNodeMoving(): boolean {
    return this.uiInteractionService.getEditorMode() === EditorMode.MultiNodeMoving;
  }

  onStreckengrafik() {
    const editorMode = this.uiInteractionService.getEditorMode();
    this.uiInteractionService.disableMultiSelectedNodesCorridor();
    if (editorMode !== EditorMode.NetzgrafikEditing && editorMode !== EditorMode.MultiNodeMoving) {
      // enforce unselect all nodes
      this.nodeService.unselectAllNodes();
      this.uiInteractionService.showNetzgrafik();
      this.uiInteractionService.setEditorMode(EditorMode.NetzgrafikEditing);
    } else {
      // editor mode is MultiNodeMoving and has at least one node selected
      if (editorMode === EditorMode.MultiNodeMoving) {
        if (!this.isNotStreckengrafikAllowed()) {
          this.uiInteractionService.enableMultiSelectedNodesCorridor();
          const trainruns = this.trainrunService.getTrainruns();
          if (trainruns.length > 0) {
            // select 1st trainrun
            this.trainrunIdSelected = trainruns[0].getId();
            this.trainrunService.setTrainrunAsSelected(this.trainrunIdSelected);
          }
        }
      }
      if (this.trainrunIdSelected) {
        this.isTrainrunSelectedService.setTrainrunIdSelectedByClick(this.trainrunIdSelected);
        this.uiInteractionService.showStreckengrafik();
        this.uiInteractionService.setEditorMode(EditorMode.StreckengrafikEditing);
        return;
      }
      this._notification.open(
        $localize`:@@app.view.editor-menu.errorGraphicTimetable:Graphic timetable cannot be displayed because no trainrun or no nodes have been selected.`,
        {
          type: "error",
          verticalPosition: "top",
          duration: 2000,
        },
      );
    }
  }

  onOriginDestination() {
    const editorMode = this.uiInteractionService.getEditorMode();

    // Check if at least 2 nodes are selected
    const selectedNodes = this.nodeService.getNodes().filter((n: Node) => n.selected());
    if (
      this.uiInteractionService.getEditorMode() === EditorMode.MultiNodeMoving &&
      selectedNodes.length < 2
    ) {
      this._notification.open(
        $localize`:@@app.view.editor-menu.errorOriginDestination:Origin-destination matrix cannot be displayed because less than 2 nodes are selected.`,
        {
          type: "error",
          verticalPosition: "top",
          duration: 2000,
        },
      );
      return;
    }

    // If Node details are open and only one node is selected, unselect the node and compute od for all nodes.
    if (
      this.uiInteractionService.getEditorMode() !== EditorMode.MultiNodeMoving &&
      selectedNodes.length === 1
    ) {
      this.nodeService.unselectAllNodes();
    }

    if (editorMode === EditorMode.OriginDestination) {
      this.nodeService.unselectAllNodes();
      this.uiInteractionService.showNetzgrafik();
      this.uiInteractionService.setEditorMode(EditorMode.NetzgrafikEditing);
      this.zoomFactor = this.mainZoomFactor;
    } else {
      this.uiInteractionService.closeNodeStammdaten();
      this.mainZoomFactor = this.zoomFactor;
      this.uiInteractionService.showOriginDestination();
      this.uiInteractionService.setEditorMode(EditorMode.OriginDestination);
    }
  }

  isOriginDestination(): boolean {
    return this.uiInteractionService.getEditorMode() === EditorMode.OriginDestination;
  }

  getOriginDestinationTitle(): string {
    if (this.isOriginDestination()) {
      return $localize`:@@app.view.editor-menu.closeOriginDestination:Close origin-destination matrix`;
    }
    return $localize`:@@app.view.editor-menu.displayOriginDestination:Display origin-destination matrix`;
  }

  isStreckengrafikEditing(): boolean {
    return this.uiInteractionService.getEditorMode() === EditorMode.StreckengrafikEditing;
  }

  isNotStreckengrafikAllowed(): boolean {
    if (this.uiInteractionService.getEditorMode() === EditorMode.MultiNodeMoving) {
      const nodes = this.nodeService.getNodes().filter((n: Node) => n.selected());
      return nodes.length < 2;
    }
    return this.trainrunService.getSelectedTrainrun() === null;
  }

  updateAnalytics(shortestDistanceNodes: ShortestDistanceNode[]) {
    D3Utils.shortestDistanceRenderer(shortestDistanceNodes);
  }

  onAnalyticsShortestPathVisualisation() {
    let editorMode = this.uiInteractionService.getEditorMode();
    if (editorMode !== EditorMode.Analytics) {
      editorMode = EditorMode.Analytics;
      this.uiInteractionService.closeNodeStammdaten();
      this.uiInteractionService.closePerlenkette();
      this.uiInteractionService.showNetzgrafik();
      this.uiInteractionService.setEditorMode(editorMode);
    } else {
      editorMode = EditorMode.NetzgrafikEditing;
      this.uiInteractionService.setEditorMode(editorMode);
    }
  }
}

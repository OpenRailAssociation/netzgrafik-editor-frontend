import {BehaviorSubject, Observable, Subject} from "rxjs";
import {EditorMode} from "../../view/editor-menu/editor-mode";
import {Injectable, OnDestroy} from "@angular/core";
import {Stammdaten} from "../../models/stammdaten.model";
import {TrainrunDialogParameter} from "../../view/dialogs/trainrun-and-section-dialog/trainrun-and-section-dialog.component";
import {ThemeBase} from "../../view/themes/theme-base";
import {ConfirmationDialogParameter} from "../../view/dialogs/confirmation-dialog/confirmation-dialog.component";
import {FilterService} from "./filter.service";
import {NodeService} from "../data/node.service";
import {StammdatenService} from "../data/stammdaten.service";
import {InformSelectedTrainrunClick, TrainrunSectionService} from "../data/trainrunsection.service";
import {Vec2D} from "../../utils/vec2D";
import {FilterWindowType} from "../../view/filter-main-side-view/filter-main-side-view.component";
import {takeUntil} from "rxjs/operators";
import {ThemeFach} from "../../view/themes/theme-fach";
import {ThemeDefaultUxDark} from "../../view/themes/theme-default-ux-dark";
import {ThemeDefaultUx} from "../../view/themes/theme-default-ux";
import {ThemeGrayDark} from "../../view/themes/theme-gray-dark";
import {ThemeGray} from "../../view/themes/theme-gray";
import {ThemeFachDark} from "../../view/themes/theme-fach-dark";
import {ThemeFachPrint} from "../../view/themes/theme-fach-print";
import {ThemeRegistration} from "../../view/themes/theme-registration";
import {NoteService} from "../data/note.service";
import {NoteDialogParameter} from "../../view/dialogs/note-dialog/note-dialog.component";
import {StreckengrafikRenderingType} from "../../view/themes/streckengrafik-rendering-type";
import {NetzgrafikColoringService} from "../data/netzgrafikColoring.service";
import {MainViewMode} from "../../view/filter-main-side-view/main-view-mode";
import {TrainrunService} from "../data/trainrun.service";
import {Trainrun} from "../../models/trainrun.model";
import {LoadPerlenketteService} from "../../perlenkette/service/load-perlenkette.service";
import {TravelTimeCreationEstimatorType} from "../../view/themes/editor-trainrun-traveltime-creator-type";

export interface ViewboxProperties {
  currentViewBox: string;
  panZoomTop: number;
  panZoomLeft: number;
  panZoomWidth: number;
  panZoomHeight: number;
  zoomFactor: number;
  origWidth: number;
  origHeight: number;
}

@Injectable({
  providedIn: "root",
})
export class UiInteractionService implements OnDestroy {
  updateNodeStammdatenSubject = new Subject<void>();
  readonly updateNodeStammdatenWindow = this.updateNodeStammdatenSubject.asObservable();

  showNodeStammdatenSubject = new Subject<boolean>();
  readonly nodeStammdatenWindow = this.showNodeStammdatenSubject.asObservable();

  showFilterSubject = new Subject<FilterWindowType | null>();
  readonly filterWindow = this.showFilterSubject.asObservable();

  showPerlenketteSubject = new Subject<boolean>();
  readonly perlenketteWindow = this.showPerlenketteSubject.asObservable();

  sendPerlenketteTrainrunSectionClicked = new Subject<number>();
  readonly perlenketteTrainrunSectionClicked =
    this.sendPerlenketteTrainrunSectionClicked.asObservable();

  printGraphikSubject = new Subject<null>();
  readonly printGraphik = this.printGraphikSubject.asObservable();

  showTrainrunDialogSubject = new Subject<TrainrunDialogParameter | null>();
  readonly trainrunDialog = this.showTrainrunDialogSubject.asObservable();

  showNoteDialogSubject = new Subject<NoteDialogParameter>();
  readonly noteDialog = this.showNoteDialogSubject.asObservable();

  showConfirmationDiagramDialogSubject = new Subject<ConfirmationDialogParameter>();
  readonly confirmationDiagramDialog = this.showConfirmationDiagramDialogSubject.asObservable();

  showStammdatenEditDialogSubject = new Subject<Stammdaten[]>();
  readonly stammdatenEditDialog = this.showStammdatenEditDialogSubject.asObservable();

  zoomInSubject = new Subject<Vec2D>();
  readonly zoomInObservable = this.zoomInSubject.asObservable();

  zoomOutSubject = new Subject<Vec2D>();
  readonly zoomOutObservable = this.zoomOutSubject.asObservable();

  zoomResetSubject = new Subject<Vec2D>();
  readonly zoomResetObservable = this.zoomResetSubject.asObservable();

  zoomFactorSubject = new Subject<number>();
  readonly zoomFactorObservable = this.zoomFactorSubject.asObservable();

  themeChanged = new Subject<ThemeBase>();
  readonly themeChangedObservable = this.themeChanged.asObservable();

  setEditorModeSubject = new Subject<number>();
  readonly setEditorModeObservable = this.setEditorModeSubject.asObservable();

  showStreckengrafikSubject = new BehaviorSubject<MainViewMode>(MainViewMode.Netzgrafik);
  readonly streckengrafikWindow = this.showStreckengrafikSubject.asObservable();

  showOriginDestinationSubjet = new BehaviorSubject<MainViewMode>(MainViewMode.Netzgrafik);
  readonly originDestinationWindow = this.showOriginDestinationSubjet.asObservable();

  moveNetzgrafikEditorViewFocalPointSubject = new Subject<Vec2D>();
  readonly moveNetzgrafikEditorViewFocalPointObservable =
    this.moveNetzgrafikEditorViewFocalPointSubject.asObservable();

  private activeTheme: ThemeBase = null;
  private activeStreckengrafikRenderingType: StreckengrafikRenderingType = null;
  private activeTravelTimeCreationEstimatorType: TravelTimeCreationEstimatorType = null;
  private editorMode: EditorMode = EditorMode.NetzgrafikEditing;
  private isMultiSelectedNodesCorridor = false;

  private windowViewboxPropertiesMap: {[key: string]: ViewboxProperties} = {};
  private destroyed = new Subject<void>();
  private filterWindowType = null;
  private oldSelectedTrainrunId: number = null;

  constructor(
    private filterService: FilterService,
    private nodeService: NodeService,
    private noteService: NoteService,
    private stammdatenService: StammdatenService,
    private trainrunSectionService: TrainrunSectionService,
    private trainrunService: TrainrunService,
    private netzgrafikColoringService: NetzgrafikColoringService,
    private loadPerlenketteService: LoadPerlenketteService,
  ) {
    this.activeTheme = null;
    this.loadActiveTheme();

    // listen for browser setting update
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
      this.activeTheme = null;
      this.loadActiveTheme();
    });

    this.activeStreckengrafikRenderingType = null;
    this.activeTravelTimeCreationEstimatorType = null;

    this.filterService.filter.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.nodeService.nodesUpdated();
      this.nodeService.transitionsUpdated();
      this.nodeService.connectionsUpdated();
      this.noteService.notesUpdated();
      this.trainrunSectionService.trainrunSectionsUpdated();
      this.handlePerlenketteOnFilterChanged();
    });
    this.trainrunSectionService.informSelectedTrainrunClick
      .pipe(takeUntil(this.destroyed))
      .subscribe((informSelectedTrainrunClick: InformSelectedTrainrunClick) => {
        this.showPerlenkette(informSelectedTrainrunClick);
      });

    this.trainrunService.trainruns
      .pipe(takeUntil(this.destroyed))
      .subscribe((trainrun: Trainrun[]) => {
        const st = trainrunService.getSelectedTrainrun();
        if (st !== null) {
          this.oldSelectedTrainrunId = st.getId();
          return;
        }
        this.closePerlenkette();
        this.oldSelectedTrainrunId = null;
      });

    this.stammdatenService.stammdatenObservable
      .pipe(takeUntil(this.destroyed))
      .subscribe((stammdaten: Stammdaten[]) => {
        this.updateNodeStammdaten();
        this.showStammdatenEditDialog(stammdaten);
      });
    this.filterWindow.pipe(takeUntil(this.destroyed)).subscribe((type: FilterWindowType | null) => {
      this.filterWindowType = type;
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  getViewboxProperties(key: string): ViewboxProperties {
    const viewboxProperties = this.windowViewboxPropertiesMap[key];
    if (viewboxProperties === undefined) {
      return this.getDefaultViewProperties();
    }
    return viewboxProperties;
  }

  getDefaultViewProperties() {
    return {
      currentViewBox: null,
      panZoomTop: 0,
      panZoomLeft: 0,
      panZoomWidth: 0,
      panZoomHeight: 0,
      zoomFactor: 100,
      origWidth: 0,
      origHeight: 0,
    };
  }

  setViewboxProperties(key: string, viewboxProperties: ViewboxProperties) {
    this.windowViewboxPropertiesMap[key] = Object.assign({}, viewboxProperties);
  }

  isLocalStoredColorTheme() {
    const serializedState = localStorage.getItem("UiInteractionService");
    if (
      serializedState === null ||
      serializedState === undefined ||
      serializedState === "undefined"
    ) {
      return false;
    }
    return true;
  }

  resetLocalStoredColorData() {
    localStorage.removeItem("UiInteractionService");
    this.activeTheme = null;
    this.loadActiveTheme();
  }

  loadActiveTheme() {
    this.loadUserSettingFromLocalStorage();
    if (this.activeTheme === null) {
      // detect at initialization
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        this.setActiveTheme(new ThemeFachDark(), false);
      } else {
        this.setActiveTheme(new ThemeFach(), false);
      }
      this.netzgrafikColoringService.setDarkMode(this.activeTheme.isDark);
    }
    if (this.activeStreckengrafikRenderingType === null) {
      this.activeStreckengrafikRenderingType = StreckengrafikRenderingType.UniformDistance;
    }
    if (this.activeTravelTimeCreationEstimatorType === null) {
      this.activeTravelTimeCreationEstimatorType = TravelTimeCreationEstimatorType.RetrieveFromEdge;
    }
  }

  createTheme(
    themeRegistration: ThemeRegistration,
    activeBackgroundColor: string,
    activeDarkBackgroundColor: string,
  ) {
    let activeTheme = this.activeTheme;
    if (themeRegistration === ThemeRegistration.ThemeDefaultUxDark) {
      activeTheme = new ThemeDefaultUxDark(activeDarkBackgroundColor, activeDarkBackgroundColor);
    } else if (themeRegistration === ThemeRegistration.ThemeDefaultUx) {
      activeTheme = new ThemeDefaultUx(activeBackgroundColor, activeBackgroundColor);
    } else if (themeRegistration === ThemeRegistration.ThemeGrayDark) {
      activeTheme = new ThemeGrayDark(activeDarkBackgroundColor, activeDarkBackgroundColor);
    } else if (themeRegistration === ThemeRegistration.ThemeGray) {
      activeTheme = new ThemeGray(activeBackgroundColor, activeBackgroundColor);
    } else if (themeRegistration === ThemeRegistration.ThemeFachPrint) {
      activeTheme = new ThemeFachPrint(activeBackgroundColor, activeBackgroundColor);
    } else if (themeRegistration === ThemeRegistration.ThemeFachDark) {
      activeTheme = new ThemeFachDark(activeDarkBackgroundColor, activeDarkBackgroundColor);
    } else {
      activeTheme = new ThemeFach(activeBackgroundColor, activeBackgroundColor);
    }
    this.setActiveTheme(activeTheme);
  }

  getActiveTheme(): ThemeBase {
    return this.activeTheme;
  }

  getActiveStreckengrafikRenderingType(): StreckengrafikRenderingType {
    return this.activeStreckengrafikRenderingType;
  }

  setActiveStreckengrafikRenderingType(streckengrafikRenderingType: StreckengrafikRenderingType) {
    if (streckengrafikRenderingType === undefined) {
      streckengrafikRenderingType = StreckengrafikRenderingType.UniformDistance;
    }

    this.activeStreckengrafikRenderingType = streckengrafikRenderingType;
    this.saveUserSettingToLocalStorage();
    this.trainrunSectionService.trainrunSectionsUpdated();
  }

  getActiveTravelTimeCreationEstimatorType(): TravelTimeCreationEstimatorType {
    return this.activeTravelTimeCreationEstimatorType;
  }

  setActiveTravelTimeCreationEstimatorType(
    activeTravelTimeCreationEstimatorType: TravelTimeCreationEstimatorType,
  ) {
    if (activeTravelTimeCreationEstimatorType === undefined) {
      activeTravelTimeCreationEstimatorType = TravelTimeCreationEstimatorType.Fixed;
    }
    this.activeTravelTimeCreationEstimatorType = activeTravelTimeCreationEstimatorType;
    this.saveUserSettingToLocalStorage();
  }

  updateNodeStammdaten() {
    this.updateNodeStammdatenSubject.next();
  }

  showNodeStammdaten() {
    this.updateNodeStammdatenSubject.next();
    this.showNodeStammdatenSubject.next(true);
  }

  closeNodeStammdaten() {
    this.showNodeStammdatenSubject.next(false);
  }

  showNetzgrafik() {
    this.showStreckengrafikSubject.next(MainViewMode.Netzgrafik);
  }

  showStreckengrafik() {
    this.showStreckengrafikSubject.next(MainViewMode.Streckengrafik);
  }

  showOriginDestination() {
    this.showOriginDestinationSubjet.next(MainViewMode.OriginDestination);
  }

  moveNetzgrafikEditorFocalViewPoint(center: Vec2D) {
    this.moveNetzgrafikEditorViewFocalPointSubject.next(center);
  }

  viewportCenteringOnNodesBoundingBox() {
    const bb = this.nodeService.getNetzgrafikBoundingBox();
    const center = new Vec2D(
      (bb.minCoordX + bb.maxCoordX) / 2.0,
      (bb.minCoordY + bb.maxCoordY) / 2.0,
    );
    this.moveNetzgrafikEditorFocalViewPoint(center);
  }
  showOrCloseFilter(type: FilterWindowType) {
    if (this.isFilterWindowType(type)) {
      this.closeFilter();
      return;
    }
    this.showFilterSubject.next(type);
  }

  isFilterWindowType(type: FilterWindowType): boolean {
    return this.filterWindowType === type;
  }

  closeFilter() {
    this.showFilterSubject.next(null);
  }

  showPerlenkette(informSelectedTrainrunClick: InformSelectedTrainrunClick) {
    this.nodeService.unselectAllConnections();
    if (informSelectedTrainrunClick.open) {
      this.showPerlenketteSubject.next(true);
    }
    this.sendPerlenketteTrainrunSectionClicked.next(informSelectedTrainrunClick.trainrunSectionId);
  }

  closePerlenkette() {
    this.nodeService.unselectAllConnections();
    this.showPerlenketteSubject.next(false);
  }

  closeTrainrunDialog() {
    this.showTrainrunDialogSubject.next(null);
  }

  print() {
    this.printGraphikSubject.next(null);
  }

  showTrainrunDialog(parameter: TrainrunDialogParameter) {
    this.showTrainrunDialogSubject.next(parameter);
  }

  showConfirmationDiagramDialog(
    confirmationDiagramParameter: ConfirmationDialogParameter,
  ): Observable<boolean> {
    this.showConfirmationDiagramDialogSubject.next(confirmationDiagramParameter);
    return confirmationDiagramParameter.dialogFeedback;
  }

  showStammdatenEditDialog(stammdaten: Stammdaten[]) {
    this.showStammdatenEditDialogSubject.next(stammdaten);
  }

  zoomIn(zoomCenter: Vec2D) {
    this.zoomInSubject.next(zoomCenter);
  }

  zoomOut(zoomCenter: Vec2D) {
    this.zoomOutSubject.next(zoomCenter);
  }

  zoomReset(zoomCenter: Vec2D) {
    this.zoomResetSubject.next(zoomCenter);
  }

  zoomFactorChanged(zoomFactor: number) {
    this.zoomFactorSubject.next(zoomFactor);
  }

  setEditorMode(mode: EditorMode) {
    this.editorMode = mode;
    this.setEditorModeSubject.next(this.editorMode);
  }

  getEditorMode(): EditorMode {
    return this.editorMode;
  }

  resetEditorMode() {
    this.editorMode = EditorMode.NetzgrafikEditing;
    this.setEditorModeSubject.next(this.editorMode);
  }

  disableMultiSelectedNodesCorridor() {
    this.isMultiSelectedNodesCorridor = false;
  }

  enableMultiSelectedNodesCorridor() {
    this.isMultiSelectedNodesCorridor = true;
  }

  isMultiSelectedNodesCorridorEnabled() {
    return this.isMultiSelectedNodesCorridor;
  }

  private setActiveTheme(theme: ThemeBase, updateLocalStorage = true) {
    this.activeTheme = theme;
    this.netzgrafikColoringService.setDarkMode(this.activeTheme.isDark);
    if (updateLocalStorage) {
      this.saveUserSettingToLocalStorage();
    }
    this.updateLightDark();
    this.themeChanged.next(this.activeTheme);
  }

  updateLightDark() {
    const el = document.getElementById("NetzgrafikRootHtml");
    if (el) {
      el.className = "sbb-lean" + (this.getActiveTheme().isDark ? " sbb-dark" : " sbb-light");
    }
  }

  private loadUserSettingFromLocalStorage() {
    try {
      const serializedState = localStorage.getItem("UiInteractionService");
      if (
        serializedState === null ||
        serializedState === undefined ||
        serializedState === "undefined"
      ) {
        return;
      }
      const localStoredInfo = JSON.parse(serializedState);
      const activeTheme = localStoredInfo.activeTheme;
      this.createTheme(
        activeTheme.themeRegistration,
        activeTheme.backgroundColor,
        activeTheme.backgroundStreckengraphikColor,
      );
      this.setActiveStreckengrafikRenderingType(localStoredInfo.streckengrafikRenderingType);
      this.setActiveTravelTimeCreationEstimatorType(
        localStoredInfo.travelTimeCreationEstimatorType,
      );
    } catch (err) {
      console.error(err);
    }
  }

  private saveUserSettingToLocalStorage() {
    try {
      localStorage.setItem(
        "UiInteractionService",
        JSON.stringify({
          activeTheme: this.getActiveTheme(),
          streckengrafikRenderingType: this.getActiveStreckengrafikRenderingType(),
          travelTimeCreationEstimatorType: this.getActiveTravelTimeCreationEstimatorType(),
        }),
      );
    } catch (err) {
      console.error(err);
    }
  }

  private handlePerlenketteOnFilterChanged() {
    if (
      this.loadPerlenketteService.getSelectedTrainrun() &&
      !this.filterService.filterTrainrun(this.loadPerlenketteService.getSelectedTrainrun())
    ) {
      this.closePerlenkette();
    }
  }
}

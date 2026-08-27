import {
  AfterContentChecked,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import type {SbbRadioChange} from "@sbb-esta/angular/radio-button";
import {Subject} from "rxjs";
import {LoadPerlenketteService} from "./service/load-perlenkette.service";
import {PerlenketteTrainrun} from "./model/perlenketteTrainrun";
import {PerlenketteSection} from "./model/perlenketteSection";
import {FilterService} from "../services/ui/filter.service";
import {UiInteractionService} from "../services/ui/ui.interaction.service";
import {Vec2D} from "../utils/vec2D";
import {PerlenketteItem} from "./model/perlenketteItem";
import {PerlenketteNode} from "./model/perlenketteNode";
import {EditorMode} from "../view/editor-menu/editor-mode";
import {NodeService} from "../services/data/node.service";
import {takeUntil} from "rxjs/operators";
import {VersionControlService} from "../services/data/version-control.service";
import {TrainrunSectionService} from "../services/data/trainrunsection.service";
import {TrainrunService} from "../services/data/trainrun.service";

enum ShowTrainrunEditTab {
  sbb_trainrun_tab = "GENERAL",
  sbb_trainrun_roundtrip_tab = "ROUND_TRIP",
}

@Component({
  selector: "sbb-perlenkette",
  templateUrl: "./perlenkette.component.html",
  styleUrls: ["./perlenkette.component.scss"],
  standalone: false,
})
export class PerlenketteComponent implements AfterContentChecked, OnDestroy {
  perlenketteTrainrun: PerlenketteTrainrun;
  @ViewChild("svgPerlenkette") svgPerlenkette: ElementRef<HTMLDivElement>;
  @ViewChild("drawingContainer") drawingContainer: ElementRef;
  @Input() sidebarElementHeight: number;

  private readonly destroyed$ = new Subject<void>();
  private readonly signalAllChildrenIsBeingEditedSubject: Subject<PerlenketteSection> =
    new Subject<PerlenketteSection>();

  public svgPoint: Vec2D;
  public contentWidth = 460;
  public contentHeight = 800;
  public renderedElementsHeight = 1;
  private perlenketteRenderingElementsHeight: [PerlenketteItem, number][];

  private trainrunEditorVisible = false;

  private showAllLockStates = false;

  private lastMouseClientY: number | undefined = undefined;

  public showTrainrunEditTab: ShowTrainrunEditTab = ShowTrainrunEditTab.sbb_trainrun_tab;

  sbbToggleValue = ShowTrainrunEditTab.sbb_trainrun_tab;

  constructor(
    private readonly loadPerlenketteService: LoadPerlenketteService,
    readonly filterService: FilterService,
    private readonly uiInteractionService: UiInteractionService,
    private readonly nodeService: NodeService,
    private versionControlService: VersionControlService,
    private changeDetectorRef: ChangeDetectorRef,
    public trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
  ) {
    this.loadPerlenketteService
      .getPerlenketteData()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((perlenketteTrainrun) => {
        this.perlenketteRenderingElementsHeight = [];
        this.updatePerlenkette(perlenketteTrainrun);
      });

    this.uiInteractionService.perlenketteTrainrunSectionClicked
      .pipe(takeUntil(this.destroyed$))
      .subscribe((trainrunSectionId: number) => {
        this.gotoTrainrunSection(trainrunSectionId);
        this.trainrunSectionService.setTrainrunSectionAsSelected(trainrunSectionId);
      });

    this.trainrunService.trainruns.pipe(takeUntil(this.destroyed$)).subscribe((trainrunList) => {
      if (!this.trainrunService.getSelectedTrainrun()) {
        return;
      }
      if (!this.trainrunSectionService.getSelectedTrainrunSection()) {
        this.trainrunSectionService.setTrainrunSectionAsSelected(
          this.perlenketteTrainrun.pathItems
            .find((s) => s.isPerlenketteSection())
            .getPerlenketteSection().trainrunSectionId,
        );
      }
      if (!trainrunList.length) {
        return;
      }
    });

    this.svgPoint = new Vec2D(0, -64);
  }

  onSbbToggleChange(event: SbbRadioChange) {
    this.sbbToggleValue = event.value;
  }

  isSbbToggleRoundtrip(): boolean {
    return this.sbbToggleValue === ShowTrainrunEditTab.sbb_trainrun_roundtrip_tab;
  }

  isSbbToggleGeneral(): boolean {
    return this.sbbToggleValue === ShowTrainrunEditTab.sbb_trainrun_tab;
  }

  showTrainrunEditor(): boolean {
    return this.trainrunEditorVisible;
  }

  trainrunNameClicked(event: MouseEvent) {
    event.stopPropagation();
    this.trainrunEditorVisible = !this.trainrunEditorVisible;
    this.showTrainrunEditTab = ShowTrainrunEditTab.sbb_trainrun_tab;
  }

  getShowAllLockStates(): boolean {
    return this.showAllLockStates;
  }

  toggleShowAllLockStates() {
    this.showAllLockStates = !this.showAllLockStates;
  }

  isSbbTrainrunTab(): boolean {
    return this.showTrainrunEditTab === ShowTrainrunEditTab.sbb_trainrun_tab;
  }

  isSbbTrainrunRoundtripTab(): boolean {
    return this.showTrainrunEditTab === ShowTrainrunEditTab.sbb_trainrun_roundtrip_tab;
  }

  showTrainrunDialogOneWay(event: MouseEvent) {
    event.stopPropagation();
    if (!this.trainrunService.getSelectedTrainrun()) {
      return;
    }
    if (!this.trainrunSectionService.getSelectedTrainrunSection()) {
      const pItemSection = this.perlenketteTrainrun.pathItems.find((item) =>
        item.isPerlenketteSection(),
      );
      this.trainrunSectionService.setTrainrunSectionAsSelected(
        pItemSection.getPerlenketteSection().trainrunSectionId,
      );
    }
    // toggle
    if (this.showTrainrunEditTab === ShowTrainrunEditTab.sbb_trainrun_tab) {
      this.showTrainrunEditTab = ShowTrainrunEditTab.sbb_trainrun_roundtrip_tab;
    } else {
      this.showTrainrunEditTab = ShowTrainrunEditTab.sbb_trainrun_tab;
    }
  }

  private updatePerlenkette(perlenketteTrainrun: PerlenketteTrainrun) {
    let originalPathItems: PerlenketteItem[] | null = null;
    if (this.perlenketteTrainrun) {
      originalPathItems = this.perlenketteTrainrun.pathItems;

      if (this.perlenketteTrainrun.trainrunId !== perlenketteTrainrun.trainrunId) {
        this.svgPoint.setY(-64);
      }
    }

    this.perlenketteTrainrun = perlenketteTrainrun;

    if (originalPathItems) {
      this.perlenketteTrainrun.pathItems.forEach((pathItem) => {
        originalPathItems.forEach((originalPathItem) => {
          if (pathItem.isPerlenketteSection() && originalPathItem.isPerlenketteSection()) {
            if (
              pathItem.getPerlenketteSection().trainrunSectionId ===
                originalPathItem.getPerlenketteSection().trainrunSectionId &&
              originalPathItem.getPerlenketteSection().isBeingEdited
            ) {
              pathItem.getPerlenketteSection().isBeingEdited =
                originalPathItem.getPerlenketteSection().isBeingEdited;
            }
          }
        });
      });
    }
  }

  ngAfterContentChecked() {
    this.contentWidth = Math.max(460, document.getElementById("cd-layout-aside").clientWidth);

    const mainContentElement = document.getElementById("cd-layout-content");
    this.contentHeight = mainContentElement.clientHeight;

    this.changeDetectorRef.detectChanges();
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  getViewportHeight(): number {
    return this.contentHeight * 1.25;
  }

  getDrawingContainerTransform(): string {
    // Scrolling used to be done by moving the viewBox of a <svg> wrapping the content inside a
    // <foreignObject>. Safari (WebKit) does not apply that viewBox transformation reliably to
    // (positioned) html content inside a <foreignObject> - parts of the perlenkette stayed in
    // place while the rest scrolled. Therefore the content is now plain html, scrolled with a
    // css transform. The additional contentHeight * 0.125 keeps the former vertical centering
    // (viewport height is 1.25 * contentHeight, viewBox height was contentHeight).
    return "translateY(" + (this.contentHeight * 0.125 - this.svgPoint.getY()) + "px)";
  }

  showTrainrunName(): boolean {
    if (this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return true;
    }
    return this.filterService.isFilterTrainrunNameEnabled();
  }

  getSmallstationClassTag(pathItem: PerlenketteItem): string {
    let ret = "smallstation";
    if (pathItem.isPerlenketteNode()) {
      const r = this.getClosestPerlenketteItem();
      if (r !== undefined) {
        if (r.nodeId === pathItem.getPerlenketteNode().nodeId) {
          ret += " closest";
        }
      }
    }
    return ret;
  }

  getClosestPerlenketteItem(): PerlenketteNode | undefined {
    let retEl: PerlenketteNode | undefined = undefined;
    let currentY = 0;
    this.perlenketteRenderingElementsHeight.forEach(([el, height]) => {
      const offY = this.svgPoint.getY() + this.contentHeight / 4;
      if (el.isPerlenketteNode() && currentY < Math.max(0, offY) + height) {
        retEl = el.getPerlenketteNode();
      }
      currentY += height;
    });
    return retEl;
  }

  changeSvgMousePosition(event: MouseEvent) {
    if (event.buttons > 0) {
      // MouseEvent.movementY is not reported in the same unit by all browsers (physical,
      // logical or css pixel). WebKit reports screen pixels, so dragging scrolls twice as
      // fast on a retina display. Calculating the delta from clientY gives css pixels
      // everywhere - this is also what the specification recommends.
      const movementY =
        this.lastMouseClientY === undefined ? 0 : event.clientY - this.lastMouseClientY;
      this.lastMouseClientY = event.clientY;
      this.updateSvgPointY(this.svgPoint.getY() - movementY);
    } else {
      this.lastMouseClientY = undefined;
    }
    event.stopPropagation();
  }

  signalIsBeingEdited(event: PerlenketteSection) {
    this.signalAllChildrenIsBeingEditedSubject.next(event);
  }

  doSplitTrainrun(pathItems: PerlenketteItem[], idx: number): boolean {
    if (idx >= pathItems.length - 1) {
      return false;
    }
    const item = pathItems[idx];
    const previousItem = pathItems[idx + 1];
    return item.isPerlenketteNode() === previousItem.isPerlenketteNode();
  }

  signalHeightChanged(height: number, pathItem: PerlenketteItem) {
    this.perlenketteRenderingElementsHeight.push([pathItem, height]);
    this.renderedElementsHeight = 0;
    this.perlenketteRenderingElementsHeight.forEach(([_, height]) => {
      this.renderedElementsHeight += height;
    });
  }

  isFirstSection(item: PerlenketteItem): boolean {
    if (item.isPerlenketteSection()) {
      const psi = item.getPerlenketteSection();
      return psi.isFristTrainrunPartSection();
    }
    return false;
  }

  isLastSection(item: PerlenketteItem): boolean {
    if (item.isPerlenketteSection()) {
      const psi = item.getPerlenketteSection();
      return psi.isLastTrainrunPartSection();
    }
    return false;
  }

  isLastNode(item: PerlenketteItem): boolean {
    if (item.isPerlenketteNode()) {
      const pni = item.getPerlenketteNode();
      return pni.isLastTrainrunPartNode();
    }
    return false;
  }

  isLastNodeButNotVeryLast(item: PerlenketteItem) {
    if (
      this.perlenketteTrainrun.pathItems.indexOf(item) ===
      this.perlenketteTrainrun.pathItems.length - 1
    ) {
      return false;
    }
    return this.isLastNode(item);
  }

  getSignalAllChildrenIsBeingEditedObservable() {
    return this.signalAllChildrenIsBeingEditedSubject.asObservable();
  }

  getVariantIsWritable(): boolean {
    return this.versionControlService.getVariantIsWritable();
  }

  getPositionY(): number {
    return this.contentHeight * window.devicePixelRatio - 40;
  }

  disableSectionView() {
    this.signalIsBeingEdited(undefined);
  }

  scrollFirst(event: MouseEvent) {
    event.stopPropagation();
    this.svgPoint.setY(-64);
  }

  scrollLast(event: MouseEvent) {
    event.stopPropagation();
    this.svgPoint.setY(Math.max(0, this.renderedElementsHeight - 320));
  }

  private getGotoCurrentY(pathItem: PerlenketteItem) {
    let currentY = 0;
    for (const [el, height] of this.perlenketteRenderingElementsHeight) {
      if (el === pathItem) {
        break;
      }
      currentY += height;
    }
    return currentY;
  }

  goto(pathItem: PerlenketteItem) {
    const currentY = this.getGotoCurrentY(pathItem);
    this.updateSvgPointY(currentY - this.contentHeight / 4);
    const offset = new Vec2D(this.contentWidth / 2, 0);
    this.moveNetzgrafikEditorFocalViewPoint(pathItem, offset);
  }

  gotoTrainrunSection(trainrunSectionId: number) {
    const pathItem: PerlenketteItem = this.perlenketteTrainrun.pathItems.find(
      (item: PerlenketteItem) => {
        if (item.isPerlenketteSection()) {
          return item.getPerlenketteSection().trainrunSectionId === trainrunSectionId;
        }
        return false;
      },
    );
    if (pathItem !== undefined) {
      const pItemHeight = this.perlenketteRenderingElementsHeight.find((pItem) => {
        return pItem[0] === pathItem;
      });
      const delta = pItemHeight !== undefined ? pItemHeight[1] : 0;
      const currentY = this.getGotoCurrentY(pathItem) + delta;
      this.updateSvgPointY(currentY - this.contentHeight / 4);
    }
  }

  moveNetzgrafikEditorFocalViewPoint(pathItem: PerlenketteItem, offset = new Vec2D(0, 0)) {
    if (this.uiInteractionService.getEditorMode() === EditorMode.NetzgrafikEditing) {
      if (pathItem.isPerlenketteNode()) {
        const pNode = pathItem.getPerlenketteNode();
        const node = this.nodeService.getNodeFromId(pNode.nodeId);
        if (node !== undefined) {
          const x = node.getPositionX() + node.getNodeWidth() / 2.0 + offset.getX();
          const y = node.getPositionY() + node.getNodeHeight() / 2.0 + offset.getY();
          this.uiInteractionService.moveNetzgrafikEditorFocalViewPoint(new Vec2D(x, y));
        }
      }
    }
  }

  @HostListener("wheel", ["$event"])
  public onScroll(event: WheelEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const delta = Math.min(64, Math.max(-64, event.deltaY));
    const currentEl: PerlenketteNode = this.getClosestPerlenketteItem();
    if (currentEl !== undefined) {
      this.updateSvgPointY(this.svgPoint.getY() + delta);
    }
  }

  private updateSvgPointY(y: number) {
    this.svgPoint.setY(
      Math.max(-this.contentHeight / 4, Math.min(this.renderedElementsHeight - 48, y)),
    );
  }

  protected readonly ShowTrainrunEditTab = ShowTrainrunEditTab;
}

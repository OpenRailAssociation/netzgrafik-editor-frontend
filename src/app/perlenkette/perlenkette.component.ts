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
import {PerlenketteConnection} from "./model/perlenketteConnection";

@Component({
  selector: "sbb-perlenkette",
  templateUrl: "./perlenkette.component.html",
  styleUrls: ["./perlenkette.component.scss"],
})
export class PerlenketteComponent implements AfterContentChecked, OnDestroy {
  perlenketteTrainrun: PerlenketteTrainrun;
  @ViewChild("svgPerlenkette") svgPerlenkette: ElementRef<SVGSVGElement>;
  @ViewChild("drawingContainer") drawingContainer: ElementRef;
  @Input() sidebarElementHeight: number;

  private readonly destroyed$ = new Subject<void>();
  private readonly signalAllChildrenIsBeingEditedSubject: Subject<PerlenketteSection> =
    new Subject<PerlenketteSection>();

  public svgPoint: Vec2D;
  public contentWidth = 1;
  public contentHeight = 1;
  public renderedElementsHeight = 1;
  private perlenketteRenderingElementsHeight: [PerlenketteItem, number][];

  private trainrunEditorVisible = false;
  private selectedPerlenketteConnection: PerlenketteConnection = undefined;

  constructor(
    private readonly loadPerlenketteService: LoadPerlenketteService,
    readonly filterService: FilterService,
    private readonly uiInteractionService: UiInteractionService,
    private readonly nodeService: NodeService,
    private changeDetectorRef: ChangeDetectorRef,
  ) {
    this.selectedPerlenketteConnection = undefined;

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
      });

    this.svgPoint = new Vec2D(0, -64);
  }

  showTrainrunEditor(): boolean {
    return this.trainrunEditorVisible;
  }

  trainrunNameClicked(event: MouseEvent) {
    event.stopPropagation();
    this.trainrunEditorVisible = !this.trainrunEditorVisible;
  }

  private updatePerlenkette(perlenketteTrainrun: PerlenketteTrainrun) {
    let originalPathItems;
    if (this.perlenketteTrainrun) {
      originalPathItems = this.perlenketteTrainrun.pathItems;

      if (
        this.perlenketteTrainrun.trainrunId !== perlenketteTrainrun.trainrunId
      ) {
        this.svgPoint.setY(-64);
      }
    }

    this.perlenketteTrainrun = perlenketteTrainrun;

    if (originalPathItems) {
      this.perlenketteTrainrun.pathItems.forEach((pathItem) => {
        originalPathItems.forEach((originalPathItem) => {
          if (
            pathItem.isPerlenketteSection() &&
            originalPathItem.isPerlenketteSection()
          ) {
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
    this.contentWidth = Math.max(
      364,
      document.getElementById("cd-layout-aside").clientWidth,
    );

    const mainContentElement = document.getElementById("cd-layout-content");
    this.contentHeight = mainContentElement.clientHeight;
    this.changeDetectorRef.detectChanges();
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  getPerlenketteViewBox(): string {
    return (
      "0 " +
      this.svgPoint.getY() +
      " " +
      this.contentWidth +
      " " +
      this.contentHeight
    );
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

  getClosestPerlenketteItem(): PerlenketteNode {
    let retEl: PerlenketteNode =
      this.perlenketteRenderingElementsHeight.keys()[0];
    let currentY = 0;
    this.perlenketteRenderingElementsHeight.forEach((pItem, idx) => {
      const el = pItem[0];
      const height = pItem[1];
      const offY = this.svgPoint.getY() + this.contentHeight / 4;
      if (el.isPerlenketteNode()) {
        if (currentY < Math.max(0, offY) + height) {
          if (retEl === undefined || currentY < Math.max(0, offY)) {
            retEl = el.getPerlenketteNode();
          }
          if (
            Math.max(0, offY) - currentY <
            Math.max(0, offY) + height - currentY
          ) {
            retEl = el.getPerlenketteNode();
          }
        }
      }
      currentY += height;
    });
    return retEl;
  }

  changeSvgMousePosition(event: MouseEvent) {
    if (event.buttons > 0) {
      let currentY = this.svgPoint.getY();
      currentY -= event.movementY;
      this.updateSvgPointY(undefined, currentY);
    }
    event.stopPropagation();
  }

  signalIsBeingEdited(event: PerlenketteSection) {
    this.signalAllChildrenIsBeingEditedSubject.next(event);
  }

  signalHeightChanged(height: number, pathItem: PerlenketteItem) {
    this.perlenketteRenderingElementsHeight.push([pathItem, height]);
    this.renderedElementsHeight = 0;
    this.perlenketteRenderingElementsHeight.forEach((pItem, idx) => {
      const el = pItem[0];
      const height = pItem[1];
      this.renderedElementsHeight += height;
    });
  }

  getSignalAllChildrenIsBeingEditedObservable() {
    return this.signalAllChildrenIsBeingEditedSubject.asObservable();
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
    let next = true;
    this.perlenketteRenderingElementsHeight.forEach((pItem, idx) => {
      const el = pItem[0];
      const height = pItem[1];
      if (el === pathItem) {
        next = false;
      }
      if (next) {
        currentY += height;
      }
    });
    return currentY;
  }

  goto(pathItem: PerlenketteItem) {
    const currentY = this.getGotoCurrentY(pathItem);
    this.updateSvgPointY(pathItem, currentY - this.contentHeight / 4);
    const offset = new Vec2D(this.contentWidth / 2, 0);
    this.moveNetzgrafikEditorFocalViewPoint(pathItem, offset);
  }

  gotoTrainrunSection(trainrunSectionId: number) {
    const pathItem: PerlenketteItem = this.perlenketteTrainrun.pathItems.find(
      (item: PerlenketteItem) => {
        if (item.isPerlenketteSection()) {
          return (
            item.getPerlenketteSection().trainrunSectionId === trainrunSectionId
          );
        }
        return false;
      },
    );
    if (pathItem !== undefined) {
      const pItemHeight = this.perlenketteRenderingElementsHeight.find(
        (pItem) => {
          return pItem[0] === pathItem;
        },
      );
      const delta = pItemHeight !== undefined ? pItemHeight[1] : 0;
      const currentY = this.getGotoCurrentY(pathItem) + delta;
      this.updateSvgPointY(pathItem, currentY - this.contentHeight / 4);
    }
  }

  moveNetzgrafikEditorFocalViewPoint(
    pathItem: PerlenketteItem,
    offset = new Vec2D(0, 0),
  ) {
    if (
      this.uiInteractionService.getEditorMode() === EditorMode.NetzgrafikEditing
    ) {
      if (pathItem.isPerlenketteNode()) {
        const pNode = pathItem.getPerlenketteNode();
        const node = this.nodeService.getNodeFromId(pNode.nodeId);
        if (node !== undefined) {
          const x =
            node.getPositionX() + node.getNodeWidth() / 2.0 + offset.getX();
          const y =
            node.getPositionY() + node.getNodeHeight() / 2.0 + offset.getY();
          this.uiInteractionService.moveNetzgrafikEditorFocalViewPoint(
            new Vec2D(x, y),
          );
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
    if (delta > 0) {
      let newPos = 0;
      this.perlenketteRenderingElementsHeight.forEach((pItem, idx) => {
        const el = pItem[0];
        const height = pItem[1];
        newPos += height;
        if (el.isPerlenketteNode()) {
          if (el === currentEl) {
            this.updateSvgPointY(el, this.svgPoint.getY() + delta);
          }
        }
      });
    } else {
      let newPos = 0;
      this.perlenketteRenderingElementsHeight.forEach((pItem, idx) => {
        const el = pItem[0];
        const height = pItem[1];
        newPos += height;
        if (el.isPerlenketteNode()) {
          if (el === currentEl) {
            this.updateSvgPointY(el, this.svgPoint.getY() + delta);
          }
        }
      });
    }
  }

  private updateSvgPointY(pathItem: PerlenketteItem, y: number) {
    this.svgPoint.setY(
      Math.max(
        -this.contentHeight / 4,
        Math.min(this.renderedElementsHeight - 48, y),
      ),
    );
  }
}

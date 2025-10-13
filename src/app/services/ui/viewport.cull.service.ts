import {Injectable, OnDestroy} from "@angular/core";
import {UiInteractionService} from "./ui.interaction.service";
import {Subject} from "rxjs";
import {Vec2D} from "../../utils/vec2D";
import {NodeService} from "../data/node.service";
import {NoteService} from "../data/note.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";

export enum ViewportOut {
  ElementIsInside,
  LeftOutside,
  RightOutside,
  TopOutside,
  BottomOutside,
}

@Injectable({
  providedIn: "root",
})
export class ViewportCullService implements OnDestroy {
  private destroyed = new Subject<void>();
  private doCheckIsInViewport = true;

  constructor(
    private readonly uiInteractionService: UiInteractionService,
    private nodeService: NodeService,
    private noteService: NoteService,
    private trainrunSectionService: TrainrunSectionService,
  ) {}

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  onViewportChangeUpdateRendering(doCheckIsInViewport: boolean = true) {
    // The doCheckIsInViewport should only be set to false when the entire netzgrafik
    // needs to be rendered, for example, when the entire graphic has to be exported
    // as SVG or PNG.
    this.doCheckIsInViewport = doCheckIsInViewport;
    this.nodeService.nodesUpdated();
    this.nodeService.connectionsUpdated();
    this.nodeService.transitionsUpdated();
    this.noteService.notesUpdated();
    this.trainrunSectionService.trainrunSectionsUpdated();
  }

  private checkIsElementPositionInViewport(
    pos: Vec2D,
    strSvgName: string,
    extraPixels = 64,
  ): ViewportOut[] {
    const vp = this.uiInteractionService.getViewboxProperties(strSvgName);
    const x0 = Number(vp.panZoomLeft) - extraPixels;
    const y0 = Number(vp.panZoomTop) - extraPixels;
    const x1 = x0 + Number(vp.panZoomWidth) + 2.0 * extraPixels;
    const y1 = y0 + Number(vp.panZoomHeight) + 2.0 * extraPixels;

    const retOut: ViewportOut[] = [];
    if (pos.getX() < x0) {
      retOut.push(ViewportOut.LeftOutside);
    }
    if (pos.getX() > x1) {
      retOut.push(ViewportOut.RightOutside);
    }
    if (pos.getY() < y0) {
      retOut.push(ViewportOut.TopOutside);
    }
    if (pos.getY() > y1) {
      retOut.push(ViewportOut.BottomOutside);
    }
    if (retOut.length === 0) {
      return [ViewportOut.ElementIsInside];
    }
    return retOut;
  }

  cullCheckPositionsInViewport(
    positions: Vec2D[],
    strSvgName: string,
    extraPixelsIn = 32,
  ): boolean {
    if (!this.doCheckIsInViewport) {
      return true;
    }
    // check whether an element is inside the "Viewport", or the spanned object overlays the
    // viewport box
    const mappedPositions = positions.map((el: Vec2D) =>
      this.checkIsElementPositionInViewport(el, strSvgName, extraPixelsIn),
    );

    if (
      mappedPositions.find(
        (el) => el.find((el2) => el2 === ViewportOut.ElementIsInside) !== undefined,
      ) !== undefined
    ) {
      // check whether an element is inside the "Viewport"
      return true;
    }

    const topOutside = mappedPositions.filter(
      (el) => el.find((el2) => el2 === ViewportOut.TopOutside) !== undefined,
    );
    if (topOutside.length === mappedPositions.length) {
      return false;
    }
    const bottomOutside = mappedPositions.filter(
      (el) => el.find((el2) => el2 === ViewportOut.BottomOutside) !== undefined,
    );
    if (bottomOutside.length === mappedPositions.length) {
      return false;
    }
    const leftOutside = mappedPositions.filter(
      (el) => el.find((el2) => el2 === ViewportOut.LeftOutside) !== undefined,
    );
    if (leftOutside.length === mappedPositions.length) {
      return false;
    }
    const rightOutside = mappedPositions.filter(
      (el) => el.find((el2) => el2 === ViewportOut.RightOutside) !== undefined,
    );
    if (rightOutside.length === mappedPositions.length) {
      return false;
    }

    return true;
  }
}

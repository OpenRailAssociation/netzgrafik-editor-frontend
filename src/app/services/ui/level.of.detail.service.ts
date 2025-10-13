import {Injectable, OnDestroy} from "@angular/core";
import {Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {UiInteractionService} from "./ui.interaction.service";
import {EditorMode} from "../../view/editor-menu/editor-mode";

export enum LevelOfDetail {
  FULL, // precise >= 50%
  LEVEL3, // ..  30 - 40 %
  LEVEL2, // ..  20 - 30 %
  LEVEL1, // ... 10 - 20 %
  LEVEL0, // approximated geometry <= 10%
}

@Injectable({
  providedIn: "root",
})
export class LevelOfDetailService implements OnDestroy {
  private destroyed = new Subject<void>();
  private switchLevelOfDetailOff = false;
  private levelOfDetail: LevelOfDetail = LevelOfDetail.FULL;

  constructor(private readonly uiInteractionService: UiInteractionService) {
    this.enableLevelOfDetailRendering();
    this.handleLevelOfDetail();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  private handleLevelOfDetail() {
    this.levelOfDetail = LevelOfDetail.FULL;

    this.uiInteractionService.zoomFactorObservable
      .pipe(takeUntil(this.destroyed))
      .subscribe((changedZoomFactor) => {
        if (this.uiInteractionService.getEditorMode() !== EditorMode.NetzgrafikEditing) {
          // don't change level of detail
          return;
        }
        this.levelOfDetail = LevelOfDetail.FULL;
        if (changedZoomFactor < 50) {
          this.levelOfDetail = LevelOfDetail.LEVEL3;
          if (changedZoomFactor < 40) {
            this.levelOfDetail = LevelOfDetail.LEVEL2;
            if (changedZoomFactor < 30) {
              this.levelOfDetail = LevelOfDetail.LEVEL1;
              if (changedZoomFactor < 20) {
                this.levelOfDetail = LevelOfDetail.LEVEL0;
              }
            }
          }
        }
      });
  }

  getLevelOfDetail(): LevelOfDetail {
    if (this.switchLevelOfDetailOff) {
      return LevelOfDetail.FULL;
    }
    return this.levelOfDetail;
  }

  disableLevelOfDetailRendering() {
    this.switchLevelOfDetailOff = true;
  }

  enableLevelOfDetailRendering() {
    this.switchLevelOfDetailOff = false;
  }
}

import {Component, Input} from "@angular/core";
import {SgPath} from "../../../model/streckengrafik-model/sg-path";
import {TrackSegments} from "../../../model/trackData";

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: "[sbb-path-slider-track-segments]",
  templateUrl: "./path-slider-track-segments.component.html",
  styleUrls: ["./path-slider-track-segments.component.scss"],
})
export class PathSliderTrackSegmentsComponent {
  @Input()
  path: SgPath;

  @Input()
  horizontal = true;

  private zeroPoint = 28;

  getTrackData(minTracks: boolean, maxNbrTracks2show = 4) {
    const path: string[] = [];
    if (!this.path.isSection()) {
      return path;
    }
    const ps = this.path.getPathSection();
    if (!ps.trackData?.sectionTrackSegments) {
      return path;
    }
    ps.trackData.sectionTrackSegments.forEach((sts: TrackSegments, index: number) => {
      const startAt = Math.max(0.0, sts.startPos * this.path.zoomedXPath());
      const endAt = Math.min(sts.endPos * this.path.zoomedXPath(), this.path.zoomedXPath());
      const nbrTracks = minTracks ? sts.minNbrTracks : sts.nbrTracks;
      if (nbrTracks <= maxNbrTracks2show) {
        for (let i = 0; i < nbrTracks; i++) {
          const p = this.zeroPoint + this.makePositionSymmetric(i, sts.nbrTracks) * 3;
          const d: string =
            "" +
            (index !== 0 ? " M " + startAt + "," + this.zeroPoint + " L " : " M ") +
            startAt +
            "," +
            p +
            " L " +
            endAt +
            "," +
            p +
            (index === ps.trackData.sectionTrackSegments.length - 1
              ? " "
              : " L " + endAt + "," + this.zeroPoint);
          path.push(d);
        }
      }
    });
    return path;
  }

  getTrackDataRect(minTracks: boolean, maxNbrTracks2show = 4) {
    if (!this.path.isSection()) {
      return [];
    }
    const ps = this.path.getPathSection();
    if (!ps.trackData?.sectionTrackSegments) {
      return [];
    }

    const retData = [];
    ps.trackData.sectionTrackSegments.forEach((sts: TrackSegments, index: number) => {
      const startAt = Math.max(0.0, sts.startPos * this.path.zoomedXPath());
      const endAt = Math.min(sts.endPos * this.path.zoomedXPath(), this.path.zoomedXPath());
      let y1 = this.zeroPoint;
      let y2 = this.zeroPoint;
      const nbrTracks = minTracks ? sts.minNbrTracks : sts.nbrTracks;
      if (nbrTracks > maxNbrTracks2show) {
        for (let i = 0; i < sts.nbrTracks; i++) {
          const p = this.zeroPoint + this.makePositionSymmetric(i, sts.nbrTracks) * 3;
          y1 = Math.min(y1, p);
          y2 = Math.max(y2, p);
        }
        retData.push({
          x1: startAt,
          x2: endAt,
          y1: y1,
          y2: y2,
          nbr: nbrTracks,
          d:
            "M " +
            startAt +
            ", " +
            y1 +
            " " +
            " L " +
            endAt +
            ", " +
            y1 +
            " " +
            " L " +
            endAt +
            ", " +
            y2 +
            " " +
            " L " +
            startAt +
            ", " +
            y2 +
            " " +
            " L " +
            startAt +
            ", " +
            y1 +
            " ",
        });
      }
    });
    return retData;
  }

  private makePositionSymmetric(mainTrackIdx: number, nbrTracks): number {
    if (mainTrackIdx === 0) {
      return 1;
    }
    if (mainTrackIdx === 1) {
      return 0;
    }
    const dir = mainTrackIdx % 2 === 1 ? 1.0 : -1.0;
    return Math.ceil(mainTrackIdx / 2) * dir;
  }
}

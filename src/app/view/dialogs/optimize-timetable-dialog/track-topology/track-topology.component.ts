import {ChangeDetectionStrategy, Component, Input, OnChanges} from "@angular/core";
import {EdgeTrackKpi} from "../../../../services/optimization/optimize-timetable.model";

interface TrackTopologyLine {
  x1: number;
  x2: number;
  trackNumber: number;
  y: number;
  d: string;
  occupied: boolean;
  overLimit: boolean;
}

interface TrackTopologyCountBox {
  x: number;
  centerY: number;
  height: number;
  d: string;
  value: string;
  overLimit: boolean;
}

@Component({
  selector: "sbb-track-topology",
  templateUrl: "./track-topology.component.html",
  styleUrls: ["./track-topology.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TrackTopologyComponent implements OnChanges {
  @Input() edge: EdgeTrackKpi;
  @Input() maxTracks = 0;
  @Input() trackLimitEnabled = false;

  topologyLines: TrackTopologyLine[] = [];
  topologyCountBoxes: TrackTopologyCountBox[] = [];

  ngOnChanges(): void {
    this.refreshTopology();
  }

  private refreshTopology(): void {
    if (!this.edge) {
      this.topologyLines = [];
      this.topologyCountBoxes = [];
      return;
    }

    const segments =
      this.edge.trackSegments?.length > 0
        ? this.edge.trackSegments
        : [{start: 0, end: 1, tracks: this.edge.tracksBefore}];
    const lines: TrackTopologyLine[] = [];
    const countBoxes: TrackTopologyCountBox[] = [];

    segments.forEach((segment, segmentIndex) => {
      const trackCount = Math.max(0, Math.floor(segment.tracks));
      const x1 = segment.start;
      const x2 = segment.end;

      if (trackCount > 4) {
        const offsets = Array.from({length: trackCount}, (_, index) =>
          this.trackOffset(index + 1),
        );
        const minimumOffset = Math.min(...offsets);
        const maximumOffset = Math.max(...offsets);
        let boxTop = 16.5 + minimumOffset - 0.5;
        let boxBottom = 16.5 + maximumOffset + 0.5;
        if (boxBottom - boxTop > 33) {
          boxTop = 0;
          boxBottom = 33;
        } else if (boxTop < 0) {
          boxBottom -= boxTop;
          boxTop = 0;
        } else if (boxBottom > 33) {
          boxTop -= boxBottom - 33;
          boxBottom = 33;
        }
        countBoxes.push({
          x: (x1 + x2) / 2,
          centerY: (boxTop + boxBottom) / 2,
          height: boxBottom - boxTop,
          d: `M ${x1} ${boxTop} L ${x2} ${boxTop} L ${x2} ${boxBottom} L ${x1} ${boxBottom} Z`,
          value: String(trackCount),
          overLimit: this.trackLimitEnabled && trackCount > this.maxTracks,
        });
        return;
      }

      const lanes = [
        {trackNumber: 3, y: (16.5 + this.trackOffset(3)) / 33},
        {trackNumber: 2, y: (16.5 + this.trackOffset(2)) / 33},
        {trackNumber: 1, y: (16.5 + this.trackOffset(1)) / 33},
        {trackNumber: 4, y: (16.5 + this.trackOffset(4)) / 33},
      ];
      const visibleTrackNumbers = trackCount === 0
        ? [1]
        : trackCount === 1
          ? [1, 2]
          : trackCount === 2
            ? [1, 2]
            : [1, 2, 3, 4];

      lanes
        .filter(({trackNumber}) => visibleTrackNumbers.includes(trackNumber))
        .forEach(({trackNumber, y}) => {
        const railY = y * 33;
        const centerY = 16.5;
        const start = segmentIndex === 0
          ? `M ${x1} ${railY}`
          : `M ${x1} ${centerY} L ${x1} ${railY}`;
        const end = segmentIndex < segments.length - 1 ? ` L ${x2} ${centerY}` : "";
        lines.push({
          x1,
          x2,
          trackNumber,
          y,
          d: `${start} L ${x2} ${railY}${end}`,
          occupied: trackCount >= trackNumber,
          overLimit:
            this.trackLimitEnabled && trackNumber <= trackCount && trackNumber > this.maxTracks,
        });
      });
    });

    this.topologyLines = lines;
    this.topologyCountBoxes = countBoxes;
  }

  private trackOffset(trackNumber: number): number {
    if (trackNumber === 1) {
      return 0;
    }
    if (trackNumber === 2) {
      return -3;
    }
    if (trackNumber % 2 === 1) {
      return -3 * ((trackNumber + 1) / 2);
    }
    return 3 * (trackNumber / 2 - 1);
  }
}

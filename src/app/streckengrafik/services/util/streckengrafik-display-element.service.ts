import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable, Subject} from "rxjs";

@Injectable({
  providedIn: "root",
})
export class StreckengrafikDisplayElementService {
  private readonly streckengrafikDisplayElementSubject = new BehaviorSubject<string>("all");
  private readonly streckengrafikDisplayElement$ =
    this.streckengrafikDisplayElementSubject.asObservable();

  private filterStreckengrafikTimeNotFocusNorSelected = false;
  private filterStreckengrafikNameNotFocusNorSelected = false;
  private showTimeSlider = true;
  private showRailTrackSlider = true;
  private showHeadwayBands = false;

  constructor() {}

  changed(eventTyp: string) {
    this.streckengrafikDisplayElementSubject.next(eventTyp);
  }

  getStreckengrafikDisplayElement(): Observable<string> {
    return this.streckengrafikDisplayElement$;
  }

  isFilterStreckengrafikTimeNotFocusNorEnabled(): boolean {
    return this.filterStreckengrafikTimeNotFocusNorSelected;
  }

  enableFilterStreckengrafikTimeNotFocusNorSelected() {
    this.filterStreckengrafikTimeNotFocusNorSelected = true;
    this.changed("timeOn");
  }

  disableFilterStreckengrafikTimeNotFocusNorSelected() {
    this.filterStreckengrafikTimeNotFocusNorSelected = false;
    this.changed("timeOff");
  }

  toggleFilterStreckengrafikTimeNotFocusNorSelected() {
    if (this.isFilterStreckengrafikTimeNotFocusNorEnabled()) {
      this.disableFilterStreckengrafikTimeNotFocusNorSelected();
      return;
    }
    this.enableFilterStreckengrafikTimeNotFocusNorSelected();
  }

  isFilterStreckengrafikNameNotFocusNorEnabled(): boolean {
    return this.filterStreckengrafikNameNotFocusNorSelected;
  }

  enableFilterStreckengrafikNameNotFocusNorSelected() {
    this.filterStreckengrafikNameNotFocusNorSelected = true;
    this.changed("nameOn");
  }

  disableFilterStreckengrafikNameNotFocusNorSelected() {
    this.filterStreckengrafikNameNotFocusNorSelected = false;
    this.changed("nameOff");
  }

  toggleFilterStreckengrafikNameNotFocusNorSelected() {
    if (this.isFilterStreckengrafikNameNotFocusNorEnabled()) {
      this.disableFilterStreckengrafikNameNotFocusNorSelected();
      return;
    }
    this.enableFilterStreckengrafikNameNotFocusNorSelected();
  }

  isTimeSliderVisible(): boolean {
    return this.showTimeSlider;
  }

  toggleTimeSliderVisibility() {
    this.showTimeSlider = !this.showTimeSlider;
    if (this.showTimeSlider) {
      this.changed("timeSliderOn");
    } else {
      this.changed("timeSliderOff");
    }
  }

  isRailTrackSliderVisible(): boolean {
    return this.showRailTrackSlider;
  }

  toggleRailTrackSliderVisibility() {
    this.showRailTrackSlider = !this.showRailTrackSlider;
    if (this.showTimeSlider) {
      this.changed("railTrackSliderOn");
    } else {
      this.changed("railTrackSliderOff");
    }
  }

  isHeadwayBandVisible(): boolean {
    return this.showHeadwayBands;
  }

  toggleHeadwayBands() {
    this.showHeadwayBands = !this.showHeadwayBands;
    if (this.showTimeSlider) {
      this.changed("headwayOn");
    } else {
      this.changed("headwayOff");
    }
  }
}

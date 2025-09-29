import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable} from "rxjs";

export interface SliderChangeInfo {
  zoom: number;
  move: number;
}

@Injectable({
  providedIn: "root",
})
export class DrawingBackgroundMouseListenerService {
  private readonly mousemoveSubject = new BehaviorSubject<MouseEvent>(undefined);
  private readonly mousemove$ = this.mousemoveSubject.asObservable();

  private readonly mouseenterSubject = new BehaviorSubject<MouseEvent>(undefined);
  private readonly mouseenter$ = this.mouseenterSubject.asObservable();

  private readonly mouseleaveSubject = new BehaviorSubject<MouseEvent>(undefined);
  private readonly mouseleave$ = this.mouseleaveSubject.asObservable();

  onMouseMove(event: MouseEvent) {
    this.mousemoveSubject.next(event);
  }

  getMouseMoveObservable(): Observable<MouseEvent> {
    return this.mousemove$;
  }

  onMouseEnter(event: MouseEvent) {
    this.mouseenterSubject.next(event);
  }

  getMouseEnterObservable(): Observable<MouseEvent> {
    return this.mouseenter$;
  }

  onMouseLeave(event: MouseEvent) {
    this.mouseleaveSubject.next(event);
  }

  getMouseLeaveObservable(): Observable<MouseEvent> {
    return this.mouseleave$;
  }
}

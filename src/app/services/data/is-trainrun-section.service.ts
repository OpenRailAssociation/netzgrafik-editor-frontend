import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {TrainrunService} from "./trainrun.service";

@Injectable({
  providedIn: "root",
})
export class IsTrainrunSelectedService implements OnDestroy {
  // Description of observable data service: https://coryrylan.com/blog/angular-observable-data-services
  trainrunIdSelectedSubject = new BehaviorSubject<number>(undefined);
  readonly trainrunIdSelecteds$ = this.trainrunIdSelectedSubject.asObservable();

  trainrunIdSelectedByClickSubject = new BehaviorSubject<number>(undefined);
  readonly trainrunIdSelectedByClick$ = this.trainrunIdSelectedByClickSubject.asObservable();

  private destroyed$ = new Subject<void>();

  constructor(private trainrunService: TrainrunService) {
    this.trainrunService.trainruns.pipe(takeUntil(this.destroyed$)).subscribe((trainruns) => {
      let selectedTrainrunId = undefined;
      if (trainruns) {
        const selectedTrainrun = this.trainrunService.getSelectedTrainrun();
        if (selectedTrainrun) {
          selectedTrainrunId = selectedTrainrun.getId();
        }
      }
      this.trainrunIdSelectedSubject.next(selectedTrainrunId);
    });
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  getTrainrunIdSelecteds(): Observable<number> {
    return this.trainrunIdSelecteds$;
  }

  setTrainrunIdSelectedByClick(trainrunIdSelected: number) {
    this.trainrunIdSelectedByClickSubject.next(trainrunIdSelected);
  }

  getTrainrunIdSelectedByClick(): Observable<number> {
    return this.trainrunIdSelectedByClick$;
  }
}

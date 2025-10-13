import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {SgSelectedTrainrun} from "../model/streckengrafik-model/sg-selected-trainrun";
import {Sg7PathSliderService} from "./sg-7-path-slider.service";
import {takeUntil} from "rxjs/operators";
import {SgTrainrun} from "../model/streckengrafik-model/sg-trainrun";
import {SgStopService} from "./sg-stop-.service";
import {UpdateCounterTriggerService} from "./util/update-counter.service";

@Injectable({
  providedIn: "root",
})
export class Sg8RenderService implements OnDestroy {
  private readonly selectedTrainrunSubject = new BehaviorSubject<SgSelectedTrainrun>(undefined);
  private readonly selectedTrainrun$ = this.selectedTrainrunSubject.asObservable();

  private readonly trainrunSubject = new BehaviorSubject<SgTrainrun[]>([]);
  private readonly trainrun$ = this.trainrunSubject.asObservable();

  private selectedTrainrun: SgSelectedTrainrun;

  private readonly destroyed$ = new Subject<void>();

  constructor(
    private readonly sg7PathSliderService: Sg7PathSliderService,
    private readonly updateCounterTriggerService: UpdateCounterTriggerService,
    private readonly sgStopService: SgStopService,
  ) {
    this.sg7PathSliderService
      .getSgSelectedTrainrun()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((selectedTrainrun) => {
        this.selectedTrainrun = selectedTrainrun;
        this.render();
      });
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  public getSgSelectedTrainrun(): Observable<SgSelectedTrainrun> {
    return this.selectedTrainrun$;
  }

  getTrainrun() {
    return this.trainrun$;
  }

  public doRender() {
    this.render();
  }

  private render() {
    if (this.sgStopService.isGO(this.selectedTrainrun.counter)) {
      this.trainrunSubject.next(this.selectedTrainrun.trainruns);
      this.selectedTrainrunSubject.next(this.selectedTrainrun);
      this.updateCounterTriggerService.sendUpdateTrigger();
    }
  }
}

import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Observable, Subscription} from "rxjs";
import {DataService} from "./data.service";
import {debounceTime, distinctUntilChanged, filter, map} from "rxjs/operators";

@Injectable({
  providedIn: "root",
})
export class AutoSaveService implements OnDestroy {
  private static readonly AUTOSAVE_TIMEOUT = 5000;

  modified$: Observable<boolean>;
  autosaveTrigger$: Observable<void>;

  private readonly modifiedSubject: BehaviorSubject<boolean>;

  private changesSubscription: Subscription;

  private currentNetzgrafikJSON: string;

  constructor(private readonly dataService: DataService) {
    this.modifiedSubject = new BehaviorSubject(false);
    this.modified$ = this.modifiedSubject.pipe(distinctUntilChanged());
    this.autosaveTrigger$ = this.modifiedSubject.pipe(
      filter((modified) => modified),
      debounceTime(AutoSaveService.AUTOSAVE_TIMEOUT),
      map(() => null),
    );
  }

  ngOnDestroy() {
    if (this.changesSubscription) {
      this.changesSubscription.unsubscribe();
    }
  }

  reset() {
    if (this.changesSubscription) {
      this.changesSubscription.unsubscribe();
    }
    this.modifiedSubject.next(false);
    this.currentNetzgrafikJSON = JSON.stringify(this.dataService.getNetzgrafikDto());
    this.changesSubscription = this.dataService
      .getNetzgrafikChangesObservable(300)
      .subscribe(() => {
        const newNetzgrafikJson = JSON.stringify(this.dataService.getNetzgrafikDto());
        const modified = newNetzgrafikJson !== this.currentNetzgrafikJSON;
        this.currentNetzgrafikJSON = newNetzgrafikJson;
        this.modifiedSubject.next(modified);
      });
  }

  disable() {
    if (this.changesSubscription) {
      this.changesSubscription.unsubscribe();
    }
    this.modifiedSubject.next(false);
  }
}

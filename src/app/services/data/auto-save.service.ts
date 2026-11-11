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

  // Model state which is known to be persisted (loaded from or saved to the backend).
  private savedNetzgrafikJSON: string;

  constructor(private readonly dataService: DataService) {
    this.modifiedSubject = new BehaviorSubject(false);
    this.modified$ = this.modifiedSubject.pipe(distinctUntilChanged());
    this.autosaveTrigger$ = this.modifiedSubject.pipe(
      filter((modified) => modified),
      debounceTime(AutoSaveService.AUTOSAVE_TIMEOUT),
      map((): void => null),
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
    this.savedNetzgrafikJSON = this.getCurrentNetzgrafikJson();
    this.modifiedSubject.next(false);
    this.changesSubscription = this.dataService
      .getNetzgrafikChangesObservable(300)
      .subscribe(() => this.updateModified());
  }

  disable() {
    if (this.changesSubscription) {
      this.changesSubscription.unsubscribe();
    }
    this.modifiedSubject.next(false);
  }

  isModified(): boolean {
    return this.modifiedSubject.value;
  }

  getCurrentNetzgrafikJson(): string {
    return JSON.stringify(this.dataService.getNetzgrafikDto());
  }

  /**
   * Marks the given model state as persisted. Changes made after this state was serialized
   * (e.g. while the save request was running) stay "modified" and are saved later.
   */
  markSaved(savedNetzgrafikJson: string) {
    this.savedNetzgrafikJSON = savedNetzgrafikJson;
    if (this.changesSubscription && !this.changesSubscription.closed) {
      this.updateModified();
    }
  }

  private updateModified() {
    this.modifiedSubject.next(this.getCurrentNetzgrafikJson() !== this.savedNetzgrafikJSON);
  }
}

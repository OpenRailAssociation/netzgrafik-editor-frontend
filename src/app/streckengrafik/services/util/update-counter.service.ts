import {Directive, Injectable, OnDestroy} from "@angular/core";

export interface UpdateCounterHandler {
  updateCounterCallback: () => void;
  getCurrentUpdateCounter: () => number;
  getUpdateCounterTriggerService: () => UpdateCounterTriggerService;
}

@Directive()
export class UpdateCounterController implements OnDestroy {
  constructor(
    private counter: number,
    private updateCounterHandler: UpdateCounterHandler,
  ) {
    this.updateCounterHandler
      .getUpdateCounterTriggerService()
      .registerUpdateHandler(updateCounterHandler, counter);
  }

  ngOnDestroy() {
    this.clear();
  }

  clear() {
    this.updateCounterHandler.getUpdateCounterTriggerService().clear(this.updateCounterHandler);
  }
}

@Injectable({
  providedIn: "root",
})
export class UpdateCounterTriggerService {
  private updateMap = new Map<UpdateCounterHandler, number>();

  constructor() {}

  registerUpdateHandler(updateCounterHandler: UpdateCounterHandler, counter: number) {
    this.updateMap.set(updateCounterHandler, counter);
  }

  sendUpdateTrigger() {
    this.updateMap.forEach((counter, updateCounterHandler) => {
      if (counter === updateCounterHandler.getCurrentUpdateCounter()) {
        updateCounterHandler.updateCounterCallback();
      }
    });
    this.updateMap.clear();
  }

  clear(updateCounterHandler: UpdateCounterHandler) {
    this.updateMap.delete(updateCounterHandler);
  }
}

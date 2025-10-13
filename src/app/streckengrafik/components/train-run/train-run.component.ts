import {Component, Input} from "@angular/core";
import {Observable} from "rxjs";
import {Sg8RenderService} from "../../services/sg-8-render.service";
import {SgTrainrun} from "../../model/streckengrafik-model/sg-trainrun";
import * as d3 from "d3";

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: "[sbb-train-run]",
  templateUrl: "./train-run.component.html",
  styleUrls: ["./train-run.component.scss"],
})
export class TrainRunComponent {
  @Input()
  doShowTrainruns = false;

  public trainrun$: Observable<SgTrainrun[]>;

  constructor(private readonly sg8RenderService: Sg8RenderService) {
    this.trainrun$ = this.sg8RenderService.getTrainrun();
  }

  getShowTrainruns(): boolean {
    return this.doShowTrainruns;
  }

  getId(trainrun: SgTrainrun) {
    return "streckengrafik_trainrun_item_" + trainrun.getId();
  }

  bringToFront(trainrun: SgTrainrun, event: MouseEvent) {
    if (event.buttons !== 0) {
      return;
    }
    const key = "#" + this.getId(trainrun);
    d3.select(key).raise();
  }
}

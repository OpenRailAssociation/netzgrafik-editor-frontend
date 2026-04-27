import {Component, HostListener} from "@angular/core";
import {DrawingBackgroundMouseListenerService} from "../../../services/util/drawingBackgroundMouseListener.service";
import {TrainrunService} from "../../../../services/data/trainrun.service";
import {Sg8RenderService} from "../../../services/sg-8-render.service";
import {UpdateCounterTriggerService} from "../../../services/util/update-counter.service";

@Component({
  selector: "sbb-drawing-background-mouse-listener",
  templateUrl: "./drawing-background-mouse-listener.component.html",
  styleUrls: ["./drawing-background-mouse-listener.component.scss"],
  standalone: false,
})
export class DrawingBackgroundMouseListenerComponent {
  private isMouseMovingButtonDown = false;

  constructor(
    private drawingBackgroundMouseListenerService: DrawingBackgroundMouseListenerService,
    private readonly trainrunService: TrainrunService,
    private readonly updateCounterTriggerService: UpdateCounterTriggerService,
    private sg8RenderService: Sg8RenderService,
  ) {}

  @HostListener("mouseup", ["$event"])
  public onMouseUp(event: MouseEvent) {
    if (this.isMouseMovingButtonDown) {
      this.isMouseMovingButtonDown = false;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    this.trainrunService.unselectAllTrainruns();
    this.sg8RenderService.doRender();
    this.updateCounterTriggerService.sendUpdateTrigger();
    return;
  }

  @HostListener("mousemove", ["$event"])
  public onMouseMove(event: MouseEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.buttons > 0) {
      this.isMouseMovingButtonDown = true;
    } else {
      this.updateCounterTriggerService.sendUpdateTrigger();
    }
    this.drawingBackgroundMouseListenerService.onMouseMove(event);
    return;
  }

  @HostListener("mouseenter", ["$event"])
  public onMouseEnter(event: MouseEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
    this.drawingBackgroundMouseListenerService.onMouseEnter(event);
    this.isMouseMovingButtonDown = false;
    return;
  }

  @HostListener("mouseleave", ["$event"])
  public onMouseLeave(event: MouseEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
    this.drawingBackgroundMouseListenerService.onMouseLeave(event);
    this.isMouseMovingButtonDown = false;

    this.updateCounterTriggerService.sendUpdateTrigger();

    return;
  }
}

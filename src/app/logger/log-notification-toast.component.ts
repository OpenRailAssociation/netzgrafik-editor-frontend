import {Component} from "@angular/core";
import {Observable, of} from "rxjs";
import {LogEntry, LogLevel, LogService} from "./log.service";
import {LogPublisher} from "./log.publishers";
import {SbbNotificationToast} from "@sbb-esta/angular/notification-toast";

@Component({
  selector: "sbb-log-notification-toast",
  templateUrl: "./log-notification-toast.component.html",
  styleUrls: ["./log-notification-toast.component.scss"],
  standalone: false,
})
export class LogNotificationToastComponent extends LogPublisher {
  duration = 3000;

  constructor(
    private _notification: SbbNotificationToast,
    private logService: LogService,
  ) {
    super();
    this.logService.appendPublisher(this);
  }

  log(entry: LogEntry): Observable<boolean> {
    const msg = entry.message;
    if (entry.level === LogLevel.Info) {
      this._notification.open(msg, {
        duration: this.duration,
        type: "info",
        verticalPosition: "top",
      });
    }
    if (entry.level === LogLevel.Warn) {
      this._notification.open(msg, {
        duration: this.duration,
        type: "warn",
        verticalPosition: "top",
      });
    }
    if (entry.level === LogLevel.Error) {
      this._notification.open(msg, {
        duration: this.duration,
        type: "error",
        verticalPosition: "top",
      });
    }
    if (entry.level === LogLevel.Fatal) {
      this._notification.open(msg, {
        duration: this.duration,
        type: "error",
        verticalPosition: "top",
      });
    }
    return of(true);
  }

  clear(): Observable<boolean> {
    return of(true);
  }
}

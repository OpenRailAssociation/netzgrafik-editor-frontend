import {Observable, of} from "rxjs";
import {LogEntry} from "./log.service";

export abstract class LogPublisher {
  abstract log(record: LogEntry): Observable<boolean>;

  abstract clear(): Observable<boolean>;
}

export class LogConsole extends LogPublisher {
  log(entry: LogEntry): Observable<boolean> {
    console.log(entry.buildLogString());
    return of(true);
  }

  clear(): Observable<boolean> {
    console.clear();
    return of(true);
  }
}

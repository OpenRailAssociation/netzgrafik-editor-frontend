import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable} from "rxjs";
import {ResizeChangeInfo} from "../../model/util/resizeChangeInfo";

@Injectable({
  providedIn: "root",
})
export class ResizeService {
  private oldResizeChangeInfo: ResizeChangeInfo = undefined;
  private readonly resizeChangeInfoSubject = new BehaviorSubject<ResizeChangeInfo>(
    new ResizeChangeInfo(),
  );
  private readonly resizeChangeInfo$ = this.resizeChangeInfoSubject.asObservable();

  getResizeChangeInfo(): Observable<ResizeChangeInfo> {
    return this.resizeChangeInfo$;
  }

  resizeChange(resizeChangeInfo: ResizeChangeInfo) {
    if (resizeChangeInfo.height === 0 || resizeChangeInfo.width === 0) {
      return;
    }
    if (this.oldResizeChangeInfo === undefined) {
      this.oldResizeChangeInfo = resizeChangeInfo;
      this.resizeChangeInfoSubject.next(resizeChangeInfo);
    }
    if (
      this.oldResizeChangeInfo.width !== resizeChangeInfo.width ||
      this.oldResizeChangeInfo.height !== resizeChangeInfo.height
    ) {
      this.oldResizeChangeInfo = resizeChangeInfo;
      this.resizeChangeInfoSubject.next(resizeChangeInfo);
    }
  }
}

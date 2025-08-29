import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from "@angular/common/http";
import {Observable, throwError} from "rxjs";
import {catchError} from "rxjs/operators";
import {Router} from "@angular/router";
import {LogService} from "../logger/log.service";
import {Injectable} from "@angular/core";

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  constructor(
    private router: Router,
    private logService: LogService,
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.error instanceof ErrorEvent) {
          this.logService.error(`Client failed to make request: ${error.error.message}`);
        } else {
          this.logService.error(`Backend error: ${error.status} ${error.statusText}`);
          switch (error.status) {
            case 401:
              this.router.navigateByUrl("/401");
              break;
            case 403:
              this.router.navigateByUrl("/403");
              break;
            case 404:
              this.router.navigateByUrl("/404");
              break;
            case 409:
              this.router.navigateByUrl("/409");
              break;
            default:
              this.router.navigateByUrl("/error");
              break;
          }
        }
        return throwError(() => error);
      }),
    );
  }
}

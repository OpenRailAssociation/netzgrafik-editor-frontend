import {
  HttpContextToken,
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

/**
 * Requests marked with this token (e.g. autosave) handle errors themselves: the interceptor
 * does not navigate to an error page, except for statuses where staying in the editor is
 * pointless (see {@link ALWAYS_NAVIGATE_STATUSES}).
 */
export const SKIP_ERROR_NAVIGATION = new HttpContextToken<boolean>(() => false);

const ALWAYS_NAVIGATE_STATUSES = [401, 403, 404];

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  constructor(
    private router: Router,
    private logService: LogService,
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (
          request.context.get(SKIP_ERROR_NAVIGATION) &&
          !ALWAYS_NAVIGATE_STATUSES.includes(error.status)
        ) {
          this.logService.debug(
            `Backend error ${error.status} handled by caller: ${request.method} ${request.url}`,
          );
          return throwError(() => error);
        }
        if (error.error instanceof ErrorEvent) {
          this.logService.error(`Client failed to make request: ${error.error.message}`);
        } else {
          this.logService.error(`Backend error: ${error.status}`);
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

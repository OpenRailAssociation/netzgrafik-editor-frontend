import {TestBed} from "@angular/core/testing";
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpContext,
  provideHttpClient,
  withInterceptorsFromDi,
} from "@angular/common/http";
import {HttpTestingController, provideHttpClientTesting} from "@angular/common/http/testing";
import {Router} from "@angular/router";
import {HttpErrorInterceptor, SKIP_ERROR_NAVIGATION} from "./http-error-interceptor";
import {LogService} from "../logger/log.service";

describe("HttpErrorInterceptor", () => {
  let httpClient: HttpClient;
  let httpTesting: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>("Router", ["navigateByUrl"]);
    TestBed.configureTestingModule({
      providers: [
        {provide: Router, useValue: router},
        {provide: LogService, useValue: jasmine.createSpyObj("LogService", ["debug", "error"])},
        {provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptor, multi: true},
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    httpClient = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  const request = (status: number, skipErrorNavigation: boolean): unknown => {
    let error: unknown;
    httpClient
      .get("/test", {context: new HttpContext().set(SKIP_ERROR_NAVIGATION, skipErrorNavigation)})
      .subscribe({error: (e) => (error = e)});
    httpTesting.expectOne("/test").flush(null, {status, statusText: "error"});
    return error;
  };

  it("navigates to the error page by default", () => {
    request(409, false);
    expect(router.navigateByUrl).toHaveBeenCalledWith("/409");
  });

  it("does not navigate if the request handles errors itself", () => {
    expect(request(409, true)).toBeTruthy();
    request(500, true);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it("still navigates on 401 for requests handling errors themselves", () => {
    request(401, true);
    expect(router.navigateByUrl).toHaveBeenCalledWith("/401");
  });
});

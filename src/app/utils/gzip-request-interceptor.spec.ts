import {TestBed} from "@angular/core/testing";
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpHandler,
  HttpRequest,
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from "@angular/common/http";
import {HttpTestingController, provideHttpClientTesting} from "@angular/common/http/testing";
import {filter, firstValueFrom, Subject} from "rxjs";
import {GZIP_MIN_SIZE_BYTES, GzipRequestInterceptor} from "./gzip-request-interceptor";

async function gunzip(blob: Blob): Promise<string> {
  return new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).text();
}

describe("GzipRequestInterceptor", () => {
  const url = "/v1/versions/1/snapshot";
  let http: HttpClient;
  let controller: HttpTestingController;
  let observedRequests: Subject<HttpRequest<unknown>>;

  beforeEach(() => {
    observedRequests = new Subject<HttpRequest<unknown>>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        {provide: HTTP_INTERCEPTORS, useClass: GzipRequestInterceptor, multi: true},
        {
          provide: HTTP_INTERCEPTORS,
          useValue: {
            intercept: (request: HttpRequest<unknown>, next: HttpHandler) => {
              observedRequests.next(request);
              return next.handle(request);
            },
          },
          multi: true,
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  async function waitForRequest(matchUrl: string, sendRequest: () => void) {
    const requestObserved = firstValueFrom(
      observedRequests.pipe(filter((request) => request.url === matchUrl)),
    );
    sendRequest();
    await requestObserved;
    return controller.expectOne(matchUrl);
  }

  it("sends large snapshot uploads gzip-compressed with Content-Encoding header", async () => {
    const dto = {name: "n", comment: "", model: "y".repeat(GZIP_MIN_SIZE_BYTES * 4)};

    const req = await waitForRequest(url, () => http.post(url, dto).subscribe());
    expect(req.request.headers.get("Content-Encoding")).toBe("gzip");
    expect(req.request.headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(await gunzip(req.request.body as Blob))).toEqual(dto);
    req.flush(1);
  });

  it("sends small snapshot uploads uncompressed", async () => {
    const dto = {name: "n", comment: "", model: "{}"};

    const req = await waitForRequest(url, () => http.post(url, dto).subscribe());
    expect(req.request.headers.has("Content-Encoding")).toBeFalse();
    expect(req.request.body).toEqual(dto);
    req.flush(1);
  });

  it("sends uncompressed when CompressionStream is not available", async () => {
    const original = (globalThis as {CompressionStream?: unknown}).CompressionStream;
    (globalThis as {CompressionStream?: unknown}).CompressionStream = undefined;
    try {
      const dto = {name: "n", comment: "", model: "z".repeat(GZIP_MIN_SIZE_BYTES * 4)};

      const req = await waitForRequest(url, () => http.post(url, dto).subscribe());
      expect(req.request.headers.has("Content-Encoding")).toBeFalse();
      expect(req.request.body).toEqual(dto);
      req.flush(1);
    } finally {
      (globalThis as {CompressionStream?: unknown}).CompressionStream = original;
    }
  });

  it("does not touch other requests", () => {
    const dto = {model: "x".repeat(GZIP_MIN_SIZE_BYTES * 4)};
    http.post("/v1/other", dto).subscribe();

    const req = controller.expectOne("/v1/other");
    expect(req.request.headers.has("Content-Encoding")).toBeFalse();
    expect(req.request.body).toEqual(dto);
    req.flush(1);
  });
});

import {TestBed} from "@angular/core/testing";
import {HttpHeaders, provideHttpClient} from "@angular/common/http";
import {HttpTestingController, provideHttpClientTesting} from "@angular/common/http/testing";
import {Configuration, VersionControllerBackendService} from "../../api/generated";
import {LogService} from "../../logger/log.service";
import {AutosaveBackendService} from "./autosave-backend.service";

async function gunzip(blob: Blob): Promise<string> {
  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

describe("AutosaveBackendService", () => {
  let service: AutosaveBackendService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    const versionsBackendService = {
      configuration: new Configuration({basePath: "/api"}),
      defaultHeaders: new HttpHeaders(),
    } as unknown as VersionControllerBackendService;
    TestBed.configureTestingModule({
      providers: [
        {provide: VersionControllerBackendService, useValue: versionsBackendService},
        {provide: LogService, useValue: jasmine.createSpyObj("LogService", ["debug"])},
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AutosaveBackendService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  const waitForRequest = async (url: string) => {
    for (let i = 0; i < 100; i++) {
      const requests = httpTesting.match(url);
      if (requests.length) {
        return requests[0];
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`no request to ${url}`);
  };

  it("sends large snapshots gzip compressed", async () => {
    const dto = {name: "n", comment: "", model: JSON.stringify({nodes: "äöü".repeat(100_000)})};
    let versionId: number | undefined;
    service.createSnapshotVersion(1, dto).subscribe((id) => (versionId = id));

    const req = await waitForRequest("/api/v1/versions/1/snapshot");
    expect(req.request.method).toBe("POST");
    expect(req.request.headers.get("Content-Encoding")).toBe("gzip");
    expect(req.request.headers.get("Content-Type")).toBe("application/json");
    const body = req.request.body as Blob;
    expect(body.size).toBeLessThan(JSON.stringify(dto).length / 10);
    expect(JSON.parse(await gunzip(body))).toEqual(dto);

    req.flush(42);
    expect(versionId).toBe(42);
  });

  it("sends small snapshots uncompressed", async () => {
    const dto = {name: "n", comment: "", model: "{}"};
    service.createSnapshotVersion(1, dto).subscribe();

    const req = await waitForRequest("/api/v1/versions/1/snapshot");
    expect(req.request.headers.has("Content-Encoding")).toBeFalse();
    expect(JSON.parse(await (req.request.body as Blob).text())).toEqual(dto);
    req.flush(1);
  });
});

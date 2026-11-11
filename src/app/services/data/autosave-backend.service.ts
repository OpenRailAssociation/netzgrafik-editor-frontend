import {Injectable} from "@angular/core";
import {HttpClient, HttpContext, HttpHeaders} from "@angular/common/http";
import {defer, from, Observable, switchMap, tap} from "rxjs";
import {
  Configuration,
  VariantDto,
  VersionControllerBackendService,
  VersionCreateSnapshotDto,
} from "../../api/generated";
import {SKIP_ERROR_NAVIGATION} from "../../utils/http-error-interceptor";
import {encodeJsonBody} from "../../utils/gzip-json";
import {LogService} from "../../logger/log.service";
import {VersionId} from "../../view/variant/variant-view/variant-history/model";

/**
 * Backend calls used by the save process. Same endpoints as the generated clients, but the
 * requests are marked with {@link SKIP_ERROR_NAVIGATION}: a failing (auto)save must not
 * navigate away from the editor. The generated clients do not support passing an HttpContext.
 */
@Injectable({
  providedIn: "root",
})
export class AutosaveBackendService {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly versionsBackendService: VersionControllerBackendService,
    private readonly logService: LogService,
  ) {}

  createSnapshotVersion(
    baseVersionId: VersionId,
    dto: VersionCreateSnapshotDto,
  ): Observable<VersionId> {
    const url = `${this.configuration.basePath}/v1/versions/${encodeURIComponent(String(baseVersionId))}/snapshot`;
    const options = this.requestOptions();
    // defer: serialize + compress at subscription time (and again on resubscribe)
    return defer(() => {
      const startTime = Date.now();
      return from(encodeJsonBody(dto)).pipe(
        tap((body) => {
          if (body.gzipped) {
            this.logService.debug(
              `snapshot request gzip: ${body.originalSize} -> ${body.data.size} bytes ` +
                `in ${Date.now() - startTime} ms`,
            );
          }
        }),
      );
    }).pipe(
      switchMap((body) => {
        let headers = options.headers.set("Content-Type", "application/json");
        if (body.gzipped) {
          headers = headers.set("Content-Encoding", "gzip");
        }
        return this.httpClient.post<VersionId>(url, body.data, {...options, headers});
      }),
    );
  }

  getVariant(variantId: number): Observable<VariantDto> {
    return this.httpClient.get<VariantDto>(
      `${this.configuration.basePath}/v1/variants/${encodeURIComponent(String(variantId))}`,
      this.requestOptions(),
    );
  }

  private get configuration(): Configuration {
    return this.versionsBackendService.configuration;
  }

  private requestOptions() {
    let headers = this.versionsBackendService.defaultHeaders ?? new HttpHeaders();
    const credential = this.configuration.lookupCredential("OAuth");
    if (credential) {
      headers = headers.set("Authorization", "Bearer " + credential);
    }
    return {
      headers,
      withCredentials: this.configuration.withCredentials,
      context: new HttpContext().set(SKIP_ERROR_NAVIGATION, true),
    };
  }
}

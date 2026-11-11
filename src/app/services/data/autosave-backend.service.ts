import {Injectable} from "@angular/core";
import {HttpClient, HttpContext, HttpHeaders} from "@angular/common/http";
import {Observable} from "rxjs";
import {
  Configuration,
  VariantDto,
  VersionControllerBackendService,
  VersionCreateSnapshotDto,
} from "../../api/generated";
import {SKIP_ERROR_NAVIGATION} from "../../utils/http-error-interceptor";
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
  ) {}

  createSnapshotVersion(
    baseVersionId: VersionId,
    dto: VersionCreateSnapshotDto,
  ): Observable<VersionId> {
    return this.httpClient.post<VersionId>(
      `${this.configuration.basePath}/v1/versions/${encodeURIComponent(String(baseVersionId))}/snapshot`,
      dto,
      this.requestOptions(),
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

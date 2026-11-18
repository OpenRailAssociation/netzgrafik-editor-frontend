import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {defer, from, Observable} from "rxjs";
import {switchMap} from "rxjs/operators";

/** Request bodies smaller than this are sent uncompressed (gzip overhead is not worth it). */
export const GZIP_MIN_SIZE_BYTES = 8 * 1024;

const SNAPSHOT_URL_PATTERN = /\/v1\/versions\/[^/]+\/snapshot$/;

/**
 * Serializes the payload to JSON and compresses it with gzip using the native CompressionStream.
 * Browsers never compress request bodies on their own, so this has to be done explicitly.
 * Returns undefined (= send uncompressed) if the payload is small, CompressionStream is not
 * available, or compression fails.
 */
export async function gzipJsonBody(payload: unknown): Promise<Blob | undefined> {
  if (typeof CompressionStream === "undefined") {
    return undefined;
  }
  try {
    const json = new Blob([JSON.stringify(payload)], {type: "application/json"});
    if (json.size < GZIP_MIN_SIZE_BYTES) {
      return undefined;
    }
    return await new Response(json.stream().pipeThrough(new CompressionStream("gzip"))).blob();
  } catch {
    return undefined;
  }
}

/**
 * Compresses the (potentially large) snapshot upload with gzip and marks it with
 * `Content-Encoding: gzip` (scripts may set this header; the backend decompresses it).
 * Falls back to the unchanged, uncompressed request whenever compression is not applicable.
 */
@Injectable()
export class GzipRequestInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (
      request.method !== "POST" ||
      !SNAPSHOT_URL_PATTERN.test(request.url) ||
      request.body === null ||
      typeof request.body !== "object" ||
      request.headers.has("Content-Encoding")
    ) {
      return next.handle(request);
    }
    // defer: compress at subscription time (and again on resubscribe, e.g. retry)
    return defer(() => from(gzipJsonBody(request.body))).pipe(
      switchMap((compressed) =>
        next.handle(
          compressed
            ? request.clone({
                body: compressed,
                headers: request.headers
                  .set("Content-Type", "application/json")
                  .set("Content-Encoding", "gzip"),
              })
            : request,
        ),
      ),
    );
  }
}

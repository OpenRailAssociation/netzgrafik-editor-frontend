/** Bodies below this size are sent uncompressed (gzip overhead not worth it). */
export const GZIP_MIN_SIZE_BYTES = 1024;

export type EncodedJsonBody =
  | {gzipped: true; data: Blob; originalSize: number}
  | {gzipped: false; data: Blob};

/**
 * Serializes the payload to JSON (UTF-8) and compresses it with gzip using the native
 * CompressionStream (runs off the main thread, streaming). Browsers never compress request
 * bodies automatically, so this has to be done explicitly. Falls back to uncompressed JSON if
 * CompressionStream is not supported or fails; the backend accepts both.
 */
export async function encodeJsonBody(payload: unknown): Promise<EncodedJsonBody> {
  const json = new Blob([JSON.stringify(payload)], {type: "application/json"});
  if (json.size < GZIP_MIN_SIZE_BYTES || typeof CompressionStream === "undefined") {
    return {gzipped: false, data: json};
  }
  try {
    const stream = json.stream().pipeThrough(new CompressionStream("gzip"));
    const data = await new Response(stream).blob();
    return {gzipped: true, data, originalSize: json.size};
  } catch {
    return {gzipped: false, data: json};
  }
}

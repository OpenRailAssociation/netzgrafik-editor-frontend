import {encodeJsonBody, GZIP_MIN_SIZE_BYTES} from "./gzip-json";

async function gunzip(blob: Blob): Promise<string> {
  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

describe("encodeJsonBody", () => {
  it("compresses payloads at or above the size threshold", async () => {
    const payload = {nodes: "äöü".repeat(100_000)};
    const json = JSON.stringify(payload);

    const body = await encodeJsonBody(payload);

    expect(body.gzipped).toBeTrue();
    if (body.gzipped) {
      expect(body.originalSize).toBe(new Blob([json]).size);
      expect(body.data.size).toBeLessThan(body.originalSize / 10);
    }
    expect(JSON.parse(await gunzip(body.data))).toEqual(payload);
  });

  it("does not compress payloads below the size threshold", async () => {
    const payload = {x: "y".repeat(GZIP_MIN_SIZE_BYTES - 20)};

    const body = await encodeJsonBody(payload);

    expect(body.gzipped).toBeFalse();
    expect(body.data.type).toBe("application/json");
    expect(JSON.parse(await body.data.text())).toEqual(payload);
  });

  it("falls back to uncompressed JSON without CompressionStream", async () => {
    const original = window.CompressionStream;
    (window as unknown as {CompressionStream: unknown}).CompressionStream = undefined;
    try {
      const payload = {x: "y".repeat(10_000)};
      const body = await encodeJsonBody(payload);
      expect(body.gzipped).toBeFalse();
      expect(JSON.parse(await body.data.text())).toEqual(payload);
    } finally {
      window.CompressionStream = original;
    }
  });

  it("falls back to uncompressed JSON if compression fails", async () => {
    const original = window.CompressionStream;
    (window as unknown as {CompressionStream: unknown}).CompressionStream = class {
      constructor() {
        throw new Error("unsupported");
      }
    };
    try {
      const payload = {x: "y".repeat(10_000)};
      const body = await encodeJsonBody(payload);
      expect(body.gzipped).toBeFalse();
      expect(JSON.parse(await body.data.text())).toEqual(payload);
    } finally {
      window.CompressionStream = original;
    }
  });
});

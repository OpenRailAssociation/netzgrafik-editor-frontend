import {
  decodeNetzgrafikFragment,
  encodeNetzgrafikFragment,
  getFragmentNetzgrafik,
  NetzgrafikImportService,
} from "./netzgrafik-import.service";
import {LogService} from "../../logger/log.service";

describe("getFragmentNetzgrafik", () => {
  it("returns null without the parameter", () => {
    expect(getFragmentNetzgrafik("")).toBeNull();
    expect(getFragmentNetzgrafik("#")).toBeNull();
    expect(getFragmentNetzgrafik("#other=1")).toBeNull();
    expect(getFragmentNetzgrafik("#netzgrafik=")).toBeNull();
  });

  it("returns the encoded data", () => {
    expect(getFragmentNetzgrafik("#netzgrafik=abc-_D")).toBe("abc-_D");
    expect(getFragmentNetzgrafik("#x=1&netzgrafik=abc")).toBe("abc");
  });
});

describe("Netzgrafik fragment encoding", () => {
  it("round-trips JSON text (deflate-raw, base64url)", async () => {
    const json = JSON.stringify({
      nodes: [{betriebspunktName: "Wien Hbf ÖBB"}],
      text: "x".repeat(70000),
    });
    const encoded = await encodeNetzgrafikFragment(json);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded.length).toBeLessThan(json.length / 10);
    expect(await decodeNetzgrafikFragment(encoded)).toBe(json);
  });

  it("rejects data that is not deflate-raw", async () => {
    await expectAsync(decodeNetzgrafikFragment("bm90IGNvbXByZXNzZWQ")).toBeRejected();
  });
});

const emptyDto = (): Record<string, unknown> => ({
  nodes: [],
  trainrunSections: [],
  trainruns: [],
  resources: [],
  metadata: {},
});

describe("NetzgrafikImportService", () => {
  it("recognises the top-level structure of a Netzgrafik JSON", () => {
    const dto = emptyDto();
    expect(NetzgrafikImportService.isNetzgrafikDto(dto)).toBeTrue();
    expect(NetzgrafikImportService.isNetzgrafikDto({nodes: []})).toBeFalse();
    expect(NetzgrafikImportService.isNetzgrafikDto(null)).toBeFalse();
    expect(NetzgrafikImportService.isNetzgrafikDto("nodes")).toBeFalse();
  });

  describe("with stubbed dependencies", () => {
    let logger: jasmine.SpyObj<LogService>;
    let service: NetzgrafikImportService;
    let imported: unknown[];

    beforeEach(() => {
      logger = jasmine.createSpyObj<LogService>("LogService", ["error", "info"]);
      service = new NetzgrafikImportService(null, null, null, null, null, null, null, logger);
      imported = [];
      spyOn(service, "importNetzgrafikDto").and.callFake((dto) => {
        imported.push(dto);
      });
    });

    it("rejects invalid JSON and non-Netzgrafik JSON", () => {
      expect(service.importNetzgrafikJson("{not json")).toBeFalse();
      expect(service.importNetzgrafikJson('{"nodes": []}')).toBeFalse();
      expect(logger.error).toHaveBeenCalledTimes(2);
      expect(imported).toEqual([]);
    });

    it("imports a Netzgrafik JSON", () => {
      const dto = emptyDto();
      expect(service.importNetzgrafikJson(JSON.stringify(dto))).toBeTrue();
      expect(imported).toEqual([dto]);
    });

    it("imports the Netzgrafik of a URL fragment", async () => {
      const dto = emptyDto();
      const encoded = await encodeNetzgrafikFragment(JSON.stringify(dto));
      expect(await service.importNetzgrafikFromFragment(encoded)).toBeTrue();
      expect(imported).toEqual([dto]);
    });

    it("logs an error if the fragment cannot be decoded", async () => {
      expect(await service.importNetzgrafikFromFragment("bm90IGNvbXByZXNzZWQ")).toBeFalse();
      expect(logger.error).toHaveBeenCalled();
      expect(imported).toEqual([]);
    });
  });
});

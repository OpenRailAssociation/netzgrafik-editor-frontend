import {NetzgrafikImportService} from "./netzgrafik-import.service";
import {LogService} from "../../logger/log.service";

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
  });
});

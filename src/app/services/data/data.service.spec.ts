import {DataService} from "./data.service";
import {NetzgrafikUnitTesting} from "../../../integration-testing/netzgrafik.unit.testing";
import {DataMigration} from "../../utils/data-migration";

describe("DataService", () => {
  it("ensureAllTrainrunSectionsHaveDiffertSourceAndTargetNodes removes invalid sections and related node links", () => {
    const dataService = Object.create(DataService.prototype) as DataService;
    const logger = {error: jasmine.createSpy("error")};
    (dataService as any).logger = logger;

    const localizeFn =
      (globalThis as any).$localize ||
      ((strings: TemplateStringsArray, ...expressions: unknown[]) =>
        strings.reduce(
          (acc, part, index) => acc + (index > 0 ? String(expressions[index - 1]) : "") + part,
          "",
        ));
    (globalThis as any).$localize = localizeFn;

    const dto = NetzgrafikUnitTesting.getUnitTestNetzgrafik();
    const node = dto.nodes[0];

    const maxSectionId = Math.max(...dto.trainrunSections.map((section) => section.id));
    const maxPortId = Math.max(...dto.nodes.flatMap((n) => n.ports.map((port) => port.id)));
    const maxTransitionId = Math.max(
      ...dto.nodes.flatMap((n) => n.transitions.map((transition) => transition.id)),
    );
    const maxTrainrunId = Math.max(...dto.trainruns.map((trainrun) => trainrun.id));

    const invalidSectionId = maxSectionId + 1;
    const orphanTrainrunId = maxTrainrunId + 1;
    const invalidPortId1 = maxPortId + 1;
    const invalidPortId2 = maxPortId + 2;
    const invalidTransitionId = maxTransitionId + 1;

    const portTemplate = node.ports[0];
    node.ports.push({...portTemplate, id: invalidPortId1, trainrunSectionId: invalidSectionId});
    node.ports.push({...portTemplate, id: invalidPortId2, trainrunSectionId: invalidSectionId});
    node.transitions.push({
      id: invalidTransitionId,
      port1Id: invalidPortId1,
      port2Id: invalidPortId2,
      isNonStopTransit: false,
    });

    const trainrunTemplate = dto.trainruns[0];
    dto.trainruns.push({...trainrunTemplate, id: orphanTrainrunId, name: "orphan-trainrun"});

    const sectionTemplate = dto.trainrunSections[0];
    dto.trainrunSections.push({
      ...sectionTemplate,
      id: invalidSectionId,
      sourceNodeId: node.id,
      targetNodeId: node.id,
      sourcePortId: invalidPortId1,
      targetPortId: invalidPortId2,
      trainrunId: orphanTrainrunId,
    });

    DataMigration.ensureAllTrainrunSectionsHaveDiffertSourceAndTargetNodes(dto, logger as any);

    expect(dto.trainrunSections.some((section) => section.id === invalidSectionId)).toBeFalse();
    expect(node.ports.some((port) => port.id === invalidPortId1)).toBeFalse();
    expect(node.ports.some((port) => port.id === invalidPortId2)).toBeFalse();
    expect(
      node.transitions.some((transition) => transition.id === invalidTransitionId),
    ).toBeFalse();
    expect(dto.trainruns.some((trainrun) => trainrun.id === orphanTrainrunId)).toBeFalse();
    expect(logger.error).toHaveBeenCalled();
  });
});

import {describe, it} from "node:test";
import {LogPublishersService} from "src/app/logger/log.publishers.service";
import {LogService} from "src/app/logger/log.service";
import {LabelService} from "src/app/services/data/label.service";
import {LabelGroupService} from "src/app/services/data/labelgroup.service";
import {TrainrunService} from "src/app/services/data/trainrun.service";
import {TrainrunSectionService} from "src/app/services/data/trainrunsection.service";
import {FilterService} from "src/app/services/ui/filter.service";
import {PerlenketteNode} from "./perlenketteNode";
import {PerlenketteSection} from "./perlenketteSection";

describe("PerlenketteModelTests", () => {
  it("Perlenkette-Model - Test - PerlenketteNode - 001", () => {
    const node = new PerlenketteNode(0, "BN", "Berm", 10, [], undefined, false, true, false);

    expect(node.isFristTrainrunPartNode()).toBe(false);
    expect(node.isLastTrainrunPartNode()).toBe(true);
    expect(node.isPerlenketteNode()).toBe(true);
    expect(node.isPerlenketteSection()).toBe(false);
    expect(node.getPerlenketteNode()).toEqual(node);
    expect(node.getPerlenketteSection()).toEqual(undefined);
  });

  it("Perlenkette-Model - Test - PerlenketteSection - 001", () => {
    const logPublishersService = new LogPublishersService();
    const logService = new LogService(logPublishersService);
    const labelGroupService = new LabelGroupService(logService);
    const labelService = new LabelService(logService, labelGroupService);
    const filterService = new FilterService(labelService, labelGroupService);
    const trainrunService = new TrainrunService(logService, labelService, filterService);
    const trainrunSectionService = new TrainrunSectionService(
      logService,
      trainrunService,
      filterService,
    );

    const section = new PerlenketteSection(
      0,
      10,
      undefined,
      undefined,
      0,
      false,
      false,
      true,
      trainrunSectionService,
    );

    expect(section.isFristTrainrunPartSection()).toBe(false);
    expect(section.isLastTrainrunPartSection()).toBe(true);
    expect(section.isPerlenketteNode()).toBe(false);
    expect(section.isPerlenketteSection()).toBe(true);
    expect(section.getPerlenketteNode()).toEqual(undefined);
    expect(section.getPerlenketteSection()).toEqual(section);
  });
});

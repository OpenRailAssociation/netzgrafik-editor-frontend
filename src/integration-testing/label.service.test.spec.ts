import {NodeService} from "../app/services/data/node.service";
import {TrainrunService} from "../app/services/data/trainrun.service";
import {TrainrunSectionService} from "../app/services/data/trainrunsection.service";
import {StammdatenService} from "../app/services/data/stammdaten.service";
import {DataService} from "../app/services/data/data.service";
import {ResourceService} from "../app/services/data/resource.service";
import {LogService} from "../app/logger/log.service";
import {LogPublishersService} from "../app/logger/log.publishers.service";
import {NoteService} from "../app/services/data/note.service";
import {LabelService} from "../app/services/data/label.service";
import {LabelGroupService} from "../app/services/data/labelgroup.service";
import {NetzgrafikUnitTesting} from "./netzgrafik.unit.testing";
import {Label} from "../app/models/label.model";
import {LabelGroup} from "../app/models/labelGroup.model";
import {LabelRef} from "../app/data-structures/business.data.structures";
import {FilterService} from "../app/services/ui/filter.service";
import {NetzgrafikColoringService} from "../app/services/data/netzgrafikColoring.service";

describe("LabelService Test", () => {
  let dataService: DataService = null;
  let nodeService: NodeService = null;
  let resourceService: ResourceService = null;
  let trainrunService: TrainrunService = null;
  let trainrunSectionService: TrainrunSectionService = null;
  let stammdatenService: StammdatenService = null;
  let noteService: NoteService = null;
  let logService: LogService = null;
  let logPublishersService: LogPublishersService = null;
  let labelGroupService: LabelGroupService = null;
  let labelService: LabelService = null;
  let filterService: FilterService = null;
  let netzgrafikColoringService: NetzgrafikColoringService = null;

  beforeEach(() => {
    stammdatenService = new StammdatenService();
    resourceService = new ResourceService();
    logPublishersService = new LogPublishersService();
    logService = new LogService(logPublishersService);
    labelGroupService = new LabelGroupService(logService);
    labelService = new LabelService(logService, labelGroupService);
    filterService = new FilterService(labelService, labelGroupService);
    trainrunService = new TrainrunService(logService, labelService, filterService);
    trainrunSectionService = new TrainrunSectionService(logService, trainrunService, filterService);
    nodeService = new NodeService(
      logService,
      resourceService,
      trainrunService,
      trainrunSectionService,
      labelService,
      filterService,
    );
    noteService = new NoteService(logService, labelService, filterService);
    netzgrafikColoringService = new NetzgrafikColoringService(logService);
    dataService = new DataService(
      resourceService,
      nodeService,
      trainrunSectionService,
      trainrunService,
      stammdatenService,
      noteService,
      labelService,
      labelGroupService,
      filterService,
      netzgrafikColoringService,
    );
  });

  it("getLabelFromId", () => {
    expect(labelService.getLabelFromId(-1)).toBe(undefined);
    expect(labelService.getLabelFromId(undefined)).toBe(undefined);
    expect(labelService.getLabelFromId(null)).toBe(undefined);
  });

  it("check label and labelgrp", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    const labelTrainrun: Label = labelService.getLabelFromId(0);
    const labelTrainrunGrps: LabelGroup[] = labelGroupService.getLabelGroupsFromLabelRef(
      labelTrainrun.getLabelRef(),
    );
    expect(labelTrainrunGrps.pop().getLabelRef() === labelTrainrun.getLabelRef()).toBe(true);
    expect(labelTrainrun.getDto().id).toBe(0);

    const labelNode: Label = labelService.getLabelFromId(3);
    const labelNodeGrps: LabelGroup[] = labelGroupService.getLabelGroupsFromLabelRef(
      labelNode.getLabelRef(),
    );
    expect(labelNodeGrps.pop().getLabelRef() === labelNode.getLabelRef()).toBe(true);
    expect(labelNode.getDto().id).toBe(3);
  });

  it("check label operators", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const labelTrainrun: Label = labelService.getLabelFromId(0);
    expect(labelTrainrun.getId()).toBe(0);
    expect(labelTrainrun.getLabel()).toBe("TestLabel");
    expect(labelTrainrun.getLabelRef()).toBe(LabelRef.Trainrun);
    expect(labelTrainrun.getLabelGroupId()).toBe(0);
  });

  it("check label set operators", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const labelTrainrun: Label = labelService.getLabelFromId(0);
    labelTrainrun.setLabel("test");
    expect(labelTrainrun.getLabel()).toBe("test");
  });

  it("getLabelsFromLabelRef", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(labelService.getLabelsFromLabelRef(LabelRef.Trainrun).length).toBe(3);
    expect(labelService.getLabelsFromLabelRef(LabelRef.Node).length).toBe(2);
    expect(labelService.getLabelsFromLabelRef(LabelRef.Undefinded).length).toBe(0);
  });

  it("getLabelsFromLabelGroupId", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const labelsGrp0 = labelService.getLabelsFromLabelGroupId(0);
    const labelsGrp1 = labelService.getLabelsFromLabelGroupId(1);

    expect(labelsGrp0.length).toBe(3);
    expect(labelsGrp1.length).toBe(2);
    const labelsGrp2 = labelService.getLabelsFromLabelGroupId(-1);
    const labelsGrp3 = labelService.getLabelsFromLabelGroupId(undefined);
    expect(labelsGrp2).toEqual([]);
    expect(labelsGrp3).toEqual([]);
  });

  it("getOrCreateLabel", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(labelService.getOrCreateLabel("TestLabel", LabelRef.Trainrun).getId()).toBe(0);
    const newLabelTrainrun: Label = labelService.getOrCreateLabel("SBB", LabelRef.Trainrun);
    expect(newLabelTrainrun.getLabel()).toBe("SBB");
    expect(newLabelTrainrun.getLabelRef()).toBe(LabelRef.Trainrun);
    const newLabelNode: Label = labelService.getOrCreateLabel("SBB", LabelRef.Node);
    expect(newLabelNode.getLabel()).toBe("SBB");
    expect(newLabelNode.getLabelRef()).toBe(LabelRef.Node);
    expect(newLabelNode.getId() !== newLabelTrainrun.getId()).toBe(true);
    const oldLabelNode: Label = labelService.getOrCreateLabel("SBB", LabelRef.Node);
    expect(newLabelNode.getId() === oldLabelNode.getId()).toBe(true);
    const undefinedLabelNode: Label = labelService.getOrCreateLabel("SBB", LabelRef.Undefinded);
    expect(undefinedLabelNode.getLabel()).toBe("SBB");
    expect(undefinedLabelNode.getLabelRef()).toBe(LabelRef.Undefinded);
  });

  it("getLabelsFromIds", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(labelService.getLabelsFromIds([3, 4]).length).toBe(2);
    expect(labelService.getLabelsFromIds([undefined, 4]).length).toBe(1);
    expect(labelService.getLabelsFromIds([undefined]).length).toBe(0);
    expect(labelService.getLabelsFromIds([]).length).toBe(0);
  });

  it("trainrun and labels", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunService.getAllTrainrunLabels().length).toBe(3);
    expect(trainrunService.getTrainrunFromId(0).getLabelIds().length).toBe(1);
    trainrunService.getTrainrunFromId(0).setLabelIds([0, 1]);
    expect(trainrunService.getTrainrunFromId(0).getLabelIds().length).toBe(2);
  });

  it("node and labels", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodeService.getAllNodeLabels().length).toBe(2);
  });

  it("doUserDefinedLabelsOrdering", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const labelsGrp0Org = labelService.getLabelsFromLabelGroupId(0);
    expect(labelsGrp0Org.findIndex((el: Label) => el.getId() === 0)).toBe(0);
    expect(labelsGrp0Org.findIndex((el: Label) => el.getId() === 1)).toBe(1);
    expect(labelsGrp0Org.findIndex((el: Label) => el.getId() === 2)).toBe(2);

    const labelsGrp1Org = labelService.getLabelsFromLabelGroupId(1);
    expect(labelsGrp1Org.findIndex((el: Label) => el.getId() === 3)).toBe(0);
    expect(labelsGrp1Org.findIndex((el: Label) => el.getId() === 4)).toBe(1);

    labelService.doUserDefinedLabelsOrdering([4, 3]);

    const postSortLabelsGrp0Org = labelService.getLabelsFromLabelGroupId(0);
    expect(postSortLabelsGrp0Org.findIndex((el: Label) => el.getId() === 0)).toBe(0);
    expect(postSortLabelsGrp0Org.findIndex((el: Label) => el.getId() === 1)).toBe(1);
    expect(postSortLabelsGrp0Org.findIndex((el: Label) => el.getId() === 2)).toBe(2);

    const postSortLabelsGrp1Org = labelService.getLabelsFromLabelGroupId(1);
    expect(postSortLabelsGrp1Org.findIndex((el: Label) => el.getId() === 4)).toBe(0);
    expect(postSortLabelsGrp1Org.findIndex((el: Label) => el.getId() === 3)).toBe(1);

    labelService.doUserDefinedLabelsOrdering([2, 0, 1]);

    const post2ndSortLabelsGrp0Org = labelService.getLabelsFromLabelGroupId(0);
    expect(post2ndSortLabelsGrp0Org.findIndex((el: Label) => el.getId() === 0)).toBe(1);
    expect(post2ndSortLabelsGrp0Org.findIndex((el: Label) => el.getId() === 1)).toBe(2);
    expect(post2ndSortLabelsGrp0Org.findIndex((el: Label) => el.getId() === 2)).toBe(0);

    const post2ndSortLabelsGrp1Org = labelService.getLabelsFromLabelGroupId(1);
    expect(post2ndSortLabelsGrp1Org.findIndex((el: Label) => el.getId() === 4)).toBe(0);
    expect(post2ndSortLabelsGrp1Org.findIndex((el: Label) => el.getId() === 3)).toBe(1);
  });

  it("getLabelFromLabelAndLabelRef", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(labelService.getLabelFromLabelAndLabelRef("Test", LabelRef.Node).getId()).toBe(4);
    expect(labelService.getLabelFromLabelAndLabelRef("Te2st", LabelRef.Node)).toBe(undefined);
    expect(labelService.getLabelFromLabelAndLabelRef("test", LabelRef.Node)).toBe(undefined);
    expect(labelService.getLabelFromLabelAndLabelRef(" test", LabelRef.Node)).toBe(undefined);
    expect(labelService.getLabelFromLabelAndLabelRef(" test ", LabelRef.Node)).toBe(undefined);

    expect(labelService.getLabelFromLabelAndLabelRef("Test", LabelRef.Trainrun).getId()).toBe(1);
    expect(labelService.getLabelFromLabelAndLabelRef("Te2st", LabelRef.Trainrun)).toBe(undefined);
    expect(labelService.getLabelFromLabelAndLabelRef("test", LabelRef.Trainrun)).toBe(undefined);
    expect(labelService.getLabelFromLabelAndLabelRef(" test", LabelRef.Trainrun)).toBe(undefined);
    expect(labelService.getLabelFromLabelAndLabelRef(" test ", LabelRef.Trainrun)).toBe(undefined);

    expect(labelService.getLabelFromLabelAndLabelRef("Test", LabelRef.Undefinded)).toBe(undefined);
    expect(labelService.getLabelFromLabelAndLabelRef("Te2st", LabelRef.Undefinded)).toBe(undefined);
    expect(labelService.getLabelFromLabelAndLabelRef("test", LabelRef.Undefinded)).toBe(undefined);
    expect(labelService.getLabelFromLabelAndLabelRef(" test", LabelRef.Undefinded)).toBe(undefined);
    expect(labelService.getLabelFromLabelAndLabelRef(" test ", LabelRef.Undefinded)).toBe(
      undefined,
    );

    expect(labelService.getLabelFromLabelAndLabelRef(null, LabelRef.Node)).toBe(undefined);
    expect(labelService.getLabelFromLabelAndLabelRef(null, LabelRef.Trainrun)).toBe(undefined);
    expect(labelService.getLabelFromLabelAndLabelRef(null, LabelRef.Undefinded)).toBe(undefined);

    expect(labelService.getLabelFromLabelAndLabelRef(undefined, LabelRef.Node)).toBe(undefined);
    expect(labelService.getLabelFromLabelAndLabelRef(undefined, LabelRef.Trainrun)).toBe(undefined);
    expect(labelService.getLabelFromLabelAndLabelRef(undefined, LabelRef.Undefinded)).toBe(
      undefined,
    );
  });

  it("getLabelsFromLabelGroupId", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(labelService.getLabelsFromLabelGroupId(0).length).toBe(3);
    expect(labelService.getLabelsFromLabelGroupId(1).length).toBe(2);
    expect(labelService.getLabelsFromLabelGroupId(undefined).length).toBe(0);
    expect(labelService.getLabelsFromLabelGroupId(-1).length).toBe(0);
    expect(labelService.getLabelsFromLabelGroupId(2).length).toBe(0);
  });

  it("deleteLabel", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    labelService.deleteLabel(0);
    expect(labelService.getLabelFromId(0)).toBe(undefined);
  });

  it("updateLabel", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    labelService.updateLabel(0, "qwertz");
    expect(labelService.getLabelFromId(0).getLabel()).toBe("qwertz");
    labelService.updateLabel(0, undefined);
    expect(labelService.getLabelFromId(0).getLabel()).toBe(undefined);
  });
});

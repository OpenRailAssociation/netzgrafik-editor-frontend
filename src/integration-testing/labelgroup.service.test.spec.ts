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
import {LabelRef, NetzgrafikDto} from "../app/data-structures/business.data.structures";
import {FilterService} from "../app/services/ui/filter.service";
import {NetzgrafikColoringService} from "../app/services/data/netzgrafikColoring.service";

describe("LabelGroupService Test", () => {
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

  it("set label group name", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const trainrunGrp: LabelGroup = labelGroupService.getDefaultLabelGroup(LabelRef.Trainrun);
    const nodeGrp: LabelGroup = labelGroupService.getDefaultLabelGroup(LabelRef.Node);
    expect(trainrunGrp.getDto().id).toBe(0);
    expect(nodeGrp.getDto().id).toBe(1);
    expect(trainrunGrp.getName()).toBe("Standard");
    trainrunGrp.setName("x");
    expect(trainrunGrp.getName()).toBe("x");
  });

  it("check label and labelgrp", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    const labelTrainrun: Label = labelService.getLabelFromId(0);
    const labelTrainrunGrps: LabelGroup[] = labelGroupService.getLabelGroupsFromLabelRef(
      labelTrainrun.getLabelRef(),
    );
    expect(labelTrainrunGrps.pop().getLabelRef() === labelTrainrun.getLabelRef()).toBe(true);
    const labelNode: Label = labelService.getLabelFromId(3);
    const labelNodeGrps: LabelGroup[] = labelGroupService.getLabelGroupsFromLabelRef(
      labelNode.getLabelRef(),
    );
    expect(labelNodeGrps.pop().getLabelRef() === labelNode.getLabelRef()).toBe(true);
  });

  it("getLabelGroupsFromLabelRef", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(labelGroupService.getLabelGroupsFromLabelRef(LabelRef.Undefinded).length).toBe(0);
    expect(labelGroupService.getLabelGroupsFromLabelRef(LabelRef.Trainrun).length).toBe(1);
    expect(labelGroupService.getLabelGroupsFromLabelRef(LabelRef.Node).pop().getId()).toBe(1);
  });

  it("getLabelGroup", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(labelGroupService.getLabelGroup(1).getId()).toBe(1);
  });

  it("createLabelGroup", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(labelGroupService.createLabelGroup(LabelRef.Node).getLabelRef()).toBe(LabelRef.Node);
    expect(labelGroupService.getLabelGroupsFromLabelRef(LabelRef.Undefinded).length).toBe(0);
    expect(labelGroupService.getLabelGroupsFromLabelRef(LabelRef.Trainrun).length).toBe(1);
    expect(labelGroupService.getLabelGroupsFromLabelRef(LabelRef.Node).pop().getLabelRef()).toBe(
      LabelRef.Node,
    );
    expect(labelGroupService.getLabelGroupsFromLabelRef(LabelRef.Undefinded).length).toBe(0);
    expect(labelGroupService.createLabelGroup(LabelRef.Undefinded).getLabelRef()).toBe(
      LabelRef.Undefinded,
    );
    expect(labelGroupService.getLabelGroupsFromLabelRef(LabelRef.Undefinded).length).toBe(1);
  });

  it("getDefaultLabelGroup", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(labelGroupService.getDefaultLabelGroup(LabelRef.Node).getId()).toBe(1);
    labelGroupService.deleteLabelGroup(0);
    labelGroupService.deleteLabelGroup(1);
    expect(labelGroupService.getDefaultLabelGroup(LabelRef.Trainrun).getLabelRef()).toBe(
      LabelRef.Trainrun,
    );
    expect(labelGroupService.getDefaultLabelGroup(LabelRef.Undefinded).getLabelRef()).toBe(
      LabelRef.Undefinded,
    );

    const newLGrp = labelGroupService.createLabelGroup(LabelRef.Node);
    expect(newLGrp.getLabelRef()).toBe(LabelRef.Node);
    expect(labelGroupService.getLabelGroupsFromLabelRef(LabelRef.Node).length).toBe(2);
    labelGroupService.deleteLabelGroup(-1);
    expect(labelGroupService.getLabelGroupsFromLabelRef(LabelRef.Node).length).toBe(2);
    labelGroupService.deleteLabelGroup(newLGrp.getId());
    expect(labelGroupService.getLabelGroupsFromLabelRef(LabelRef.Node).length).toBe(1);
  });

  it("isDfaultGroup", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(labelGroupService.isDefaultGroup(0)).toBe(true);
    expect(labelGroupService.isDefaultGroup(1)).toBe(true);
    expect(labelGroupService.isDefaultGroup(undefined)).toBe(false);
    expect(labelGroupService.isDefaultGroup(null)).toBe(false);
  });

  it("getAutoCompleteLabels", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(labelGroupService.getAutoCompleteLabels([], LabelRef.Undefinded).length).toBe(0);
    expect(labelGroupService.getAutoCompleteLabels([], LabelRef.Node).length).toBe(2);
    expect(labelGroupService.getAutoCompleteLabels(["Label"], LabelRef.Node).length).toBe(1);
    expect(
      labelGroupService.getAutoCompleteLabels(["Label", "Test"], LabelRef.Trainrun).length,
    ).toBe(1);
    expect(labelGroupService.getAutoCompleteLabels(["Label", "Test"], LabelRef.Node).length).toBe(
      0,
    );
    expect(labelGroupService.getAutoCompleteLabels(["Label", "X"], LabelRef.Node).length).toBe(1);
    expect(labelGroupService.getAutoCompleteLabels(["Y", "X"], LabelRef.Node).length).toBe(2);
    expect(labelGroupService.getAutoCompleteLabels([], LabelRef.Undefinded).length).toBe(0);
    expect(labelGroupService.getAutoCompleteLabels(["Y"], LabelRef.Undefinded).length).toBe(0);
    expect(labelGroupService.getAutoCompleteLabels(["Label"], LabelRef.Undefinded).length).toBe(0);
  });

  it("getDefaultLabelGroup - empty start", () => {
    const netzgrafik: NetzgrafikDto = NetzgrafikUnitTesting.getUnitTestNetzgrafik();
    netzgrafik.labelGroups = [];
    netzgrafik.labels = [];
    dataService.loadNetzgrafikDto(netzgrafik);
    expect(labelGroupService.isDefaultGroup(0)).toBe(false);
    expect(labelGroupService.isDefaultGroup(1)).toBe(false);
    expect(labelGroupService.isDefaultGroup(undefined)).toBe(false);
    expect(labelGroupService.isDefaultGroup(null)).toBe(false);
    const defaultTrainrun = labelGroupService.getDefaultLabelGroup(LabelRef.Trainrun);
    expect(defaultTrainrun.getLabelRef()).toBe(LabelRef.Trainrun);
    const defaultNode = labelGroupService.getDefaultLabelGroup(LabelRef.Node);
    expect(defaultNode.getLabelRef()).toBe(LabelRef.Node);
    const defaultUndefinded = labelGroupService.getDefaultLabelGroup(LabelRef.Undefinded);
    expect(defaultUndefinded.getLabelRef()).toBe(LabelRef.Undefinded);

    expect(
      defaultTrainrun.getId() === labelGroupService.getDefaultLabelGroup(LabelRef.Trainrun).getId(),
    ).toBe(true);
    expect(
      defaultNode.getId() === labelGroupService.getDefaultLabelGroup(LabelRef.Node).getId(),
    ).toBe(true);
    expect(
      defaultUndefinded.getId() ===
        labelGroupService.getDefaultLabelGroup(LabelRef.Undefinded).getId(),
    ).toBe(true);

    expect(labelGroupService.isDefaultGroup(defaultTrainrun.getId())).toBe(true);
    expect(labelGroupService.isDefaultGroup(defaultNode.getId())).toBe(true);
    expect(labelGroupService.isDefaultGroup(defaultUndefinded.getId())).toBe(true);
  });
});

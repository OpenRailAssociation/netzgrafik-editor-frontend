import {DataService} from "../data/data.service";
import {NodeService} from "../data/node.service";
import {ResourceService} from "../data/resource.service";
import {TrainrunService} from "../data/trainrun.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {StammdatenService} from "../data/stammdaten.service";
import {NoteService} from "../data/note.service";
import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {LogService} from "../../logger/log.service";
import {LogPublishersService} from "../../logger/log.publishers.service";
import {LabelGroupService} from "../data/labelgroup.service";
import {LabelService} from "../data/label.service";
import {NetzgrafikUnitTesting} from "../../../integration-testing/netzgrafik.unit.testing";
import {FilterService} from "../ui/filter.service";
import {AnalyticsService} from "../analytics/analytics.service";
import {NetzgrafikColoringService} from "../data/netzgrafikColoring.service";
import {FilterSetting} from "../../models/filterSettings.model";

describe("FilterService", () => {
  let dataService: DataService;
  let nodeService: NodeService;
  let resourceService: ResourceService;
  let trainrunService: TrainrunService;
  let trainrunSectionService: TrainrunSectionService;
  let stammdatenService: StammdatenService;
  let noteService: NoteService;
  let nodes: Node[] = null;
  let trainrunSections: TrainrunSection[] = null;
  let logService: LogService = null;
  let logPublishersService: LogPublishersService = null;
  let labelGroupService: LabelGroupService = null;
  let labelService: LabelService = null;
  let analyticsService: AnalyticsService = null;
  let filterService: FilterService = null;
  let netzgrafikColoringService: NetzgrafikColoringService = null;
  let gotFilterChangedSignal = false;

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
    nodeService.nodes.subscribe((updatesNodes) => (nodes = updatesNodes));
    analyticsService = new AnalyticsService(
      nodeService,
      trainrunSectionService,
      trainrunService,
      filterService,
    );

    nodeService.nodes.subscribe((updatesNodes) => (nodes = updatesNodes));
    trainrunSectionService.trainrunSections.subscribe(
      (updatesTrainrunSections) => (trainrunSections = updatesTrainrunSections),
    );
    filterService.filter.subscribe(() => (gotFilterChangedSignal = true));
  });

  it("Filter default all off", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);
    expect(trainrunSections.length).toBe(8);

    nodes.forEach((n: Node) => expect(filterService.checkFilterNode(n)).toBe(true));
    trainrunSections.forEach((ts: TrainrunSection) =>
      expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(true),
    );
  });

  it("Filter Trainrun Category", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);

    filterService.disableFilterTrainrunCategory(dataService.getTrainrunCategory(3));
    filterService.disableFilterTrainrunCategory(dataService.getTrainrunCategory(4));
    trainrunSections.forEach((ts: TrainrunSection) => {
      if (
        ts.getTrainrun().getCategoryShortName() === "RE" ||
        ts.getTrainrun().getCategoryShortName() === "S"
      ) {
        expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(false);
      } else {
        expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(true);
      }
    });
  });

  it("Filter Trainrun Frequency", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);

    filterService.disableFilterTrainrunFrequency(dataService.getTrainrunFrequency(3));
    trainrunSections.forEach((ts: TrainrunSection) => {
      if (ts.getTrainrun().getTrainrunFrequency().shortName === "60") {
        expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(false);
      } else {
        expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(true);
      }
    });
  });

  it("Filter Trainrun Labels - Sub-Test: 1", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);
    labelGroupService.getLabelGroup(0).enableLogicalFilterOperatorOr();
    filterService.setFilterTrainrunLabels([0]);
    trainrunSections.forEach((ts: TrainrunSection) => {
      if (ts.getTrainrun().getId() === 0) {
        expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(false);
      } else {
        expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(true);
      }
    });
  });
  it("Filter Trainrun Labels - Sub-Test: 2", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);
    labelGroupService.getLabelGroup(0).enableLogicalFilterOperatorOr();
    filterService.setFilterTrainrunLabels([1]);
    trainrunSections.forEach((ts: TrainrunSection) => {
      if (ts.getTrainrun().getId() === 1) {
        expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(false);
      } else {
        expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(true);
      }
    });
  });
  it("Filter Trainrun Labels - Sub-Test: 3", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);
    labelGroupService.getLabelGroup(0).enableLogicalFilterOperatorOr();
    filterService.setFilterTrainrunLabels([1, 2]);
    trainrunSections.forEach((ts: TrainrunSection) => {
      if ([1, 2].includes(ts.getTrainrun().getId())) {
        expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(false);
      } else {
        expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(true);
      }
    });
  });
  it("Filter Trainrun Labels - Sub-Test: 4", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);
    labelGroupService.getLabelGroup(0).enableLogicalFilterOperatorOr();
    filterService.setFilterTrainrunLabels([0, 1, 2]);
    trainrunSections.forEach((ts: TrainrunSection) => {
      if ([0, 1, 2, 3].includes(ts.getTrainrun().getId())) {
        expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(false);
      } else {
        expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(true);
      }
    });
  });
  it("Filter Trainrun Labels - Sub-Test: 5", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);
    labelGroupService.getLabelGroup(0).enableLogicalFilterOperatorAnd();
    filterService.setFilterTrainrunLabels([]);
    trainrunSections.forEach((ts: TrainrunSection) => {
      if ([0, 1, 2].includes(ts.getTrainrun().getId())) {
        expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(false);
      } else {
        expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(true);
      }
    });
  });

  it("setFilterTrainrunLabels", () => {
    const ids = [19, 78, 25, 4];
    filterService.setFilterTrainrunLabels(ids);
    expect(filterService.getFilterTrainrunLabels().filter((v) => ids.includes(v)).length).toBe(4);
    filterService.clearFilterTrainrunLabels();
    expect(filterService.getFilterTrainrunLabels().length).toBe(0);
  });

  it("setFilterNodeLabels", () => {
    const ids = [25, 4];
    filterService.setFilterNodeLabels(ids);
    expect(filterService.getFilterNodeLabels().filter((v) => ids.includes(v)).length).toBe(2);
    filterService.clearFilterNodeLabels();
    expect(filterService.getFilterNodeLabels().length).toBe(0);
  });

  it("setTimeDisplayPrecision", () => {
    filterService.setTimeDisplayPrecision(2);
    expect(filterService.getTimeDisplayPrecision()).toBe(2);
    filterService.setTimeDisplayPrecision(undefined);
    expect(filterService.getTimeDisplayPrecision()).toBe(undefined);
    filterService.setTimeDisplayPrecision(null);
    expect(filterService.getTimeDisplayPrecision()).toBe(null);
  });

  it("isAnyFilterActive", () => {
    expect(filterService.isAnyFilterActive()).toBe(false);
  });

  it("enableFilterTrainrunCategory", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);

    const trainrun = trainrunService.getTrainrunFromId(0);
    const category = dataService.getTrainrunCategory(1);

    filterService.disableFilterTrainrunCategory(category);
    expect(filterService.isAnyFilterActive()).toBe(true);
    expect(filterService.isFilterTrainrunCategoryEnabled(category)).toBe(false);
    expect(filterService.filterTrainrun(trainrun)).toBe(false);

    filterService.resetFilterTrainrunCategory();
    expect(filterService.isAnyFilterActive()).toBe(false);

    expect(filterService.filterTrainrun(trainrun)).toBe(true);
  });

  it("enableFilterTrainrunTimeCategory", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);

    const trainrun = trainrunService.getTrainrunFromId(0);
    const trainrunTimeCategory = dataService.getTrainrunTimeCategory(0);

    filterService.disableFilterTrainrunTimeCategory(trainrunTimeCategory);
    expect(filterService.isFilterTrainrunTimeCategoryEnabled(trainrunTimeCategory)).toBe(false);
    expect(filterService.isAnyFilterActive()).toBe(true);
    expect(filterService.filterTrainrun(trainrun)).toBe(false);

    filterService.resetFilterTrainrunTimeCategory();
    expect(filterService.isAnyFilterActive()).toBe(false);

    expect(filterService.filterTrainrun(trainrun)).toBe(true);
  });

  it("enableFilterTrainrunFrequency", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);

    const trainrun = trainrunService.getTrainrunFromId(0);
    const frequency = dataService.getTrainrunFrequency(3);

    filterService.disableFilterTrainrunFrequency(frequency);
    expect(filterService.isFilterTrainrunFrequencyEnabled(frequency)).toBe(false);
    expect(filterService.isAnyFilterActive()).toBe(true);
    expect(filterService.filterTrainrun(trainrun)).toBe(false);

    filterService.resetFilterTrainrunFrequency();
    expect(filterService.isAnyFilterActive()).toBe(false);

    expect(filterService.filterTrainrun(trainrun)).toBe(true);
  });

  it("filterChanged", () => {
    gotFilterChangedSignal = false;
    expect(gotFilterChangedSignal).toBe(false);
    filterService.filterChanged();
    expect(gotFilterChangedSignal).toBe(true);
  });

  it("enableFilterArrivalDepartureTime", () => {
    expect(filterService.isFilterArrivalDepartureTimeEnabled()).toBe(true);
    filterService.disableFilterArrivalDepartureTime();
    expect(filterService.isFilterArrivalDepartureTimeEnabled()).toBe(false);
    filterService.enableFilterArrivalDepartureTime();
    expect(filterService.isFilterArrivalDepartureTimeEnabled()).toBe(true);
  });

  it("enableFilterTravelTime", () => {
    expect(filterService.isFilterTravelTimeEnabled()).toBe(true);
    filterService.disableFilterTravelTime();
    expect(filterService.isFilterTravelTimeEnabled()).toBe(false);
    filterService.enableFilterTravelTime();
    expect(filterService.isFilterTravelTimeEnabled()).toBe(true);
  });

  it("enableFilterShowNonStopTime", () => {
    expect(filterService.isFilterShowNonStopTimeEnabled()).toBe(true);
    filterService.disableFilterShowNonStopTime();
    expect(filterService.isFilterShowNonStopTimeEnabled()).toBe(false);
    filterService.enableFilterShowNonStopTime();
    expect(filterService.isFilterShowNonStopTimeEnabled()).toBe(true);
  });

  it("enableFilterTrainrunName", () => {
    expect(filterService.isFilterTrainrunNameEnabled()).toBe(true);
    filterService.disableFilterTrainrunName();
    expect(filterService.isFilterTrainrunNameEnabled()).toBe(false);
    filterService.enableFilterTrainrunName();
    expect(filterService.isFilterTrainrunNameEnabled()).toBe(true);
  });

  it("enableFilterConnections", () => {
    expect(filterService.isFilterConnectionsEnabled()).toBe(true);
    filterService.disableFilterConnections();
    expect(filterService.isFilterConnectionsEnabled()).toBe(false);
    filterService.enableFilterConnections();
    expect(filterService.isFilterConnectionsEnabled()).toBe(true);
  });

  it("checkFilterNodeLabels", () => {
    filterService.clearFilterNodeLabels();
    filterService.clearFilterTrainrunLabels();
    filterService.resetFilterTrainrunTimeCategory();
    filterService.resetFilterTrainrunFrequency();
    filterService.resetFilterTrainrunFrequency();
    expect(filterService.isAnyFilterActive()).toBe(false);
  });

  it("checkFilterNodeLabels", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    filterService.setFilterNodeLabels([3]);
    nodes.forEach((n: Node) => {
      if (n.getId() === 0) {
        expect(filterService.checkFilterNode(n)).toBe(false);
      } else {
        expect(filterService.checkFilterNode(n)).toBe(true);
      }
    });

    filterService.setFilterNodeLabels([3, 4]);
    nodes.forEach((n: Node) => {
      if ([0, 1].includes(n.getId())) {
        expect(filterService.checkFilterNode(n)).toBe(false);
      } else {
        expect(filterService.checkFilterNode(n)).toBe(true);
      }
    });
  });

  it("FilterSetting - copy test 001", () => {
    filterService.resetFiltering();
    const defaultFilterSettings = filterService.getActiveFilterSetting();
    const defaultData = defaultFilterSettings.getDto();
    const copiedFS = defaultFilterSettings.copy();
    const copiedData = copiedFS.getDto();
    copiedData.id = defaultData.id;
    expect(JSON.stringify(defaultData)).toBe(JSON.stringify(copiedData));
  });

  it("FilterSetting - copy test 002", () => {
    filterService.resetFiltering();
    const defaultFilterSettings = filterService.getActiveFilterSetting();
    const copiedFS = defaultFilterSettings.copy();
    copiedFS.id = defaultFilterSettings.id;
    expect(defaultFilterSettings.areFilteringAttributesEqual(copiedFS)).toBe(true);
    copiedFS.description = "description changed **";
    expect(defaultFilterSettings.areFilteringAttributesEqual(copiedFS)).toBe(false);
  });

  it("FilterSetting - copy test 002", () => {
    filterService.resetFiltering();
    const defaultFilterSettings = filterService.getActiveFilterSetting();
    const copiedFS = defaultFilterSettings.copy();
    copiedFS.id = copiedFS.id + 10;
    const fs = new FilterSetting(copiedFS.getDto());
    expect(new FilterSetting().id).toBe(copiedFS.id + 1);
  });

  it("FilterSetting - copy test 002", () => {
    filterService.resetFiltering();
    const defaultFilterSettings = filterService.getActiveFilterSetting();
    const copiedFS = defaultFilterSettings.copy();
    defaultFilterSettings.copyFilteringAttributes(copiedFS);
    copiedFS.id = defaultFilterSettings.id;
    expect(defaultFilterSettings.areFilteringAttributesEqual(copiedFS)).toBe(true);
  });

  it("FilterService.deleteClearFilterSetting", () => {
    filterService.resetFiltering();
    const fs: FilterSetting = filterService.saveAsNewFilterSetting();
    filterService.saveAsNewFilterSetting();
    expect(
      filterService.getFilterSettings().find((f: FilterSetting) => f.id === fs.id) !== undefined,
    ).toBe(true);
    filterService.deleteClearFilterSetting(fs);
    expect(
      filterService.getFilterSettings().find((f: FilterSetting) => f.id === fs.id) !== undefined,
    ).toBe(false);
  });

  it("filterService.isActiveFilterSettingEqual", () => {
    filterService.resetFiltering();
    const fs: FilterSetting = filterService.saveAsNewFilterSetting();
    expect(filterService.isActiveFilterSettingEqual(fs.id)).toBe(false);
    filterService.saveFilterSetting(fs);
    expect(filterService.isActiveFilterSettingEqual(fs.id)).toBe(true);
    filterService.saveAsNewFilterSetting();
    expect(filterService.isActiveFilterSettingEqual(fs.id)).toBe(false);
  });

  it("filterService.isActiveFilterSettingEqual - 001", () => {
    filterService.resetFiltering();
    const fs = filterService.saveAsNewFilterSetting();
    const fsId = filterService.getActiveFilterSettingId();
    fs.name = "Filter";
    expect(filterService.isActiveFilterSettingEqual(fsId)).toBe(true);
    filterService.enableFilterAllEmptyNodes();
    expect(filterService.isActiveFilterSettingEqual(fsId)).toBe(false);
  });

  it("filterService.setFilterSettings", () => {
    filterService.resetFiltering();
    expect(filterService.getFilterSettings().length).toBe(0);
    filterService.setFilterSettings([new FilterSetting()]);
    expect(filterService.getFilterSettings().length).toBe(1);
    filterService.setFilterSettings([new FilterSetting(), new FilterSetting()]);
    expect(filterService.getFilterSettings().length).toBe(2);
  });

  it("filterService.deleteFilterSetting - 001", () => {
    filterService.resetFiltering();
    expect(filterService.getFilterSettings().length).toBe(0);
    filterService.setFilterSettings([new FilterSetting(), new FilterSetting()]);
    expect(filterService.getFilterSettings().length).toBe(2);
    filterService.deleteFilterSetting(filterService.getFilterSettings()[1].id);
    expect(filterService.getFilterSettings().length).toBe(1);
  });

  it("filterService.deleteFilterSetting - 002", () => {
    filterService.resetFiltering();
    expect(filterService.getFilterSettings().length).toBe(0);
    filterService.deleteFilterSetting(0);
    expect(filterService.getFilterSettings().length).toBe(0);
  });

  it("filterService.deleteFilterSetting - 003", () => {
    filterService.resetFiltering();
    filterService.setFilterSettings([new FilterSetting()]);
    expect(filterService.getFilterSettings().length).toBe(1);
    filterService.deleteFilterSetting(filterService.getFilterSettings()[0].id);
    expect(filterService.getFilterSettings().length).toBe(0);
  });
});

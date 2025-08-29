import {DataService} from "../../services/data/data.service";
import {StammdatenService} from "../../services/data/stammdaten.service";
import {NetzgrafikUnitTesting} from "../../../integration-testing/netzgrafik.unit.testing";
import {NodeService} from "../../services/data/node.service";
import {ResourceService} from "../../services/data/resource.service";
import {TrainrunService} from "../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {NoteService} from "../../services/data/note.service";
import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {LogService} from "../../logger/log.service";
import {LogPublishersService} from "../../logger/log.publishers.service";
import {LabelGroupService} from "../../services/data/labelgroup.service";
import {LabelService} from "../../services/data/label.service";
import {FilterService} from "../../services/ui/filter.service";
import {NetzgrafikColoringService} from "../../services/data/netzgrafikColoring.service";
import {Sg6TrackService} from "./sg-6-track.service";
import {Sg5FilterService} from "./sg-5-filter.service";
import {Sg4ToggleTrackOccupierService} from "./sg-4-toggle-track-occupier.service";
import {Sg3TrainrunsService} from "./sg-3-trainruns.service";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {LoadPerlenketteService} from "../../perlenkette/service/load-perlenkette.service";
import {Sg2TrainrunPathService} from "./sg-2-trainrun-path.service";
import {Sg1LoadTrainrunItemService} from "./sg-1-load-trainrun-item.service";
import {SgStopService} from "./sg-stop-.service";
import {EditorMode} from "../../view/editor-menu/editor-mode";
import {SgSelectedTrainrun} from "../model/streckengrafik-model/sg-selected-trainrun";
import {SgTrainrun} from "../model/streckengrafik-model/sg-trainrun";
import {SgTrainrunItem} from "../model/streckengrafik-model/sg-trainrun-item";
import {SgPathNode} from "../model/streckengrafik-model/sg-path-node";
import {PathSection} from "../model/pathSection";
import {TrackData} from "../model/trackData";
import {PathNode} from "../model/pathNode";
import {IsTrainrunSelectedService} from "../../services/data/is-trainrun-section.service";

describe("StreckengrafikServicesTests", () => {
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
  let filterService: FilterService = null;
  let netzgrafikColoringService: NetzgrafikColoringService = null;
  let gotFilterChangedSignal = false;

  let sg5FilterService: Sg5FilterService;
  let sg6TrackService: Sg6TrackService;
  let sg4ToggleTrackOccupierService: Sg4ToggleTrackOccupierService;
  let sg3TrainrunsService: Sg3TrainrunsService;
  let uiInteractionService: UiInteractionService;
  let loadPerlenketteService: LoadPerlenketteService;
  let sg2TrainrunPathService: Sg2TrainrunPathService;
  let sg1LoadTrainrunItemService: Sg1LoadTrainrunItemService;
  let isTrainrunSelectedService: IsTrainrunSelectedService;
  let sgStopService: SgStopService;

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

    nodeService.nodes.subscribe((updatesNodes) => (nodes = updatesNodes));
    trainrunSectionService.trainrunSections.subscribe(
      (updatesTrainrunSections) => (trainrunSections = updatesTrainrunSections),
    );
    filterService.filter.subscribe(() => (gotFilterChangedSignal = true));

    loadPerlenketteService = new LoadPerlenketteService(
      trainrunService,
      trainrunSectionService,
      nodeService,
      filterService,
    );

    uiInteractionService = new UiInteractionService(
      filterService,
      nodeService,
      noteService,
      stammdatenService,
      trainrunSectionService,
      trainrunService,
      netzgrafikColoringService,
      loadPerlenketteService,
    );

    isTrainrunSelectedService = new IsTrainrunSelectedService(trainrunService);
    sg1LoadTrainrunItemService = new Sg1LoadTrainrunItemService(
      nodeService,
      trainrunService,
      trainrunSectionService,
      filterService,
      isTrainrunSelectedService,
      uiInteractionService,
    );
    sgStopService = new SgStopService();
    sg2TrainrunPathService = new Sg2TrainrunPathService(sg1LoadTrainrunItemService, sgStopService);
    sg3TrainrunsService = new Sg3TrainrunsService(
      sg2TrainrunPathService,
      sg1LoadTrainrunItemService,
    );
    sg4ToggleTrackOccupierService = new Sg4ToggleTrackOccupierService(
      sg3TrainrunsService,
      uiInteractionService,
    );

    sg5FilterService = new Sg5FilterService(sg4ToggleTrackOccupierService);
    sg6TrackService = new Sg6TrackService(
      sg5FilterService,
      dataService,
      nodeService,
      trainrunSectionService,
      trainrunService,
    );
  });

  it("Load test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);
    expect(trainrunSections.length).toBe(8);

    nodes.forEach((n: Node) => expect(filterService.checkFilterNode(n)).toBe(true));
    trainrunSections.forEach((ts: TrainrunSection) =>
      expect(filterService.filterTrainrun(ts.getTrainrun())).toBe(true),
    );
  });

  it("Sg6TrackService Test (Trainrun ID: 1)", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    uiInteractionService.setEditorMode(EditorMode.StreckengrafikEditing);
    trainrunService.setTrainrunAsSelected(1);
    sg1LoadTrainrunItemService.setDataOnlyForTestPurpose();
    sg6TrackService.getSgSelectedTrainrun().subscribe((sgSelectedTrainrun: SgSelectedTrainrun) => {
      expect(sgSelectedTrainrun.trainrunId).toBe(1);
      expect(sgSelectedTrainrun.frequency).toBe(30);
      expect(sgSelectedTrainrun.frequencyOffset).toBe(0);
      expect(sgSelectedTrainrun.startTime).toBe(15);
      expect(sgSelectedTrainrun.endTime).toBe(35);
      expect(sgSelectedTrainrun.title).toBe("1");
      expect(sgSelectedTrainrun.categoryShortName).toBe("S");
      expect(sgSelectedTrainrun.colorRef).toBe("S");
      expect(sgSelectedTrainrun.paths.length).toBe(3);
      expect(sgSelectedTrainrun.trainruns.length).toBe(5);
      expect(sgSelectedTrainrun.counter).toBe(1);
    });
  });

  it("Sg6TrackService Node Track alignment test (Trainrun ID: 2)", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    uiInteractionService.setEditorMode(EditorMode.StreckengrafikEditing);
    trainrunService.setTrainrunAsSelected(2);
    sg1LoadTrainrunItemService.setDataOnlyForTestPurpose();
    sg6TrackService.getSgSelectedTrainrun().subscribe((sgSelectedTrainrun: SgSelectedTrainrun) => {
      expect(sgSelectedTrainrun.trainrunId).toBe(2);
      expect(sgSelectedTrainrun.frequency).toBe(20);
      expect(sgSelectedTrainrun.frequencyOffset).toBe(0);
      expect(sgSelectedTrainrun.startTime).toBe(0);
      expect(sgSelectedTrainrun.endTime).toBe(101);
      expect(sgSelectedTrainrun.title).toBe("1234");
      expect(sgSelectedTrainrun.categoryShortName).toBe("S");
      expect(sgSelectedTrainrun.colorRef).toBe("S");
      expect(sgSelectedTrainrun.paths.length).toBe(7);
      expect(sgSelectedTrainrun.trainruns.length).toBe(5);
      expect(sgSelectedTrainrun.counter).toBe(1);
    });
  });

  it("Sg6TrackService General Track alignment test (Trainrun ID: 2)", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    uiInteractionService.setEditorMode(EditorMode.StreckengrafikEditing);
    trainrunService.setTrainrunAsSelected(2);
    sg1LoadTrainrunItemService.setDataOnlyForTestPurpose();
    sg6TrackService.getSgSelectedTrainrun().subscribe((sgSelectedTrainrun: SgSelectedTrainrun) => {
      expect(sgSelectedTrainrun.trainrunId).toBe(2);
      const pathBP: string[] = ["BN", "", "OL", "", "ZUE", "", "SG"];
      const pathTrack: number[] = [4, undefined, 4, undefined, 6, undefined, 1];
      // The pathArrDepTimes holds the departure/arrival times for each item (node, section). The
      // first entry is the "start node" - which hold the trainrun turnarround time then the first second
      // follows with departure and arrival times, .... node, section .... and the last entry is the destination
      // node where the trainrun end and the train uses the "track" until turnaround departure time is reached
      //
      const pathArrDepTimes: number[][] = [
        [0 - sgSelectedTrainrun.frequency, 0],
        [0, 39],
        [39, 39],
        [39, 49],
        [49, 50],
        [50, 101],
        [
          101,
          sgSelectedTrainrun.frequency -
            (101 % sgSelectedTrainrun.frequency) +
            Math.floor(101 / sgSelectedTrainrun.frequency) * sgSelectedTrainrun.frequency,
        ],
      ];
      for (let idx: number = 0; idx < sgSelectedTrainrun.paths.length; idx++) {
        expect(sgSelectedTrainrun.paths[idx].index).toBe(idx);
        expect(sgSelectedTrainrun.paths[idx].isNode()).toBe(idx % 2 === 0);
        expect(sgSelectedTrainrun.paths[idx].isSection()).toBe(idx % 2 === 1);
        if (idx % 2 === 0) {
          const node = sgSelectedTrainrun.paths[idx].getPathNode();
          expect(node.nodeShortName).toBe(pathBP[idx]);
          expect(node.getPathSection()).toBe(undefined);
          expect(node.xPath()).toBe(0);
          expect(node.xPathFix()).toBe(true);
          expect(node.zoomedXPath()).toBe(0);
          expect(node.nodeWidth()).toBe(node.width + node.width * node.trackData.track);
          expect(node.trackData.track).toBe(pathTrack[idx]);

          const depTime = node.departureTime;
          const arrTime = node.arrivalTime;
          expect(depTime).toBe(pathArrDepTimes[idx][0]);
          expect(arrTime).toBe(pathArrDepTimes[idx][1]);
        } else {
          const section = sgSelectedTrainrun.paths[idx].getPathSection();
          expect(section.getPathNode()).toBe(undefined);
          const depBPName = section.departureNodeShortName;
          const arrBPName = section.arrivalNodeShortName;
          expect(depBPName).toBe(pathBP[idx - 1]);
          expect(arrBPName).toBe(pathBP[idx + 1]);
          const depTime = section.departureTime;
          const arrTime = section.arrivalTime;
          expect(depTime).toBe(pathArrDepTimes[idx][1]);
          expect(arrTime).toBe(pathArrDepTimes[idx][0]);
        }
      }
      expect(sgSelectedTrainrun.paths.length).toBe(7);
    });
  });

  it("Sg6TrackService Node Track alignment test (Trainrun ID: 2) - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    uiInteractionService.setEditorMode(EditorMode.StreckengrafikEditing);
    trainrunService.setTrainrunAsSelected(2);
    sg1LoadTrainrunItemService.setDataOnlyForTestPurpose();
    sg6TrackService.getSgSelectedTrainrun().subscribe((sgSelectedTrainrun: SgSelectedTrainrun) => {
      expect(sgSelectedTrainrun.trainrunId).toBe(2);

      const nodeIdx = 4;
      expect(sgSelectedTrainrun.paths[nodeIdx].index).toBe(nodeIdx);
      expect(sgSelectedTrainrun.paths[nodeIdx].isNode()).toBe(nodeIdx % 2 === 0);
      expect(sgSelectedTrainrun.paths[nodeIdx].isSection()).toBe(nodeIdx % 2 === 1);
      const node = sgSelectedTrainrun.paths[nodeIdx].getPathNode();
      for (let idx = 0; idx < node.trainrunNodes.length; idx++) {
        expect(node.trainrunNodes[idx].index).toBe(nodeIdx);
        expect(node.trainrunNodes[idx].nodeId).toBe(node.nodeId);
        expect(node.trainrunNodes[idx].nodeShortName).toBe(node.nodeShortName);
      }
      expect(node.trainrunNodes[0].backward).toBe(false);
      expect(node.trainrunNodes[0].minimumHeadwayTime).toBe(2);
      expect(node.trainrunNodes[0].isTurnaround).toBe(true);
      expect(node.trainrunNodes[0].isEndNode()).toBe(true);
      expect(node.trainrunNodes[0].arrivalTime).toBe(22);
      expect(node.trainrunNodes[0].departureTime).toBe(38);
      expect(node.trainrunNodes[0].unusedForTurnaround).toBe(true);

      expect(node.trainrunNodes[1].backward).toBe(true);
      expect(node.trainrunNodes[1].minimumHeadwayTime).toBe(2);
      expect(node.trainrunNodes[1].isTurnaround).toBe(true);
      expect(node.trainrunNodes[1].isEndNode()).toBe(true);
      expect(node.trainrunNodes[1].arrivalTime).toBe(22);
      expect(node.trainrunNodes[1].departureTime).toBe(38);
      expect(node.trainrunNodes[1].unusedForTurnaround).toBe(false);
    });
  });

  it("Sg6TrackService Node Track alignment test (Trainrun ID: 2) - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    uiInteractionService.setEditorMode(EditorMode.StreckengrafikEditing);
    trainrunService.setTrainrunAsSelected(2);
    sg1LoadTrainrunItemService.setDataOnlyForTestPurpose();
    sg6TrackService.getSgSelectedTrainrun().subscribe((sgSelectedTrainrun: SgSelectedTrainrun) => {
      expect(sgSelectedTrainrun.trainrunId).toBe(2);

      const nodeIdx = 4;
      expect(sgSelectedTrainrun.paths[nodeIdx].index).toBe(nodeIdx);
      expect(sgSelectedTrainrun.paths[nodeIdx].isNode()).toBe(nodeIdx % 2 === 0);
      expect(sgSelectedTrainrun.paths[nodeIdx].isSection()).toBe(nodeIdx % 2 === 1);
      const node = sgSelectedTrainrun.paths[nodeIdx].getPathNode();
      for (let idx = 0; idx < node.trainrunNodes.length; idx++) {
        expect(node.trainrunNodes[idx].index).toBe(nodeIdx);
        expect(node.trainrunNodes[idx].nodeId).toBe(node.nodeId);
        expect(node.trainrunNodes[idx].nodeShortName).toBe(node.nodeShortName);
      }
      expect(node.trainrunNodes[8].backward).toBe(false);
      expect(node.trainrunNodes[8].minimumHeadwayTime).toBe(2);
      expect(node.trainrunNodes[8].isTurnaround).toBe(true);
      expect(node.trainrunNodes[8].isEndNode()).toBe(true);
      expect(node.trainrunNodes[8].arrivalTime).toBe(10);
      expect(node.trainrunNodes[8].departureTime).toBe(50);
      expect(node.trainrunNodes[8].unusedForTurnaround).toBe(true);

      expect(node.trainrunNodes[9].backward).toBe(true);
      expect(node.trainrunNodes[9].minimumHeadwayTime).toBe(2);
      expect(node.trainrunNodes[9].isTurnaround).toBe(true);
      expect(node.trainrunNodes[9].isEndNode()).toBe(true);
      expect(node.trainrunNodes[9].arrivalTime).toBe(130);
      expect(node.trainrunNodes[9].departureTime).toBe(170);
      expect(node.trainrunNodes[9].unusedForTurnaround).toBe(false);
    });
  });

  it("Sg6TrackService Node Track alignment test (Trainrun ID: 2) - 003", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    uiInteractionService.setEditorMode(EditorMode.StreckengrafikEditing);
    trainrunService.setTrainrunAsSelected(2);
    trainrunService.getTrainrunFromId(4).setTrainrunCategory(dataService.getTrainrunCategory(5));
    sg1LoadTrainrunItemService.setDataOnlyForTestPurpose();
    sg6TrackService.getSgSelectedTrainrun().subscribe((sgSelectedTrainrun: SgSelectedTrainrun) => {
      expect(sgSelectedTrainrun.trainrunId).toBe(2);

      const nodeIdx = 4;
      expect(sgSelectedTrainrun.paths[nodeIdx].index).toBe(nodeIdx);
      expect(sgSelectedTrainrun.paths[nodeIdx].isNode()).toBe(nodeIdx % 2 === 0);
      expect(sgSelectedTrainrun.paths[nodeIdx].isSection()).toBe(nodeIdx % 2 === 1);
      const node = sgSelectedTrainrun.paths[nodeIdx].getPathNode();
      for (let idx = 0; idx < 6; idx++) {
        expect(node.trainrunNodes[idx].minimumHeadwayTime).toBe(2);
      }
      expect(node.trainrunNodes[7].minimumHeadwayTime).toBe(2);
      expect(node.trainrunNodes[8].minimumHeadwayTime).toBe(3);
      expect(node.trainrunNodes[9].minimumHeadwayTime).toBe(3);
    });
  });

  it("streckengrafik - trainrunItem.ts (track segment check)", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    uiInteractionService.setEditorMode(EditorMode.StreckengrafikEditing);
    trainrunService.setTrainrunAsSelected(2);
    trainrunService.getTrainrunFromId(4).setTrainrunCategory(dataService.getTrainrunCategory(5));
    sg1LoadTrainrunItemService.setDataOnlyForTestPurpose();
    sg4ToggleTrackOccupierService.expandAllPathNode();

    sg6TrackService.getSgSelectedTrainrun().subscribe((sgSelectedTrainrun: SgSelectedTrainrun) => {
      const ts: SgTrainrun = sgSelectedTrainrun.trainruns[0];
      const item0: SgTrainrunItem = ts.sgTrainrunItems[0];

      expect(item0.isNode()).toBe(true);
      expect(item0.isSection()).toBe(false);
      expect(item0.checkUnrollAllowed(120)).toBe(false);
      const node: SgPathNode = item0.getPathNode();

      const item1: SgTrainrunItem = ts.sgTrainrunItems[1];
      expect(item1.isNode()).toBe(false);
      expect(item1.isSection()).toBe(true);
      const section = item1.getTrainrunSection();

      const pathSection = item1.getPathSection();
      expect(pathSection.departureNodeShortName).toBe("BN");
      expect(pathSection.arrivalNodeShortName).toBe("OL");

      expect(section.getStartposition()).toBe(0);
      section.trackData.setTrackGrp(section.trackData.getTrackGrp());
      expect(section.trackData.getTrackGrp()).toBe(undefined);
      expect(section.trackData.track).toBe(4);
      expect(section.trainrunSectionId).toBe(0);
      expect(section.trackData.getNodeTracks()).toEqual([]);
      section.trackData.setNodeTracks([]);
      expect(section.trackData.getNodeTracks()).toEqual([]);
      expect(section.getTrainrunNode()).toBe(undefined);
      expect(section.getPathNode()).toBe(undefined);

      const trackSegments = section.trackData.sectionTrackSegments;
      expect(trackSegments.length).toBe(12);
      const trackSegDataTracks: number[] = [4, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
      const trackSegDataMinTracks: number[] = [4, 3, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1];
      for (let idx = 0; idx < trackSegments.length; idx++) {
        expect(trackSegments[idx].nbrTracks).toBe(trackSegDataTracks[idx]);
        expect(trackSegments[idx].minNbrTracks).toBe(trackSegDataMinTracks[idx]);
      }
      expect(trackSegments[0].startPos).toBe(0);
      expect(trackSegments[1].startPos).toBe(trackSegments[0].endPos);
      expect(trackSegments[11].endPos).toBe(1);

      expect(node.trackOccupier).toBe(true);
    });
  });

  it("streckengrafik - sg-stop-service.ts", () => {
    expect(sgStopService.isGO(0)).toBe(true);
    expect(sgStopService.isGO(undefined)).toBe(false);
    expect(sgStopService.isGO(-1)).toBe(false);
  });

  it("streckengrafik - sg-4-toggle-track-occupier.service.ts", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    uiInteractionService.setEditorMode(EditorMode.StreckengrafikEditing);
    trainrunService.setTrainrunAsSelected(2);
    trainrunService.getTrainrunFromId(4).setTrainrunCategory(dataService.getTrainrunCategory(5));
    sg1LoadTrainrunItemService.setDataOnlyForTestPurpose();
    sg4ToggleTrackOccupierService.expandAllPathNode();

    expect(sg4ToggleTrackOccupierService.allPathNodeClosed()).toBe(false);

    sg4ToggleTrackOccupierService.collapseAllPathNode();
    expect(sg4ToggleTrackOccupierService.allPathNodeClosed()).toBe(true);
  });

  it("streckengrafik - PathSection", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    uiInteractionService.setEditorMode(EditorMode.StreckengrafikEditing);
    const trainrunSection = trainrunSectionService.getTrainrunSectionFromId(1);
    const fromNode = trainrunSection.getSourceNode();
    const toNode = trainrunSection.getTargetNode();
    const pathSection = new PathSection(
      trainrunSection.getId(),
      fromNode.getDepartureConsecutiveTime(trainrunSection),
      toNode.getArrivalConsecutiveTime(trainrunSection),
      trainrunSection.getNumberOfStops(),
      new TrackData(1),
      false,
    );

    expect(pathSection.xPathFix()).toBe(false);
    expect(pathSection.travelTime()).toBe(1 / 60);
    expect(pathSection.equal(pathSection)).toBe(true);
    expect(pathSection.getPathNode()).toBe(undefined);
    const clonedPS = pathSection.clone();
    expect(pathSection.equal(clonedPS.getPathSection())).toBe(true);
    expect(clonedPS.getPathSection().getPathNode()).toBe(undefined);
    expect(JSON.stringify(clonedPS)).toBe(JSON.stringify(pathSection));
    expect(clonedPS.isSection()).toBe(true);
    expect(clonedPS.isFilter()).toBe(false);
    expect(clonedPS.isNode()).toBe(false);
    expect(clonedPS.travelTime()).toBe(1 / 60);
    expect(pathSection.equal(clonedPS.getPathSection())).toBe(true);
    clonedPS.getPathSection().isFilteredDepartureNode = true;
    expect(pathSection.equal(clonedPS.getPathSection())).toBe(false);
    expect(clonedPS.xPathFix()).toBe(true);
    expect(clonedPS.isFilter()).toBe(false);
    const clonedPS1 = pathSection.clone().getPathSection();
    clonedPS1.getPathSection().isFilteredArrivalNode = true;
    expect(clonedPS1.xPathFix()).toBe(true);
    expect(clonedPS1.isFilter()).toBe(false);
    clonedPS1.getPathSection().isFilteredDepartureNode = true;
    expect(clonedPS1.xPathFix()).toBe(true);
    expect(clonedPS1.isFilter()).toBe(true);
    clonedPS1.departureTime = 120;
    clonedPS1.arrivalTime = 45;
    expect(clonedPS1.travelTime()).toBe(75);
    expect(pathSection.shortKey()).toBe(undefined);
    clonedPS1.departurePathNode = new PathNode(
      pathSection.departureTime,
      pathSection.arrivalTime,
      fromNode.getId(),
      fromNode.getBetriebspunktName(),
      1,
      new TrackData(1),
      false,
    );
    clonedPS1.arrivalPathNode = new PathNode(
      pathSection.departureTime,
      pathSection.arrivalTime,
      toNode.getId(),
      toNode.getBetriebspunktName(),
      1,
      new TrackData(1),
      false,
    );

    clonedPS1.backward = true;
    expect(clonedPS1.getPathSection().shortKey()).toBe("2:1");
    expect(clonedPS1.getPathSection().key()).toBe("2;1:1;1");

    clonedPS1.backward = false;
    expect(clonedPS1.getPathSection().shortKey()).toBe("1:2");
    expect(clonedPS1.getPathSection().key()).toBe("1;1:2;1");

    expect(clonedPS.getPathSection().xPath()).toBe(70);
    expect(clonedPS1.getPathSection().xPath()).toBe(70);
    expect(clonedPS1.getPathSection().zommedXPath(2.1)).toBe(70);
    expect(clonedPS.getPathSection().zommedXPath(1.2)).toBe(70);
    expect(clonedPS1.getPathSection().zommedXPath(undefined)).toBe(70);

    clonedPS.getPathSection().isFilteredDepartureNode = false;
    clonedPS.getPathSection().isFilteredArrivalNode = false;
    clonedPS1.getPathSection().isFilteredArrivalNode = false;
    clonedPS1.getPathSection().isFilteredDepartureNode = false;
    expect(clonedPS.getPathSection().xPath()).toBe(1 / 60);
    expect(clonedPS1.getPathSection().xPath()).toBe(75);
    expect(clonedPS1.getPathSection().zommedXPath(2.1)).toBe(157.5);
    expect(clonedPS.getPathSection().zommedXPath(1.2)).toBe(0.02);
    expect(clonedPS1.getPathSection().zommedXPath(undefined)).toEqual(NaN);
  });
});

import netzgrafikDefaultJson from "./netzgrafik_default.json";
import {NetzgrafikDefault} from "./netzgrafik.default";
import {NetzgrafikTestData} from "./test-data/netzgrafik";
import {DataService} from "../services/data/data.service";
import {LogPublishersService} from "../logger/log.publishers.service";
import {LogService} from "../logger/log.service";
import {LabelService} from "../services/data/label.service";
import {LabelGroupService} from "../services/data/labelgroup.service";
import {NetzgrafikColoringService} from "../services/data/netzgrafikColoring.service";
import {NodeService} from "../services/data/node.service";
import {NoteService} from "../services/data/note.service";
import {ResourceService} from "../services/data/resource.service";
import {StammdatenService} from "../services/data/stammdaten.service";
import {TrainrunService} from "../services/data/trainrun.service";
import {TrainrunSectionService} from "../services/data/trainrunsection.service";
import {FilterService} from "../services/ui/filter.service";

describe("NetzgrafikDefault", () => {
  let dataService: DataService;
  let nodeService: NodeService;
  let resourceService: ResourceService;
  let trainrunService: TrainrunService;
  let trainrunSectionService: TrainrunSectionService;
  let stammdatenService: StammdatenService;
  let noteService: NoteService;
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

  describe("normal case", () => {
    // needs to be updated to new format (no longer numberOfStops but the complete graph nodes + links)
    it("should load and serialize default netzgrafikDto (no trainruns) without changes", () => {
      const inputDto = NetzgrafikDefault.getDefaultNetzgrafik();

      dataService.loadNetzgrafikDto(inputDto);

      const outputJson = dataService.getNetzgrafikDto();
      expect(JSON.stringify(inputDto, null, 2)).toEqual(JSON.stringify(outputJson, null, 2));
    });

    it("should load and serialize demo netzgrafikDto (complete variant) without changes", () => {
      const inputDto = NetzgrafikDefault.getNetzgrafikDemoStandaloneGithub();

      dataService.loadNetzgrafikDto(inputDto);

      const outputJson = dataService.getNetzgrafikDto();
      expect(JSON.stringify(inputDto, null, 2)).toEqual(JSON.stringify(outputJson, null, 2));
    });
  });

  describe("handling old files with numberOfStops", () => {
    describe("2 nodes", () => {
      // A -> B has 1 stop
      it("should replace the numberOfStops: 1 with an equivalent graph portion", () => {
        const inputDto = NetzgrafikTestData.getLegacyNtezgrafik2Nodes();

        dataService.loadNetzgrafikDto(inputDto);

        const outputJson = dataService.getNetzgrafikDto();

        // we expect to have a new node between A and B
        // the existing trainrunSection A -> B to now be A -> NEW
        // and a new trainrunSection NEW -> B
        const newNode = outputJson.nodes[2];
        expect(newNode.betriebspunktName).toBe("NEW");
        expect(outputJson.trainrunSections[0].sourceNodeId).toBe(11);
        expect(outputJson.trainrunSections[0].targetNodeId).toBe(newNode.id);
        expect(outputJson.trainrunSections[1].sourceNodeId).toBe(newNode.id);
        expect(outputJson.trainrunSections[1].targetNodeId).toBe(12);
      });
      it("should replace the numberOfStops: 3 with an equivalent graph portion", () => {
        const inputDto = NetzgrafikTestData.getLegacyNtezgrafik2Nodes();
        inputDto.trainrunSections[0].numberOfStops = 3;

        dataService.loadNetzgrafikDto(inputDto);

        // the current implementation using replaceIntermediateStopWithNode
        // forces to always split the leftmost section
        // the original section A -> B (id 0) becomes A -> C
        // it is split again in A -> D
        // this is why the last created section is right after section 0
        // and the first one ends up last
        // and again A -> E
        // step by step:
        // ==========================================
        //     A  ---- B
        // ID: 11 ---- 12
        //         0
        // ==========================================
        //     A  ---- C  ---- B
        // ID: 11 ---- 13 ---- 12
        //         0       1
        // ==========================================
        //     A  ---- D  ---- C  ---- B
        // ID: 11 ---- 14 ---- 13 ---- 12
        //         0       2       1
        // ==========================================
        //     A  ---- E  ---- D  ---- C  ---- B
        // ID: 11 ---- 15 ---- 14 ---- 13 ---- 12
        //         0       3       2       1
        const outputJson = dataService.getNetzgrafikDto();
        const newNode1 = outputJson.nodes[2];
        expect(newNode1.betriebspunktName).toBe("NEW");
        const newNode2 = outputJson.nodes[3];
        expect(newNode2.betriebspunktName).toBe("NEW");
        const newNode3 = outputJson.nodes[4];
        expect(newNode3.betriebspunktName).toBe("NEW");
        expect(outputJson.trainrunSections[0].sourceNodeId).toBe(11);
        expect(outputJson.trainrunSections[0].targetNodeId).toBe(newNode3.id);
        expect(outputJson.trainrunSections[3].sourceNodeId).toBe(newNode3.id);
        expect(outputJson.trainrunSections[3].targetNodeId).toBe(newNode2.id);
        expect(outputJson.trainrunSections[2].sourceNodeId).toBe(newNode2.id);
        expect(outputJson.trainrunSections[2].targetNodeId).toBe(newNode1.id);
        expect(outputJson.trainrunSections[1].sourceNodeId).toBe(newNode1.id);
        expect(outputJson.trainrunSections[1].targetNodeId).toBe(12);
      });
    });
    describe("3 nodes", () => {
      // A -> B -> C
      // each trainrunSection with 1 stop
      it("should replace the numberOfStops: 1 with an equivalent graph portion for each section", () => {
        const inputDto = NetzgrafikTestData.getLegacyNtezgrafik3Nodes();

        dataService.loadNetzgrafikDto(inputDto);

        const outputJson = dataService.getNetzgrafikDto();

        const newNode1 = outputJson.nodes[3];
        expect(newNode1.betriebspunktName).toBe("NEW");
        const newNode2 = outputJson.nodes[4];
        expect(newNode2.betriebspunktName).toBe("NEW");
        expect(outputJson.trainrunSections[0].sourceNodeId).toBe(11);
        expect(outputJson.trainrunSections[0].targetNodeId).toBe(newNode1.id);
        expect(outputJson.trainrunSections[2].sourceNodeId).toBe(newNode1.id);
        expect(outputJson.trainrunSections[2].targetNodeId).toBe(12);
        expect(outputJson.trainrunSections[1].sourceNodeId).toBe(12);
        expect(outputJson.trainrunSections[1].targetNodeId).toBe(newNode2.id);
        expect(outputJson.trainrunSections[3].sourceNodeId).toBe(newNode2.id);
        expect(outputJson.trainrunSections[3].targetNodeId).toBe(13);
      });
    });
  });
});

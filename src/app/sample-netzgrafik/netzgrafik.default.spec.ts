import netzgrafikDefaultJson from "./netzgrafik_default.json";
import {NetzgrafikDefault} from "./netzgrafik.default";
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

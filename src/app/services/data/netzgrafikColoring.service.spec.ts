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
import {LabelService} from "./label.service";
import {FilterService} from "../ui/filter.service";
import {NetzgrafikColoringService} from "../data/netzgrafikColoring.service";
import {UndoService} from "../data/undo.service";
import {CopyService} from "./copy.service";
import {UiInteractionService} from "../ui/ui.interaction.service";
import {LoadPerlenketteService} from "../../perlenkette/service/load-perlenkette.service";
import {NetzgrafikUnitTesting} from "../../../integration-testing/netzgrafik.unit.testing";

describe("NetzgraphikColoringService", () => {
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
  let copyService: CopyService = null;
  let uiInteractionService: UiInteractionService = null;
  let loadPerlenketteService: LoadPerlenketteService = null;
  let undoService: UndoService = null;

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
    trainrunSectionService.trainrunSections.subscribe(
      (updatesTrainrunSections) => (trainrunSections = updatesTrainrunSections),
    );

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

    undoService = new UndoService(
      dataService,
      nodeService,
      noteService,
      trainrunService,
      filterService,
    );

    copyService = new CopyService(
      dataService,
      trainrunService,
      trainrunSectionService,
      nodeService,
      noteService,
      filterService,
      uiInteractionService,
      undoService,
    );
    copyService.resetLocalStorage();
  });

  it("test NetzgrafikColor.createDefaultColorForNotExistingColors", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const loadedNetzgrafik = dataService.getNetzgrafikDto();
    netzgrafikColoringService.generateColors();
    const styles = netzgrafikColoringService.generateGlobalStyles(
      dataService.getTrainrunCategories(),
      trainrunSectionService.getTrainrunSections(),
    );
    const v1 = netzgrafikColoringService.getNetzgrafikColor("S");
    expect(v1).toBe(undefined);

    netzgrafikColoringService.createDefaultColorForNotExistingColors("Adrian");
    const v2 = netzgrafikColoringService.getNetzgrafikColor("Adrian");
    expect(v2.getColorRef()).toBe("Adrian");
    expect(v2.getColors(false).color).toBe("#767676");
    expect(v2.getColors(true).color).toBe("#767676");
    expect(v2.getColors(false).colorFocus).toBe("#000000");
    expect(v2.getColors(true).colorFocus).toBe("#DCDCDC");
    expect(v2.getColors(false).colorMuted).toBe("#DCDCDC");
    expect(v2.getColors(true).colorMuted).toBe("#000000");
    expect(v2.getColors(false).colorRelated).toBe("#767676");
    expect(v2.getColors(true).colorRelated).toBe("#767676");
  });

  it("test NetzgrafikColor.generateColors", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const loadedNetzgrafik = dataService.getNetzgrafikDto();

    netzgrafikColoringService.createDefaultColorForNotExistingColors("Adrian");
    netzgrafikColoringService.generateColors();
    const v2 = netzgrafikColoringService.getNetzgrafikColor("Adrian");
    expect(v2.getColorRef()).toBe("Adrian");
  });

  it("test NetzgrafikColor.changeColorRef", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const loadedNetzgrafik = dataService.getNetzgrafikDto();

    netzgrafikColoringService.createDefaultColorForNotExistingColors("Adrian");
    const v1 = netzgrafikColoringService.getNetzgrafikColor("Adrian");
    expect(v1.getColorRef()).toBe("Adrian");
    netzgrafikColoringService.changeColorRef(v1.getId(), "Egli");
    expect(v1.getColorRef()).toBe("Egli");

    const v2 = netzgrafikColoringService.getNetzgrafikColor("XYZ");
    expect(v2).toBe(undefined);
    netzgrafikColoringService.changeColorRef(-1, "XYZ");
    const v3 = netzgrafikColoringService.getNetzgrafikColor("XYZ");
    expect(v3).toBe(undefined);
  });
});

import {DataService} from "../../../services/data/data.service";
import {NodeService} from "../../../services/data/node.service";
import {ResourceService} from "../../../services/data/resource.service";
import {TrainrunService} from "../../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../../services/data/trainrunsection.service";
import {StammdatenService} from "../../../services/data/stammdaten.service";
import {NoteService} from "../../../services/data/note.service";
import {Node} from "../../../models/node.model";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {LabelGroupService} from "../../../services/data/labelgroup.service";
import {LabelService} from "../../../services/data/label.service";
import {NetzgrafikColoringService} from "../../../services/data/netzgrafikColoring.service";
import {UndoService} from "../../../services/data/undo.service";
import {CopyService} from "../../../services/data/copy.service";
import {LogService} from "../../../logger/log.service";
import {LogPublishersService} from "../../../logger/log.publishers.service";
import {FilterService} from "../../../services/ui/filter.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {LoadPerlenketteService} from "../../../perlenkette/service/load-perlenkette.service";
import {EditorView} from "./editor.view";
import {EditorMainViewComponent} from "../editor-main-view.component";
import {NetzgrafikUnitTesting} from "../../../../integration-testing/netzgrafik.unit.testing";
import {TransitionsView} from "./transitions.view";
import {LevelOfDetailService} from "../../../services/ui/level.of.detail.service";
import {ViewportCullService} from "../../../services/ui/viewport.cull.service";
import {PositionTransformationService} from "../../../services/util/position.transformation.service";

describe("Transitions-View", () => {
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
  let editorView: EditorView = null;

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

    const levelOfDetailService = new LevelOfDetailService(uiInteractionService);

    const viewportCullService = new ViewportCullService(
      uiInteractionService,
      nodeService,
      noteService,
      trainrunSectionService,
    );

    const positionTransformationService = new PositionTransformationService(
      trainrunSectionService,
      nodeService,
      noteService,
      uiInteractionService,
      viewportCullService,
    );

    const controller = new EditorMainViewComponent(
      nodeService,
      trainrunSectionService,
      trainrunService,
      filterService,
      uiInteractionService,
      noteService,
      undefined,
      undoService,
      copyService,
      logService,
      viewportCullService,
      levelOfDetailService,
      undefined,
      positionTransformationService,
    );

    new EditorView(
      controller,
      nodeService,
      trainrunService,
      trainrunSectionService,
      noteService,
      filterService,
      uiInteractionService,
      undoService,
      copyService,
      logService,
      viewportCullService,
      levelOfDetailService,
      undefined,
      positionTransformationService,
    );

    controller.bindViewToServices();
    editorView = controller.editorView;
  });

  it("transitionsView constructor test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const transitionsView = new TransitionsView(editorView);
  });

  it("TransitionsView.isMuted - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const t = trainrunService.getTrainrunFromId(2);
    const s = trainrunService.getTrainrunFromId(1);
    const v1 = TransitionsView.isMuted(t, null, undefined);
    expect(v1).toBe(false);
  });

  it("TransitionsView.isMuted - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const t = trainrunService.getTrainrunFromId(2);
    const s = trainrunService.getTrainrunFromId(1);
    const v1 = TransitionsView.isMuted(t, s, []);
    expect(v1).toBe(true);
  });

  it("TransitionsView.isMuted - 003", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const t = trainrunService.getTrainrunFromId(2);
    const s = trainrunService.getTrainrunFromId(1);
    const v1 = TransitionsView.isMuted(t, s, [1, 3]);
    expect(v1).toBe(true);
  });

  it("TransitionsView.isMuted - 004", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const t = trainrunService.getTrainrunFromId(2);
    const s = trainrunService.getTrainrunFromId(1);
    const v1 = TransitionsView.isMuted(t, s, [1, 2, 3]);
    expect(v1).toBe(false);
  });

  it("TransitionsView.createTrainrunClassAttribute - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const t = trainrunService.getTrainrunFromId(2);
    const s = trainrunService.getTrainrunFromId(1);
    const v1 = TransitionsView.createTrainrunClassAttribute(t, null, undefined);
    expect(v1).toBe("transition_line Freq_20 ColorRef_S LinePatternRef_7/24");
  });

  it("TransitionsView.createTrainrunClassAttribute - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const t = trainrunService.getTrainrunFromId(2);
    const s = trainrunService.getTrainrunFromId(1);
    const v1 = TransitionsView.createTrainrunClassAttribute(t, s, []);
    expect(v1).toBe("transition_line Freq_20 ColorRef_S LinePatternRef_7/24 muted");
  });

  it("TransitionsView.createTrainrunClassAttribute - 003", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const t = trainrunService.getTrainrunFromId(2);
    const s = trainrunService.getTrainrunFromId(1);
    const v1 = TransitionsView.createTrainrunClassAttribute(t, s, [1, 3]);
    expect(v1).toBe("transition_line Freq_20 ColorRef_S LinePatternRef_7/24 muted");
  });

  it("TransitionsView.createTrainrunClassAttribute - 004", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const t = trainrunService.getTrainrunFromId(2);
    const s = trainrunService.getTrainrunFromId(1);
    const v1 = TransitionsView.createTrainrunClassAttribute(t, s, [1, 2, 3]);
    expect(v1).toBe("transition_line Freq_20 ColorRef_S LinePatternRef_7/24");
  });
});

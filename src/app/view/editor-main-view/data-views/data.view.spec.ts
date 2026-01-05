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
import {NetzgrafikUnitTesting} from "../../../../integration-testing/netzgrafik.unit.testing";
import {ConnectionsViewObject} from "./connectionViewObject";
import {EditorView} from "./editor.view";
import {EditorMainViewComponent} from "../editor-main-view.component";
import {NodeViewObject} from "./nodeViewObject";
import {NoteViewObject} from "./noteViewObject";
import {TrainrunSectionViewObject} from "./trainrunSectionViewObject";
import {TransitionViewObject} from "./transitionViewObject";
import {StaticDomTags} from "./static.dom.tags";
import {LevelOfDetailService} from "../../../services/ui/level.of.detail.service";
import {ViewportCullService} from "../../../services/ui/viewport.cull.service";
import {PositionTransformationService} from "../../../services/util/position.transformation.service";

describe("Editor-DataView", () => {
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

    const viewportCullService = new ViewportCullService(
      uiInteractionService,
      nodeService,
      noteService,
      trainrunSectionService,
    );

    const levelOfDetailService = new LevelOfDetailService(uiInteractionService);

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

  it("ConnectionsViewObject  - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const node = nodeService.getNodeFromId(2);
    const con = node.getConnectionFromId(2);

    const cvo = new ConnectionsViewObject(editorView, con, node, false, false);
    expect(cvo.key).toBe(
      "#2@false_15_9_false_(832,144)_(774.4,144)_(793.6,144)_(736,144)_false_false_false_0_false(832,144)(774.4,144)(793.6,144)(736,144)",
    );
  });

  it("NodeViewObject   - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const node = nodeService.getNodeFromId(2);

    const cvo1 = new NodeViewObject(editorView, node, false);
    expect(cvo1.key).toBe("#2@736_64_ZUE_6_5_96_124_false_2_false_true_false_0_false");

    const cvo2 = new NodeViewObject(editorView, node, true);
    expect(cvo2.key).toBe("#2@736_64_ZUE_6_5_96_124_false_2_true_true_false_0_false");
  });

  it("NodeViewObject   - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const note = noteService.getNoteFromId(3);
    const cvo1 = new NoteViewObject(editorView, note);
    expect(cvo1.key).toBe(
      "#3@1312_160_64_192_<p><em>Folgendes</em></p>spannend<p><strong>FETT</strong>_Frabcodierter Text_false_0_false_false_0_false",
    );
  });

  it("TrainrunSectionViewObject   - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(3);
    const cvo1 = new TrainrunSectionViewObject(editorView, ts);
    expect(cvo1.key).toBe(
      "#3@1234_false_false_0_39_49_1_21_39_0_0_141_39_0_180_0_S_20_7/24_4_1_0_S_20_7/24_20_0_round_trip_false_true_false_false_false_false_false_false_false_true_true_true_false_false_true_true_true_0_false_2_true_true_true_1_false_true_true_0_false_true_true(130,80)(194,80)(254,80)(318,80)",
    );
  });

  it("TransitionViewObject - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const trans = nodeService.getNodeFromId(1).getTransitions()[0];
    const cvo1 = new TransitionViewObject(editorView, trans, false);
    expect(cvo1.key).toBe(
      "#0@false_false_IC_60_7/24_1_3_0_IC_60_7/24_60_false_false_false(320,48)(324,48)(412,48)(416,48)",
    );
  });

  it("StaticDomTags.makeClassTag", () => {
    expect(StaticDomTags.makeClassTag("A", "B")).toBe(" A_B");
    expect(StaticDomTags.makeClassTag(undefined, "B")).toBe(" undefined_B");
    expect(StaticDomTags.makeClassTag("A", undefined)).toBe(" A_undefined");
    expect(StaticDomTags.makeClassTag(undefined, undefined)).toBe(" undefined_undefined");
  });
});

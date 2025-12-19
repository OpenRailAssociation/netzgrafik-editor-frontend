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
import {EditorMainViewComponent} from "../editor-main-view.component";
import {EditorView} from "./editor.view";
import {D3Utils} from "./d3.utils";
import {NetzgrafikUnitTesting} from "../../../../integration-testing/netzgrafik.unit.testing";
import {Vec2D} from "../../../utils/vec2D";
import {LevelOfDetailService} from "../../../services/ui/level.of.detail.service";
import {ViewportCullService} from "../../../services/ui/viewport.cull.service";
import {PositionTransformationService} from "../../../services/util/position.transformation.service";

describe("3d.Utils.tests", () => {
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
      undefined,
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
      undefined,
    );
    controller.bindViewToServices();
    editorView = controller.editorView;
  });

  it("NotesView.convertText", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const txt0 = D3Utils.getPathAsSVGString(
      trainrunSectionService.getTrainrunSectionFromId(1).getPath(),
    );
    expect(txt0).toBe("M418,48L482,48L670,80L734,80");
  });

  it("NotesView.getBezierCurveAsSVGString", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const txt0 = D3Utils.getBezierCurveAsSVGString(
      trainrunSectionService.getTrainrunSectionFromId(1).getPath(),
    );
    expect(txt0).toBe("M 418 48C 482 48, 670 80, 734,80");
  });

  it("NotesView.makeHexagonSVGPoints", () => {
    const txt0 = D3Utils.makeHexagonSVGPoints(new Vec2D(1978, 25), 4);
    expect(txt0).toBe(" 1976,21 1980,21 1982,25 1980,29 1976,29 1974,25");
    const txt1 = D3Utils.makeHexagonSVGPoints(new Vec2D(25, 4), 1978);
    expect(txt1).toBe(" -964,-1974 1014,-1974 2003,4 1014,1982 -964,1982 -1953,4");
    const txt2 = D3Utils.makeHexagonSVGPoints(new Vec2D(2, 4), -1);
    expect(txt2).toBe(" 2.5,5 1.5,5 1,4 1.5,3 2.5,3 3,4");
    const txt3 = D3Utils.makeHexagonSVGPoints(new Vec2D(1, 1), 0);
    expect(txt3).toBe(" 1,1 1,1 1,1 1,1 1,1 1,1");
  });

  it("D3Utils.formatTime", () => {
    const txt0 = D3Utils.formatTime(0, 1);
    expect(txt0).toBe("00:00");
    const txt1 = D3Utils.formatTime(0.01, 2);
    expect(txt1).toBe("00:00.01");
    const txt2 = D3Utils.formatTime(0.001, 2);
    expect(txt2).toBe("00:00");
    const txt3 = D3Utils.formatTime(0.01, 2);
    expect(txt3).toBe("00:00.01");

    const txt4 = D3Utils.formatTime(60, 2);
    expect(txt4).toBe("01:00");
    const txt5 = D3Utils.formatTime(3600, 2);
    expect(txt5).toBe("60:00");
    const txt6 = D3Utils.formatTime(24 * 3600, 2);
    expect(txt6).toBe("1440:00");

    const txt7 = D3Utils.formatTime(180, 2);
    expect(txt7).toBe("03:00");
    const txt8 = D3Utils.formatTime(360, 2);
    expect(txt8).toBe("06:00");
    const txt9 = D3Utils.formatTime(1234, 2);
    expect(txt9).toBe("20:34");

    const txt10 = D3Utils.formatTime(-1234, 2);
    expect(txt10).toBe("-20:34");
  });
});

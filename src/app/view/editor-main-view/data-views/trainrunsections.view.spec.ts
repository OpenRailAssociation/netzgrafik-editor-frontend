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
import {EditorView} from "./editor.view";
import {EditorMainViewComponent} from "../editor-main-view.component";
import {TimeLockDto, TrainrunSectionText} from "../../../data-structures/technical.data.structures";
import {TrainrunSectionsView} from "./trainrunsections.view";
import {Vec2D} from "../../../utils/vec2D";
import {LevelOfDetailService} from "../../../services/ui/level.of.detail.service";
import {ViewportCullService} from "../../../services/ui/viewport.cull.service";
import {PositionTransformationService} from "../../../services/util/position.transformation.service";
import {TrainrunSectionViewObject} from "./trainrunSectionViewObject";

describe("TrainrunSection-View", () => {
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

  const createTrainrunSectionViewObject = (ts: TrainrunSection) =>
    new TrainrunSectionViewObject(
      editorView,
      [ts],
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    );

  it("TrainrunSectionsView.translateAndRotateText - TrainrunSectionName", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const viewObject = createTrainrunSectionViewObject(ts);
    const text = TrainrunSectionsView.translateAndRotateText(
      viewObject,
      TrainrunSectionText.TrainrunSectionName,
    );
    expect(text).toBe("translate(576,116) rotate(9.659893078442336, 0,0) ");
  });

  it("TrainrunSectionsView.translateAndRotateText - TrainrunSectionTravelTime", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const viewObject = createTrainrunSectionViewObject(ts);
    const text = TrainrunSectionsView.translateAndRotateText(
      viewObject,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    expect(text).toBe("translate(576,116) rotate(9.659893078442336, 0,0) ");
  });

  it("TrainrunSectionsView.translateAndRotateText - TrainrunSectionNumberOfStops", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const viewObject = createTrainrunSectionViewObject(ts);
    const text = TrainrunSectionsView.translateAndRotateText(
      viewObject,
      TrainrunSectionText.TrainrunSectionNumberOfStops,
    );
    expect(text).toBe("translate(576,140) rotate(9.659893078442336, 0,0) ");
  });

  it("TrainrunSectionsView.translateAndRotateText - TrainrunSectionName", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const viewObject = createTrainrunSectionViewObject(ts);
    const text = TrainrunSectionsView.translateAndRotateText(
      viewObject,
      TrainrunSectionText.TrainrunSectionName,
    );
    expect(text).toBe("translate(576,116) rotate(9.659893078442336, 0,0) ");
  });

  it("TrainrunSectionsView.translateAndRotateText - SourceArrival", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const viewObject = createTrainrunSectionViewObject(ts);
    const text = TrainrunSectionsView.translateAndRotateText(
      viewObject,
      TrainrunSectionText.SourceArrival,
    );
    expect(text).toBe("translate(436,124) rotate(9.659893078442336, 0,0) ");
  });

  it("TrainrunSectionsView.translateAndRotateText - TargetArrival", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const viewObject = createTrainrunSectionViewObject(ts);
    const text = TrainrunSectionsView.translateAndRotateText(
      viewObject,
      TrainrunSectionText.TargetArrival,
    );
    expect(text).toBe("translate(716,132) rotate(9.659893078442336, 0,0) ");
  });

  it("TrainrunSectionsView.translateAndRotateText - SourceDeparture", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const viewObject = createTrainrunSectionViewObject(ts);
    const text = TrainrunSectionsView.translateAndRotateText(
      viewObject,
      TrainrunSectionText.SourceDeparture,
    );
    expect(text).toBe("translate(464,100) rotate(9.659893078442336, 0,0) ");
  });

  it("TrainrunSectionsView.translateAndRotateText - TargetDeparture", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const viewObject = createTrainrunSectionViewObject(ts);
    const text = TrainrunSectionsView.translateAndRotateText(
      viewObject,
      TrainrunSectionText.TargetDeparture,
    );
    expect(text).toBe("translate(688,156) rotate(9.659893078442336, 0,0) ");
  });

  it("TrainrunSectionsView.isMuted - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const flag = TrainrunSectionsView.isMuted(ts, trainrunService.getTrainrunFromId(1), [1]);
    expect(flag).toBe(true);
  });

  it("TrainrunSectionsView.isMuted - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const flag = TrainrunSectionsView.isMuted(ts, trainrunService.getTrainrunFromId(1), undefined);
    expect(flag).toBe(true);
  });

  it("TrainrunSectionsView.isMuted - 003", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const flag = TrainrunSectionsView.isMuted(ts, trainrunService.getTrainrunFromId(2), undefined);
    expect(flag).toBe(false);
  });

  it("TrainrunSectionsView.isMuted - 004", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const flag = TrainrunSectionsView.isMuted(ts, trainrunService.getTrainrunFromId(2), [
      ts.getTrainrunId(),
    ]);
    expect(flag).toBe(false);
  });

  it("TrainrunSectionsView.createTrainrunSectionFrequencyClassAttribute - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const str = TrainrunSectionsView.createTrainrunSectionFrequencyClassAttribute(
      ts,
      trainrunService.getTrainrunFromId(2),
      [ts.getTrainrunId()],
    );
    expect(str).toBe(" Freq_20 ColorRef_S LinePatternRef_7/24");
  });

  it("TrainrunSectionsView.createTrainrunSectionFrequencyClassAttribute - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const str = TrainrunSectionsView.createTrainrunSectionFrequencyClassAttribute(
      ts,
      trainrunService.getTrainrunFromId(4),
      undefined,
    );
    expect(str).toBe(" Freq_20 ColorRef_S LinePatternRef_7/24 muted");
  });

  it("TrainrunSectionsView.createSemicircle - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const str = TrainrunSectionsView.createSemicircle(ts, new Vec2D(100, 25));
    expect(str).toBe("M2.4492935982947064e-16,-4A4,4,0,1,1,2.4492935982947064e-16,4L0,0Z");
  });

  it("TrainrunSectionsView.createSemicircle - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const str = TrainrunSectionsView.createSemicircle(ts, ts.getPath()[3]);
    expect(str).toBe("M-7.347880794884119e-16,4A4,4,0,1,1,2.4492935982947064e-16,-4L0,0Z");
  });

  it("TrainrunSectionsView.getPosition - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const viewObject = createTrainrunSectionViewObject(ts);
    const v = TrainrunSectionsView.getPosition(viewObject, false);
    expect(v.getX()).toBe(734);
    expect(v.getY()).toBe(144);
  });

  it("TrainrunSectionsView.getPosition - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const viewObject = createTrainrunSectionViewObject(ts);
    const v = TrainrunSectionsView.getPosition(viewObject, true);
    expect(v.getX()).toBe(418);
    expect(v.getY()).toBe(112);
  });

  it("TrainrunSectionsView.getNode - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const v = TrainrunSectionsView.getNode(ts, false);
    expect(v.getId()).toBe(2);
  });

  it("TrainrunSectionsView.getNode - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const v = TrainrunSectionsView.getNode(ts, true);
    expect(v.getId()).toBe(1);
  });

  it("TrainrunSectionsView.hasWarning - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const v1 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.SourceDeparture);
    const v2 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.SourceArrival);
    const v3 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TargetDeparture);
    const v4 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TargetArrival);
    const v5 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TrainrunSectionTravelTime);
    const v6 = TrainrunSectionsView.hasWarning(ts, undefined);

    expect(v1).toBe(false);
    expect(v2).toBe(false);
    expect(v3).toBe(false);
    expect(v4).toBe(false);
    expect(v5).toBe(false);
    expect(v6).toBe(false);
  });

  it("TrainrunSectionsView.hasWarning - SourceDeparture", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const v11 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.SourceDeparture);
    ts.setSourceDepartureWarning("warning", "warn me");
    const v12 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.SourceDeparture);
    const v2 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.SourceArrival);
    const v3 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TargetDeparture);
    const v4 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TargetArrival);
    const v5 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TrainrunSectionTravelTime);
    const v6 = TrainrunSectionsView.hasWarning(ts, undefined);

    expect(v11).toBe(false);
    expect(v12).toBe(true);
    expect(v2).toBe(false);
    expect(v3).toBe(false);
    expect(v4).toBe(false);
    expect(v5).toBe(false);
    expect(v6).toBe(false);
  });

  it("TrainrunSectionsView.hasWarning - SourceArrival", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const v1 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.SourceDeparture);
    const v21 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.SourceArrival);
    ts.setSourceArrivalWarning("warning", "warn me");
    const v22 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.SourceArrival);
    const v3 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TargetDeparture);
    const v4 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TargetArrival);
    const v5 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TrainrunSectionTravelTime);
    const v6 = TrainrunSectionsView.hasWarning(ts, undefined);

    expect(v1).toBe(false);
    expect(v21).toBe(false);
    expect(v22).toBe(true);
    expect(v3).toBe(false);
    expect(v4).toBe(false);
    expect(v5).toBe(false);
    expect(v6).toBe(false);
  });

  it("TrainrunSectionsView.hasWarning - TargetDeparture", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const v1 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.SourceDeparture);
    const v2 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.SourceArrival);
    const v31 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TargetDeparture);
    ts.setTargetDepartureWarning("warning", "warn me");
    const v32 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TargetDeparture);
    const v4 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TargetArrival);
    const v5 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TrainrunSectionTravelTime);
    const v6 = TrainrunSectionsView.hasWarning(ts, undefined);

    expect(v1).toBe(false);
    expect(v2).toBe(false);
    expect(v31).toBe(false);
    expect(v32).toBe(true);
    expect(v4).toBe(false);
    expect(v5).toBe(false);
    expect(v6).toBe(false);
  });

  it("TrainrunSectionsView.hasWarning - TargetArrival", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const v1 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.SourceDeparture);
    const v2 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.SourceArrival);
    const v3 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TargetDeparture);
    const v41 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TargetArrival);
    ts.setTargetArrivalWarning("warning", "warn me");
    const v42 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TargetArrival);
    const v5 = TrainrunSectionsView.hasWarning(ts, TrainrunSectionText.TrainrunSectionTravelTime);
    const v6 = TrainrunSectionsView.hasWarning(ts, undefined);

    expect(v1).toBe(false);
    expect(v2).toBe(false);
    expect(v3).toBe(false);
    expect(v41).toBe(false);
    expect(v42).toBe(true);
    expect(v5).toBe(false);
    expect(v6).toBe(false);
  });

  it("TrainrunSectionsView.getTime", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const v1 = TrainrunSectionsView.getTime(ts, TrainrunSectionText.SourceDeparture);
    const v2 = TrainrunSectionsView.getTime(ts, TrainrunSectionText.SourceArrival);
    const v3 = TrainrunSectionsView.getTime(ts, TrainrunSectionText.TargetDeparture);
    const v4 = TrainrunSectionsView.getTime(ts, TrainrunSectionText.TargetArrival);
    const v5 = TrainrunSectionsView.getTime(ts, TrainrunSectionText.TrainrunSectionTravelTime);
    const v6 = TrainrunSectionsView.getTime(ts, undefined);

    expect(v1).toBe(39);
    expect(v2).toBe(21);
    expect(v3).toBe(11);
    expect(v4).toBe(49);
    expect(v5).toBe(10);
    expect(v6).toBe(0);
  });

  it("TrainrunSectionsView.getFormattedDisplayText - TrainrunSectionTravelTime", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const timeLockDto: TimeLockDto = {
      time: 10,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "{{time}}",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    ts.setTravelTimeDto(timeLockDto);

    const v1 = TrainrunSectionsView.getFormattedDisplayText(
      ts,
      TrainrunSectionText.SourceDeparture,
    );
    const v2 = TrainrunSectionsView.getFormattedDisplayText(ts, TrainrunSectionText.SourceArrival);
    const v3 = TrainrunSectionsView.getFormattedDisplayText(
      ts,
      TrainrunSectionText.TargetDeparture,
    );
    const v4 = TrainrunSectionsView.getFormattedDisplayText(ts, TrainrunSectionText.TargetArrival);
    const v5 = TrainrunSectionsView.getFormattedDisplayText(
      ts,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const v6 = TrainrunSectionsView.getFormattedDisplayText(ts, undefined);
    expect(v1).toBe(undefined);
    expect(v2).toBe(undefined);
    expect(v3).toBe(undefined);
    expect(v4).toBe(undefined);
    expect(v5).toBe("10");
    expect(v6).toBe(undefined);
  });

  it("TrainrunSectionsView.getFormattedDisplayText - TargetArrival", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const timeLockDto: TimeLockDto = {
      time: 10,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "{{time}}",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    ts.setTargetArrivalDto(timeLockDto);

    const v1 = TrainrunSectionsView.getFormattedDisplayText(
      ts,
      TrainrunSectionText.SourceDeparture,
    );
    const v2 = TrainrunSectionsView.getFormattedDisplayText(ts, TrainrunSectionText.SourceArrival);
    const v3 = TrainrunSectionsView.getFormattedDisplayText(
      ts,
      TrainrunSectionText.TargetDeparture,
    );
    const v4 = TrainrunSectionsView.getFormattedDisplayText(ts, TrainrunSectionText.TargetArrival);
    const v5 = TrainrunSectionsView.getFormattedDisplayText(
      ts,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const v6 = TrainrunSectionsView.getFormattedDisplayText(ts, undefined);
    expect(v1).toBe(undefined);
    expect(v2).toBe(undefined);
    expect(v3).toBe(undefined);
    expect(v4).toBe("10");
    expect(v5).toBe(undefined);
    expect(v6).toBe(undefined);
  });

  it("TrainrunSectionsView.getFormattedDisplayText - TargetDeparture", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const timeLockDto: TimeLockDto = {
      time: 10,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "{{time}}",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    ts.setTargetDepartureDto(timeLockDto);

    const v1 = TrainrunSectionsView.getFormattedDisplayText(
      ts,
      TrainrunSectionText.SourceDeparture,
    );
    const v2 = TrainrunSectionsView.getFormattedDisplayText(ts, TrainrunSectionText.SourceArrival);
    const v3 = TrainrunSectionsView.getFormattedDisplayText(
      ts,
      TrainrunSectionText.TargetDeparture,
    );
    const v4 = TrainrunSectionsView.getFormattedDisplayText(ts, TrainrunSectionText.TargetArrival);
    const v5 = TrainrunSectionsView.getFormattedDisplayText(
      ts,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const v6 = TrainrunSectionsView.getFormattedDisplayText(ts, undefined);
    expect(v1).toBe(undefined);
    expect(v2).toBe(undefined);
    expect(v3).toBe("10");
    expect(v4).toBe(undefined);
    expect(v5).toBe(undefined);
    expect(v6).toBe(undefined);
  });

  it("TrainrunSectionsView.getFormattedDisplayText - SourceArrival", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const timeLockDto: TimeLockDto = {
      time: 10,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "{{time}}",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    ts.setSourceArrivalDto(timeLockDto);

    const v1 = TrainrunSectionsView.getFormattedDisplayText(
      ts,
      TrainrunSectionText.SourceDeparture,
    );
    const v2 = TrainrunSectionsView.getFormattedDisplayText(ts, TrainrunSectionText.SourceArrival);
    const v3 = TrainrunSectionsView.getFormattedDisplayText(
      ts,
      TrainrunSectionText.TargetDeparture,
    );
    const v4 = TrainrunSectionsView.getFormattedDisplayText(ts, TrainrunSectionText.TargetArrival);
    const v5 = TrainrunSectionsView.getFormattedDisplayText(
      ts,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const v6 = TrainrunSectionsView.getFormattedDisplayText(ts, undefined);
    expect(v1).toBe(undefined);
    expect(v2).toBe("10");
    expect(v3).toBe(undefined);
    expect(v4).toBe(undefined);
    expect(v5).toBe(undefined);
    expect(v6).toBe(undefined);
  });

  it("TrainrunSectionsView.getFormattedDisplayText - SourceDeparture", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const timeLockDto: TimeLockDto = {
      time: 10,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "{{time}}",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    ts.setSourceDepartureDto(timeLockDto);

    const v1 = TrainrunSectionsView.getFormattedDisplayText(
      ts,
      TrainrunSectionText.SourceDeparture,
    );
    const v2 = TrainrunSectionsView.getFormattedDisplayText(ts, TrainrunSectionText.SourceArrival);
    const v3 = TrainrunSectionsView.getFormattedDisplayText(
      ts,
      TrainrunSectionText.TargetDeparture,
    );
    const v4 = TrainrunSectionsView.getFormattedDisplayText(ts, TrainrunSectionText.TargetArrival);
    const v5 = TrainrunSectionsView.getFormattedDisplayText(
      ts,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const v6 = TrainrunSectionsView.getFormattedDisplayText(ts, undefined);
    expect(v1).toBe("10");
    expect(v2).toBe(undefined);
    expect(v3).toBe(undefined);
    expect(v4).toBe(undefined);
    expect(v5).toBe(undefined);
    expect(v6).toBe(undefined);
  });

  it("TrainrunSectionsView.getFormattedDisplayTextWidth", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const v1 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.SourceDeparture,
    );
    const v2 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.SourceArrival,
    );
    const v3 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TargetDeparture,
    );
    const v4 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TargetArrival,
    );
    const v5 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const v6 = TrainrunSectionsView.getFormattedDisplayTextWidth(ts, undefined);

    expect(v1).toBe(undefined);
    expect(v2).toBe(undefined);
    expect(v3).toBe(undefined);
    expect(v4).toBe(undefined);
    expect(v5).toBe(undefined);
    expect(v6).toBe(undefined);
  });

  it("TrainrunSectionsView.getFormattedDisplayTextWidth - SourceDeparture", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const timeLockDto: TimeLockDto = {
      time: 10,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "{{time}}",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    ts.setSourceDepartureDto(timeLockDto);

    const v1 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.SourceDeparture,
    );
    const v2 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.SourceArrival,
    );
    const v3 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TargetDeparture,
    );
    const v4 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TargetArrival,
    );
    const v5 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const v6 = TrainrunSectionsView.getFormattedDisplayTextWidth(ts, undefined);
    expect(v1).toBe(20);
    expect(v2).toBe(undefined);
    expect(v3).toBe(undefined);
    expect(v4).toBe(undefined);
    expect(v5).toBe(undefined);
    expect(v6).toBe(undefined);
  });

  it("TrainrunSectionsView.getFormattedDisplayTextWidth - SourceArrival", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const timeLockDto: TimeLockDto = {
      time: 10,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "{{time}}",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    ts.setSourceArrivalDto(timeLockDto);

    const v1 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.SourceDeparture,
    );
    const v2 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.SourceArrival,
    );
    const v3 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TargetDeparture,
    );
    const v4 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TargetArrival,
    );
    const v5 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const v6 = TrainrunSectionsView.getFormattedDisplayTextWidth(ts, undefined);
    expect(v1).toBe(undefined);
    expect(v2).toBe(20);
    expect(v3).toBe(undefined);
    expect(v4).toBe(undefined);
    expect(v5).toBe(undefined);
    expect(v6).toBe(undefined);
  });

  it("TrainrunSectionsView.getFormattedDisplayTextWidth - TargetDeparture", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const timeLockDto: TimeLockDto = {
      time: 10,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "{{time}}",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    ts.setTargetArrivalDto(timeLockDto);

    const v1 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.SourceDeparture,
    );
    const v2 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.SourceArrival,
    );
    const v3 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TargetDeparture,
    );
    const v4 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TargetArrival,
    );
    const v5 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const v6 = TrainrunSectionsView.getFormattedDisplayTextWidth(ts, undefined);
    expect(v1).toBe(undefined);
    expect(v2).toBe(undefined);
    expect(v3).toBe(undefined);
    expect(v4).toBe(20);
    expect(v5).toBe(undefined);
    expect(v6).toBe(undefined);
  });

  it("TrainrunSectionsView.getFormattedDisplayTextWidth - TargetArrival", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const timeLockDto: TimeLockDto = {
      time: 10,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "{{time}}",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    ts.setTargetArrivalDto(timeLockDto);

    const v1 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.SourceDeparture,
    );
    const v2 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.SourceArrival,
    );
    const v3 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TargetDeparture,
    );
    const v4 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TargetArrival,
    );
    const v5 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const v6 = TrainrunSectionsView.getFormattedDisplayTextWidth(ts, undefined);
    expect(v1).toBe(undefined);
    expect(v2).toBe(undefined);
    expect(v3).toBe(undefined);
    expect(v4).toBe(20);
    expect(v5).toBe(undefined);
    expect(v6).toBe(undefined);
  });

  it("TrainrunSectionsView.getFormattedDisplayTextWidth - TrainrunSectionTravelTime", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const timeLockDto: TimeLockDto = {
      time: 10,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "{{time}}",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    ts.setTravelTimeDto(timeLockDto);

    const v1 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.SourceDeparture,
    );
    const v2 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.SourceArrival,
    );
    const v3 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TargetDeparture,
    );
    const v4 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TargetArrival,
    );
    const v5 = TrainrunSectionsView.getFormattedDisplayTextWidth(
      ts,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const v6 = TrainrunSectionsView.getFormattedDisplayTextWidth(ts, undefined);
    expect(v1).toBe(undefined);
    expect(v2).toBe(undefined);
    expect(v3).toBe(undefined);
    expect(v4).toBe(undefined);
    expect(v5).toBe(20);
    expect(v6).toBe(undefined);
  });

  it("TrainrunSectionsView.enforceStartTextAnchor - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const viewObject = createTrainrunSectionViewObject(ts);
    const v1 = TrainrunSectionsView.enforceStartTextAnchor(viewObject, false);
    expect(v1).toBe(false);
  });

  it("TrainrunSectionsView.enforceStartTextAnchor - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const viewObject = createTrainrunSectionViewObject(ts);
    const v1 = TrainrunSectionsView.enforceStartTextAnchor(viewObject, true);
    expect(v1).toBe(true);
  });

  it("TrainrunSectionsView.enforceStartTextAnchor - 003", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const viewObject = createTrainrunSectionViewObject(ts);
    const v1 = TrainrunSectionsView.enforceStartTextAnchor(viewObject, false);
    expect(v1).toBe(false);
  });

  it("TrainrunSectionsView.enforceStartTextAnchor - 004", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const viewObject = createTrainrunSectionViewObject(ts);
    const v1 = TrainrunSectionsView.enforceStartTextAnchor(viewObject, true);
    expect(v1).toBe(true);
  });

  it("TrainrunSectionsView.enforceStartTextAnchor - 005", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(6);
    const viewObject = createTrainrunSectionViewObject(ts);
    const v1 = TrainrunSectionsView.enforceStartTextAnchor(viewObject, true);
    expect(v1).toBe(false);
  });

  it("TrainrunSectionsView.enforceStartTextAnchor - 006", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(6);
    const viewObject = createTrainrunSectionViewObject(ts);
    const v1 = TrainrunSectionsView.enforceStartTextAnchor(viewObject, false);
    expect(v1).toBe(true);
  });

  it("TrainrunSectionsView.enforceStartTextAnchor - 007", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(7);
    ts.getPath()[1].setY(-1);
    const viewObject = createTrainrunSectionViewObject(ts);
    const v1 = TrainrunSectionsView.enforceStartTextAnchor(viewObject, true);
    expect(v1).toBe(true);
  });

  it("TrainrunSectionsView.enforceStartTextAnchor - 008", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(7);
    ts.getPath()[3].setX(ts.getPath()[2].getX());
    ts.getPath()[3].setY(ts.getPath()[2].getY() + 1000);
    const viewObject = createTrainrunSectionViewObject(ts);
    const v1 = TrainrunSectionsView.enforceStartTextAnchor(viewObject, false);
    expect(v1).toBe(true);
  });

  it("TrainrunSectionsView.getAdditionTextCloseToNodePositioningValue - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const viewObject = createTrainrunSectionViewObject(ts);
    const v1 = TrainrunSectionsView.getAdditionTextCloseToNodePositioningValue(viewObject, true);
    expect(v1).toBe("translate(498,80) rotate(0)");
  });

  it("TrainrunSectionsView.getAdditionTextCloseToNodePositioningValue - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const viewObject = createTrainrunSectionViewObject(ts);
    const v1 = TrainrunSectionsView.getAdditionTextCloseToNodePositioningValue(viewObject, false);
    expect(v1).toBe("translate(654,112) rotate(0)");
  });

  it("TrainrunSectionsView.getAdditionTextCloseToNodePositioningValue - 003", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(6);
    ts.getPath()[3].setX(ts.getPath()[2].getX());
    ts.getPath()[3].setY(ts.getPath()[2].getY() + 1000);
    const viewObject = createTrainrunSectionViewObject(ts);
    const v1 = TrainrunSectionsView.getAdditionTextCloseToNodePositioningValue(viewObject, false);
    expect(v1).toBe("translate(898,96) rotate(-90)");
  });

  it("TrainrunSectionsView.getAdditionTextCloseToNodePositioningValue - 003", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(6);
    ts.getPath()[1].setX(ts.getPath()[0].getX());
    ts.getPath()[1].setY(ts.getPath()[0].getY());
    const viewObject = createTrainrunSectionViewObject(ts);
    const v1 = TrainrunSectionsView.getAdditionTextCloseToNodePositioningValue(viewObject, true);
    expect(v1).toBe("translate(1054,272) rotate(-90)");
  });

  it("TrainrunSectionsView.getPositionX - TrainrunSectionName", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getPositionX(ts, TrainrunSectionText.TrainrunSectionName);
    expect(v1).toBe(-8);
  });

  it("TrainrunSectionsView.getPositionX - TrainrunSectionTravelTime", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getPositionX(ts, TrainrunSectionText.TrainrunSectionTravelTime);
    expect(v1).toBe(8);
  });

  it("TrainrunSectionsView.getPositionX - TargetDeparture", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getPositionX(ts, TrainrunSectionText.TargetDeparture);
    expect(v1).toBe(688);
  });

  it("TrainrunSectionsView.getPositionX - TrainrunSectionNumberOfStops", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getPositionX(
      ts,
      TrainrunSectionText.TrainrunSectionNumberOfStops,
    );
    expect(v1).toBe(0);
  });

  it("TrainrunSectionsView.getPositionY - TrainrunSectionName", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getPositionY(ts, TrainrunSectionText.TrainrunSectionName);
    expect(v1).toBe(0);
  });

  it("TrainrunSectionsView.getPositionY - TrainrunSectionName", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getPositionX(ts, TrainrunSectionText.TrainrunSectionName);
    expect(v1).toBe(-8);
  });

  it("TrainrunSectionsView.getPositionY - TrainrunSectionTravelTime", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getPositionX(ts, TrainrunSectionText.TrainrunSectionTravelTime);
    expect(v1).toBe(8);
  });

  it("TrainrunSectionsView.getPositionY - TargetDeparture", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getPositionY(ts, TrainrunSectionText.TargetDeparture);
    expect(v1).toBe(124);
  });

  it("TrainrunSectionsView.getPositionY - TrainrunSectionNumberOfStops", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getPositionY(
      ts,
      TrainrunSectionText.TrainrunSectionNumberOfStops,
    );
    expect(v1).toBe(0);
  });

  it("TrainrunSectionsView.getAdditionPositioningAttr - TrainrunSectionTravelTime", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const v1 = TrainrunSectionsView.getAdditionPositioningAttr(
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    expect(v1).toBe("transform");
  });

  it("TrainrunSectionsView.getAdditionPositioningAttr - TargetDeparture", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const v1 = TrainrunSectionsView.getAdditionPositioningAttr(TrainrunSectionText.TargetDeparture);
    expect(v1).toBe("dy");
  });

  it("TrainrunSectionsView.getAdditionPositioningAttr - TrainrunSectionNumberOfStops", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const v1 = TrainrunSectionsView.getAdditionPositioningAttr(
      TrainrunSectionText.TrainrunSectionNumberOfStops,
    );
    expect(v1).toBe("");
  });

  it("TrainrunSectionsView.getAdditionPositioningValue - TrainrunSectionTravelTime", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getAdditionPositioningValue(
      ts,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    expect(v1).toBe("translate(576,84) rotate(9.659893078442336, 0,0) ");
  });

  it("TrainrunSectionsView.getAdditionPositioningValue - TargetDeparture", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getAdditionPositioningValue(
      ts,
      TrainrunSectionText.TargetDeparture,
    );
    expect(v1).toBe(1.5);
  });

  it("TrainrunSectionsView.getAdditionPositioningValue - TrainrunSectionNumberOfStops", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getAdditionPositioningValue(
      ts,
      TrainrunSectionText.TrainrunSectionNumberOfStops,
    );
    expect(v1).toBe(0);
  });

  it("TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const t = trainrunService.getTrainrunFromId(1);
    t.setTrainrunFrequency(dataService.getTrainrunFrequency(4));
    const v1 = TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(10, t);
    expect(v1).toBe("");
  });

  it("TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const t = trainrunService.getTrainrunFromId(1);
    t.setTrainrunFrequency(dataService.getTrainrunFrequency(4));
    const v1 = TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(180, t);
    expect(v1).toBe(" OddFrequency");
  });

  it("TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag - 003", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const t = trainrunService.getTrainrunFromId(1);
    const v1 = TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(10, t);
    expect(v1).toBe("");
  });

  it("TrainrunSectionsView.formatTime - 001", () => {
    const v1 = TrainrunSectionsView.formatTime(2504.1978, 0);
    expect(v1).toBe(2504);
  });

  it("TrainrunSectionsView.formatTime - 002", () => {
    const v1 = TrainrunSectionsView.formatTime(2504.1978, 1);
    expect(v1).toBe(2504.2);
  });

  it("TrainrunSectionsView.formatTime - 003", () => {
    const v1 = TrainrunSectionsView.formatTime(2504.1978, 2);
    expect(v1).toBe(2504.2);
  });

  it("TrainrunSectionsView.formatTime - 004", () => {
    const v1 = TrainrunSectionsView.formatTime(2504.1978, 3);
    expect(v1).toBe(2504.198);
  });

  it("TrainrunSectionsView.formatTime - 005", () => {
    const v1 = TrainrunSectionsView.formatTime(2504.1978, 4);
    expect(v1).toBe(2504.1978);
  });

  it("TrainrunSectionsView.isBothSideNonStop - 005", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.isBothSideNonStop(ts);
    expect(v1).toBe(false);
  });

  it("TrainrunSectionsView.extractTrainrunName - 005", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.extractTrainrunName(ts);
    expect(v1).toBe("S1");
  });

  it("TrainrunSectionsView.extractTrainrunName - 005", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    const v0 = TrainrunSectionsView.extractTravelTime(
      trainrunSectionService.getTrainrunSectionFromId(0),
      editorView,
    );
    expect(v0).toBe("10'");

    const v1 = TrainrunSectionsView.extractTravelTime(
      trainrunSectionService.getTrainrunSectionFromId(1),
      editorView,
    );
    expect(v1).toBe("10'");

    const v2 = TrainrunSectionsView.extractTravelTime(
      trainrunSectionService.getTrainrunSectionFromId(2),
      editorView,
    );
    expect(v2).toBe("20'");

    const v3 = TrainrunSectionsView.extractTravelTime(
      trainrunSectionService.getTrainrunSectionFromId(3),
      editorView,
    );
    expect(v3).toBe("49' (39')");

    const v4 = TrainrunSectionsView.extractTravelTime(
      trainrunSectionService.getTrainrunSectionFromId(4),
      editorView,
    );
    expect(v4).toBe("49' (10')");

    const v5 = TrainrunSectionsView.extractTravelTime(
      trainrunSectionService.getTrainrunSectionFromId(5),
      editorView,
    );
    expect(v5).toBe("51'");

    const v6 = TrainrunSectionsView.extractTravelTime(
      trainrunSectionService.getTrainrunSectionFromId(6),
      editorView,
    );
    expect(v6).toBe("10'");

    const v7 = TrainrunSectionsView.extractTravelTime(
      trainrunSectionService.getTrainrunSectionFromId(7),
      editorView,
    );
    expect(v7).toBe("10'");
  });

  it("TrainrunSectionsView.extractTrainrunName - 006", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);
    const n1 = ts.getSourceNode();
    const n2 = ts.getTargetNode();
    const t1 = n1.getTransition(ts.getId());
    const t2 = n2.getTransition(ts.getId());
    t1.setIsNonStopTransit(true);
    t2.setIsNonStopTransit(true);
    const v0 = TrainrunSectionsView.extractTravelTime(ts, editorView);
    expect(v0).toBe("(10')");
  });

  it("TrainrunSectionsView.getTrainrunSectionTimeElementClass - TrainrunSectionNumberOfStops", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getTrainrunSectionTimeElementClass(
      ts,
      TrainrunSectionText.TrainrunSectionNumberOfStops,
      ts.getTrainrun(),
      [ts.getTrainrunId()],
    );
    expect(v1).toBe(undefined);
  });

  it("TrainrunSectionsView.getTrainrunSectionTimeElementClass - TrainrunSectionName", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getTrainrunSectionTimeElementClass(
      ts,
      TrainrunSectionText.TrainrunSectionName,
      ts.getTrainrun(),
      [ts.getTrainrunId()],
    );
    expect(v1).toBe(
      "edge_text Freq_30 ColorRef_S LinePatternRef_7/24 TrainrunSectionName ColorRef_S",
    );
  });

  it("TrainrunSectionsView.getTrainrunSectionTimeElementClass - SourceArrival", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getTrainrunSectionTimeElementClass(
      ts,
      TrainrunSectionText.SourceArrival,
      trainrunService.getTrainrunFromId(1),
      undefined,
    );
    expect(v1).toBe("edge_text SourceArrival  ColorRef_S");
  });

  it("TrainrunSectionsView.getTrainrunSectionTimeElementClass - SourceDeparture", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getTrainrunSectionTimeElementClass(
      ts,
      TrainrunSectionText.SourceDeparture,
      trainrunService.getTrainrunFromId(1),
      [0, 1, 2],
    );
    expect(v1).toBe("edge_text SourceDeparture  ColorRef_S");
  });

  it("TrainrunSectionsView.getTrainrunSectionTimeElementClass - TargetDeparture", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getTrainrunSectionTimeElementClass(
      ts,
      TrainrunSectionText.TargetDeparture,
      trainrunService.getTrainrunFromId(1),
      [0, 1, 2],
    );
    expect(v1).toBe("edge_text TargetDeparture  ColorRef_S");
  });

  it("TrainrunSectionsView.getTrainrunSectionTimeElementClass - TargetArrival", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getTrainrunSectionTimeElementClass(
      ts,
      TrainrunSectionText.TargetArrival,
      trainrunService.getTrainrunFromId(1),
      [0, 1, 2],
    );
    expect(v1).toBe("edge_text TargetArrival  ColorRef_S");
  });

  it("TrainrunSectionsView.getTrainrunSectionTimeElementClass - TrainrunSectionTravelTime", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getTrainrunSectionTimeElementClass(
      ts,
      TrainrunSectionText.TrainrunSectionTravelTime,
      trainrunService.getTrainrunFromId(1),
      [0, 1, 2],
    );
    expect(v1).toBe("edge_text TrainrunSectionTravelTime  ColorRef_S");
  });

  it("TrainrunSectionsView.getTrainrunSectionValueToShow - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    const trainrunSection = trainrunSectionService.getTrainrunSectionFromId(0);
    const viewObject = createTrainrunSectionViewObject(trainrunSection);

    const v0 = TrainrunSectionsView.getTrainrunSectionValueToShow(
      viewObject,
      TrainrunSectionText.TrainrunSectionNumberOfStops,
      editorView,
    );
    expect(v0).toBe(undefined);

    const v1 = TrainrunSectionsView.getTrainrunSectionValueToShow(
      viewObject,
      TrainrunSectionText.TrainrunSectionName,
      editorView,
    );
    expect(v1).toBe("IC1");

    const v2 = TrainrunSectionsView.getTrainrunSectionValueToShow(
      viewObject,
      TrainrunSectionText.TargetDeparture,
      editorView,
    );
    expect(v2).toBe(50);

    const v3 = TrainrunSectionsView.getTrainrunSectionValueToShow(
      viewObject,
      TrainrunSectionText.TargetArrival,
      editorView,
    );
    expect(v3).toBe(10);

    const v4 = TrainrunSectionsView.getTrainrunSectionValueToShow(
      viewObject,
      TrainrunSectionText.SourceDeparture,
      editorView,
    );
    expect(v4).toBe(0);

    const v5 = TrainrunSectionsView.getTrainrunSectionValueToShow(
      viewObject,
      TrainrunSectionText.SourceArrival,
      editorView,
    );
    expect(v5).toBe(0);

    const v6 = TrainrunSectionsView.getTrainrunSectionValueToShow(
      viewObject,
      TrainrunSectionText.TrainrunSectionTravelTime,
      editorView,
    );
    expect(v6).toBe("10'");
  });

  it("TrainrunSectionsView.getTrainrunSectionValueTextWidth - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getTrainrunSectionValueTextWidth(
      ts,
      TrainrunSectionText.TrainrunSectionNumberOfStops,
    );
    expect(v1).toBe(20);
    const v2 = TrainrunSectionsView.getTrainrunSectionValueTextWidth(
      ts,
      TrainrunSectionText.TrainrunSectionName,
    );
    expect(v2).toBe(20);
    const v3 = TrainrunSectionsView.getTrainrunSectionValueTextWidth(
      ts,
      TrainrunSectionText.SourceArrival,
    );
    expect(v3).toBe(20);
    const v4 = TrainrunSectionsView.getTrainrunSectionValueTextWidth(
      ts,
      TrainrunSectionText.SourceDeparture,
    );
    expect(v4).toBe(20);
    const v5 = TrainrunSectionsView.getTrainrunSectionValueTextWidth(
      ts,
      TrainrunSectionText.TargetArrival,
    );
    expect(v5).toBe(20);
    const v6 = TrainrunSectionsView.getTrainrunSectionValueTextWidth(
      ts,
      TrainrunSectionText.TargetDeparture,
    );
    expect(v6).toBe(20);
    const v7 = TrainrunSectionsView.getTrainrunSectionValueTextWidth(
      ts,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    expect(v7).toBe(20);
  });

  it("TrainrunSectionsView.getTrainrunSectionValueHtmlStyle - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(2);
    const v1 = TrainrunSectionsView.getTrainrunSectionValueHtmlStyle(
      ts,
      TrainrunSectionText.TrainrunSectionNumberOfStops,
    );
    expect(v1).toBe(undefined);
    const v2 = TrainrunSectionsView.getTrainrunSectionValueHtmlStyle(
      ts,
      TrainrunSectionText.TrainrunSectionName,
    );
    expect(v2).toBe(undefined);
    const v3 = TrainrunSectionsView.getTrainrunSectionValueHtmlStyle(
      ts,
      TrainrunSectionText.SourceArrival,
    );
    expect(v3).toBe(undefined);
    const v4 = TrainrunSectionsView.getTrainrunSectionValueHtmlStyle(
      ts,
      TrainrunSectionText.SourceDeparture,
    );
    expect(v4).toBe(undefined);
    const v5 = TrainrunSectionsView.getTrainrunSectionValueHtmlStyle(
      ts,
      TrainrunSectionText.TargetArrival,
    );
    expect(v5).toBe(undefined);
    const v6 = TrainrunSectionsView.getTrainrunSectionValueHtmlStyle(
      ts,
      TrainrunSectionText.TargetDeparture,
    );
    expect(v6).toBe(undefined);
    const v7 = TrainrunSectionsView.getTrainrunSectionValueHtmlStyle(
      ts,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    expect(v7).toBe(undefined);
    const v8 = TrainrunSectionsView.getTrainrunSectionValueHtmlStyle(ts, undefined);
    expect(v8).toBe(undefined);
  });

  it("TrainrunSectionsView.getTrainrunSectionNextAndDestinationNodeToShow - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(0);
    const viewObject = createTrainrunSectionViewObject(ts);
    const v0 = TrainrunSectionsView.getTrainrunSectionNextAndDestinationNodeToShow(
      viewObject,
      editorView,
      false,
    );
    expect(v0).toBe("BN");
    const v1 = TrainrunSectionsView.getTrainrunSectionNextAndDestinationNodeToShow(
      viewObject,
      editorView,
      true,
    );
    expect(v1).toBe("ZUE");
  });
});

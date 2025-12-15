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
import {LogService} from "../../logger/log.service";
import {LogPublishersService} from "../../logger/log.publishers.service";
import {FilterService} from "../../../services/ui/filter.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {LoadPerlenketteService} from "../../../perlenkette/service/load-perlenkette.service";
import {NotesView} from "./notes.view";
import {EditorMainViewComponent} from "../editor-main-view.component";
import {EditorView} from "./editor.view";
import {NetzgrafikUnitTesting} from "../../../../integration-testing/netzgrafik.unit.testing";
import {LevelOfDetailService} from "../../../services/ui/level.of.detail.service";
import {ViewportCullService} from "../../../services/ui/viewport.cull.service";
import {PositionTransformationService} from "../../../services/util/position.transformation.service";

describe("Notes-View", () => {
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

  it("notesView constructor test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const notesView = new NotesView(editorView);
  });

  it("NotesView.convertText", () => {
    const txt0 = NotesView.convertText("qwertz");
    expect(txt0).toBe("qwertz");
  });

  it("NotesView.convertText should handle tab characters", () => {
    // Test direct tab characters
    const txt1 = NotesView.convertText("hello\tworld");
    expect(txt1).toBe("hello    world");

    // Test HTML tab entities
    const txt2 = NotesView.convertText("hello&#9;world");
    expect(txt2).toBe("hello    world");

    // Test double-escaped HTML tab entities
    const txt3 = NotesView.convertText("hello&amp;#9;world");
    expect(txt3).toBe("hello    world");

    // Test four non-breaking spaces as tab approximation (converted to tab then to spaces)
    const txt4 = NotesView.convertText("hello&nbsp;&nbsp;&nbsp;&nbsp;world");
    expect(txt4).toBe("hello    world");

    // Test multiple tabs
    const txt5 = NotesView.convertText("first\t\tsecond");
    expect(txt5).toBe("first        second");

    // Test mixed content with tabs
    const txt6 = NotesView.convertText("<p>text with\ttab</p>");
    expect(txt6).toBe('<tspan x="8" dy="24">text with    tab</tspan>&nbsp;</tspan>');
  });

  it("NotesView.extractTextBasedWidth should handle tab characters", () => {
    // Create a mock note object
    const mockNote = {
      getText: () => "hello\tworld",
      getTitle: () => "test",
      getWidth: () => 100
    } as any;

    // The width calculation should convert tabs to spaces
    const width = NotesView.extractTextBasedWidth(mockNote);
    expect(width).toBeGreaterThan(0);
    // Since "hello    world" (4 spaces for tab) is longer than "test",
    // the width should be based on the text length
    expect(width).toBeGreaterThan(100);
  });
});
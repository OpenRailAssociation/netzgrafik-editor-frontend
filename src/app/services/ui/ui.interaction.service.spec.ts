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
import {FilterService} from "./filter.service";
import {AnalyticsService} from "../analytics/analytics.service";
import {UiInteractionService} from "./ui.interaction.service";
import {EditorView} from "../../view/editor-main-view/data-views/editor.view";
import {EditorMode} from "../../view/editor-menu/editor-mode";
import {ThemeRegistration} from "../../view/themes/theme-registration";
import {EditorPropertiesViewComponent} from "../../view/editor-properties-view-component/editor-properties-view.component";
import {NetzgrafikColoringService} from "../data/netzgrafikColoring.service";
import {LoadPerlenketteService} from "../../perlenkette/service/load-perlenkette.service";

describe("UiInteractionService", () => {
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
  let uiInteractionService: UiInteractionService = null;
  let netzgrafikColoringService: NetzgrafikColoringService = null;
  let loadPerlenketteService: LoadPerlenketteService = null;

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
    analyticsService = new AnalyticsService(
      nodeService,
      trainrunSectionService,
      trainrunService,
      filterService,
    );
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
    loadPerlenketteService = new LoadPerlenketteService(
      trainrunService,
      trainrunSectionService,
      nodeService,
      filterService,
    );
    nodeService.nodes.subscribe((updatesNodes) => (nodes = updatesNodes));

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

    nodeService.nodes.subscribe((updatesNodes) => (nodes = updatesNodes));
    trainrunSectionService.trainrunSections.subscribe(
      (updatesTrainrunSections) => (trainrunSections = updatesTrainrunSections),
    );
  });

  it("checkFilterNodeLabels", () => {
    const viewboxProperties = uiInteractionService.getViewboxProperties(EditorView.svgName);
    uiInteractionService.setViewboxProperties(EditorView.svgName, viewboxProperties);
    expect(viewboxProperties.currentViewBox).toBe(null);
  });

  it("getEditorMode", () => {
    expect(uiInteractionService.getEditorMode()).toBe(EditorMode.NetzgrafikEditing);
  });

  it("setEditorMode", () => {
    uiInteractionService.setEditorMode(EditorMode.Analytics);
    expect(uiInteractionService.getEditorMode()).toBe(EditorMode.Analytics);
    uiInteractionService.setEditorMode(EditorMode.NetzgrafikEditing);
    expect(uiInteractionService.getEditorMode()).toBe(EditorMode.NetzgrafikEditing);
  });

  it("createTheme", () => {
    uiInteractionService.createTheme(
      ThemeRegistration.ThemeDefaultUx,
      EditorPropertiesViewComponent.DEFAULT_BACKGROUNDCOLOR,
      EditorPropertiesViewComponent.DEFAULT_DARK_BACKGROUNDCOLOR,
    );
    expect(uiInteractionService.getActiveTheme().themeRegistration).toBe(
      ThemeRegistration.ThemeDefaultUx,
    );
    expect(uiInteractionService.getActiveTheme().isDark).toBe(false);
    expect(uiInteractionService.getActiveTheme().backgroundColor).toBe(
      EditorPropertiesViewComponent.DEFAULT_BACKGROUNDCOLOR,
    );

    uiInteractionService.createTheme(
      ThemeRegistration.ThemeDefaultUxDark,
      EditorPropertiesViewComponent.DEFAULT_BACKGROUNDCOLOR,
      EditorPropertiesViewComponent.DEFAULT_DARK_BACKGROUNDCOLOR,
    );
    expect(uiInteractionService.getActiveTheme().themeRegistration).toBe(
      ThemeRegistration.ThemeDefaultUxDark,
    );
    expect(uiInteractionService.getActiveTheme().isDark).toBe(true);
    expect(uiInteractionService.getActiveTheme().backgroundColor).toBe(
      EditorPropertiesViewComponent.DEFAULT_DARK_BACKGROUNDCOLOR,
    );

    uiInteractionService.createTheme(
      ThemeRegistration.ThemeFachPrint,
      EditorPropertiesViewComponent.DEFAULT_BACKGROUNDCOLOR,
      EditorPropertiesViewComponent.DEFAULT_DARK_BACKGROUNDCOLOR,
    );
    expect(uiInteractionService.getActiveTheme().themeRegistration).toBe(
      ThemeRegistration.ThemeFachPrint,
    );
    expect(uiInteractionService.getActiveTheme().isDark).toBe(false);
    expect(uiInteractionService.getActiveTheme().backgroundColor).toBe(
      EditorPropertiesViewComponent.DEFAULT_BACKGROUNDCOLOR,
    );

    uiInteractionService.createTheme(
      ThemeRegistration.ThemeFach,
      EditorPropertiesViewComponent.DEFAULT_BACKGROUNDCOLOR,
      EditorPropertiesViewComponent.DEFAULT_DARK_BACKGROUNDCOLOR,
    );
    expect(uiInteractionService.getActiveTheme().themeRegistration).toBe(
      ThemeRegistration.ThemeFach,
    );
    expect(uiInteractionService.getActiveTheme().isDark).toBe(false);
    expect(uiInteractionService.getActiveTheme().backgroundColor).toBe(
      EditorPropertiesViewComponent.DEFAULT_BACKGROUNDCOLOR,
    );

    uiInteractionService.createTheme(
      ThemeRegistration.ThemeFachDark,
      EditorPropertiesViewComponent.DEFAULT_BACKGROUNDCOLOR,
      EditorPropertiesViewComponent.DEFAULT_DARK_BACKGROUNDCOLOR,
    );
    expect(uiInteractionService.getActiveTheme().themeRegistration).toBe(
      ThemeRegistration.ThemeFachDark,
    );
    expect(uiInteractionService.getActiveTheme().isDark).toBe(true);
    expect(uiInteractionService.getActiveTheme().backgroundColor).toBe(
      EditorPropertiesViewComponent.DEFAULT_DARK_BACKGROUNDCOLOR,
    );

    uiInteractionService.createTheme(
      ThemeRegistration.ThemeGray,
      EditorPropertiesViewComponent.DEFAULT_BACKGROUNDCOLOR,
      EditorPropertiesViewComponent.DEFAULT_DARK_BACKGROUNDCOLOR,
    );
    expect(uiInteractionService.getActiveTheme().themeRegistration).toBe(
      ThemeRegistration.ThemeGray,
    );
    expect(uiInteractionService.getActiveTheme().isDark).toBe(false);
    expect(uiInteractionService.getActiveTheme().backgroundColor).toBe(
      EditorPropertiesViewComponent.DEFAULT_BACKGROUNDCOLOR,
    );

    uiInteractionService.createTheme(
      ThemeRegistration.ThemeGrayDark,
      EditorPropertiesViewComponent.DEFAULT_BACKGROUNDCOLOR,
      EditorPropertiesViewComponent.DEFAULT_DARK_BACKGROUNDCOLOR,
    );
    expect(uiInteractionService.getActiveTheme().themeRegistration).toBe(
      ThemeRegistration.ThemeGrayDark,
    );
    expect(uiInteractionService.getActiveTheme().isDark).toBe(true);
    expect(uiInteractionService.getActiveTheme().backgroundColor).toBe(
      EditorPropertiesViewComponent.DEFAULT_DARK_BACKGROUNDCOLOR,
    );
  });
});

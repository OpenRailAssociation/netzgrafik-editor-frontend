import {of} from "rxjs";
import {BaseDataService} from "../../services/data/basedata.service";
import {EditorToolsViewComponent} from "./editor-tools-view.component";

describe("EditorToolsViewComponent", () => {
  let baseDataService: BaseDataService;
  let logger: {info: jasmine.Spy};

  function createComponent(): EditorToolsViewComponent {
    const versionControlService = {
      variant$: of({isDeletable: false, isWritable: true}),
    };

    return new EditorToolsViewComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      baseDataService,
      {} as any,
      logger as any,
      versionControlService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  function loadBaseDataCsv(component: EditorToolsViewComponent, csv: string): void {
    const originalFileReader = (window as any).FileReader;

    class MockFileReader {
      result: string | ArrayBuffer = "";
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

      readAsText(_file: Blob): void {
        this.result = csv;
        if (this.onload !== null) {
          this.onload.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
        }
      }
    }

    (window as any).FileReader = MockFileReader;
    try {
      component.onLoadBaseData({
        target: {
          files: [new Blob([csv], {type: "text/csv"})],
          value: "legacy.csv",
        },
      });
    } finally {
      (window as any).FileReader = originalFileReader;
    }
  }

  beforeEach(() => {
    baseDataService = new BaseDataService();
    logger = {
      info: jasmine.createSpy("info"),
    };
  });

  it("logs info when importing base data with legacy headers", () => {
    const component = createComponent();
    const legacyBaseDataCSV =
      "StationCode;StationName;Category;Region;" +
      "Fahrgastwechselzeit_IPV;StopFlag_IPV;Fahrgastwechselzeit_A;StopFlag_A;Fahrgastwechselzeit_B;StopFlag_B;" +
      "Fahrgastwechselzeit_C;StopFlag_C;Fahrgastwechselzeit_D;StopFlag_D;" +
      "ZAZ;Umsteigezeit;Labels;XCoord;YCoord;Create\n" +
      "AA;Aarau;2;Mitte;2;1;2;1;2;1;0;0;0;0;0.2;4;SBB;-209.4991625;-427.021373;1\n";

    loadBaseDataCsv(component, legacyBaseDataCSV);

    expect(logger.info).toHaveBeenCalled();
  });

  it("does not log info when importing base data with canonical headers", () => {
    const component = createComponent();
    const canonicalBaseDataCSV =
      "StationCode;StationName;Category;Region;" +
      "MinimumStopTime_IPV;PassingThroughStation_IPV;MinimumStopTime_A;PassingThroughStation_A;MinimumStopTime_B;PassingThroughStation_B;" +
      "MinimumStopTime_C;PassingThroughStation_C;MinimumStopTime_D;PassingThroughStation_D;" +
      "ZAZ (Train dispatching time);ConnectionTime;Labels;XCoord;YCoord;Create\n" +
      "AA;Aarau;2;Mitte;2;1;2;1;2;1;0;0;0;0;0.2;4;SBB;-209.4991625;-427.021373;1\n";

    loadBaseDataCsv(component, canonicalBaseDataCSV);

    expect(logger.info).not.toHaveBeenCalled();
  });
});

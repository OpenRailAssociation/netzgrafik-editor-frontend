import {parse, ParseResult} from "papaparse";
import {NodeService} from "../app/services/data/node.service";
import {TrainrunService} from "../app/services/data/trainrun.service";
import {TrainrunSectionService} from "../app/services/data/trainrunsection.service";
import {BaseDataService} from "../app/services/data/basedata.service";
import {DataService} from "../app/services/data/data.service";
import {ResourceService} from "../app/services/data/resource.service";
import {LogService} from "../app/logger/log.service";
import {LogPublishersService} from "../app/logger/log.publishers.service";
import {NoteService} from "../app/services/data/note.service";
import {LabelService} from "../app/services/data/label.service";
import {LabelGroupService} from "../app/services/data/labelgroup.service";
import {Note} from "../app/models/note.model";
import {NetzgrafikUnitTesting} from "./netzgrafik.unit.testing";
import {HaltezeitFachCategories} from "../app/data-structures/business.data.structures";
import {FilterService} from "../app/services/ui/filter.service";
import {NetzgrafikColoringService} from "../app/services/data/netzgrafikColoring.service";

describe("NodeService Test", () => {
  let notes: Note[] = null;

  let dataService: DataService = null;
  let nodeService: NodeService = null;
  let resourceService: ResourceService = null;
  let trainrunService: TrainrunService = null;
  let trainrunSectionService: TrainrunSectionService = null;
  let baseDataService: BaseDataService = null;
  let noteService: NoteService = null;
  let logService: LogService = null;
  let logPublishersService: LogPublishersService = null;
  let labelGroupService: LabelGroupService = null;
  let labelService: LabelService = null;
  let filterService: FilterService = null;
  let netzgrafikColoringService: NetzgrafikColoringService = null;

  beforeEach(() => {
    baseDataService = new BaseDataService();
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
      baseDataService,
      noteService,
      labelService,
      labelGroupService,
      filterService,
      netzgrafikColoringService,
    );

    noteService.notes.subscribe((updateNotes) => (notes = updateNotes));
  });

  it("check nodes", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(notes.length).toBe(1);

    const baseDataCSV =
      "StationCode;StationName;Category;Region;" +
      "MinimumStopTime_IPV;PassingThroughStation_IPV;MinimumStopTime_A;PassingThroughStation_A;MinimumStopTime_B;PassingThroughStation_B;" +
      "MinimumStopTime_C;PassingThroughStation_C;MinimumStopTime_D;PassingThroughStation_D;" +
      "ZAZ (Train dispatching time);ConnectionTime;Labels;XCoord;YCoord;Create\n" +
      "AD;Aadorf;4;Ost; ;1; ;1; ;1; ;1; ;1;0;0;;0;0;0\n" +
      "AA;Aarau;2;Mitte;2;0;2;0;2;0;0;1;0;1;0.2;4;SBB;-209.4991625;-427.021373;1\n" +
      "ABE;Aarberg;4;Mitte; ;1; ;1; ;1; ;1; ;1;0;0;;0;0;0\n";

    const finalResult: ParseResult = parse(baseDataCSV, {header: true, delimiter: ";"});
    baseDataService.setBaseData(finalResult.data);
    const aa = baseDataService.getBaseDataByBetriebspunktName("AA");
    expect(aa.getRegions()[0]).toBe("Mitte");
    expect(aa.getCategories()[0]).toBe("2");
    expect(aa.getCreate()).toBe(1);
    expect(aa.getBufferTime()).toBe(0.2);
    expect(aa.getPosition().getX()).toBe(-209.4991625);
    expect(aa.getPosition().getY()).toBe(-427.021373);
    expect(aa.getLabels().includes("SBB")).toBe(true);
    expect(aa.getConnectionTime()).toBe(4);
    expect(aa.getStationName()).toBe("Aarau");
    expect(aa.getBetriebspunktName()).toBe("AA");
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.IPV].haltezeit).toBe(2.2);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.A].haltezeit).toBe(2.2);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.B].haltezeit).toBe(2.2);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.C].haltezeit).toBe(0.1);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.D].haltezeit).toBe(0.1);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.Uncategorized].haltezeit).toBe(0);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.IPV].no_halt).toBe(false);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.A].no_halt).toBe(false);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.B].no_halt).toBe(false);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.C].no_halt).toBe(true);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.D].no_halt).toBe(true);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.Uncategorized].no_halt).toBe(true);
  });

  it("accepts legacy base data csv headers", () => {
    const legacyBaseDataCSV =
      "StationCode;StationName;Category;Region;" +
      "Fahrgastwechselzeit_IPV;StopFlag_IPV;Fahrgastwechselzeit_A;StopFlag_A;Fahrgastwechselzeit_B;StopFlag_B;" +
      "Fahrgastwechselzeit_C;StopFlag_C;Fahrgastwechselzeit_D;StopFlag_D;" +
      "ZAZ;Umsteigezeit;Labels;XCoord;YCoord;Create\n" +
      "AA;Aarau;2;Mitte;2;1;2;1;2;1;0;0;0;0;0.2;4;SBB;-209.4991625;-427.021373;1\n";

    const finalResult: ParseResult = parse(legacyBaseDataCSV, {header: true, delimiter: ";"});
    baseDataService.setBaseData(finalResult.data);

    const aa = baseDataService.getBaseDataByBetriebspunktName("AA");
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.IPV].no_halt).toBe(false);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.C].no_halt).toBe(true);
    expect(aa.getConnectionTime()).toBe(4);
  });

  it("defaults to halt when PassingThroughStation columns are missing", () => {
    const baseDataWithoutPassingThroughStationCSV =
      "StationCode;StationName;Category;Region;" +
      "MinimumStopTime_IPV;MinimumStopTime_A;MinimumStopTime_B;" +
      "MinimumStopTime_C;MinimumStopTime_D;" +
      "ZAZ (Train dispatching time);ConnectionTime;Labels;XCoord;YCoord;Create\n" +
      "AA;Aarau;2;Mitte;2;2;2;0;0;0.2;4;SBB;-209.4991625;-427.021373;1\n";

    const finalResult: ParseResult = parse(baseDataWithoutPassingThroughStationCSV, {
      header: true,
      delimiter: ";",
    });
    baseDataService.setBaseData(finalResult.data);

    const aa = baseDataService.getBaseDataByBetriebspunktName("AA");
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.IPV].no_halt).toBe(false);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.A].no_halt).toBe(false);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.B].no_halt).toBe(false);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.C].no_halt).toBe(false);
    expect(aa.getHaltezeiten()[HaltezeitFachCategories.D].no_halt).toBe(false);
  });
});

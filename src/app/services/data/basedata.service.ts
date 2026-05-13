import {Injectable} from "@angular/core";
import {BehaviorSubject} from "rxjs";
import {BaseData} from "../../models/basedata.model";
import {HaltezeitFachCategories} from "../../data-structures/business.data.structures";
import {Node} from "../../models/node.model";
import {MathUtils} from "../../utils/math";
import {Vec2D} from "../../utils/vec2D";

type CsvColumnGroup = {
  canonicalName: string;
  legacyName?: string;
  optional?: boolean;
};

const CSV_COLUMNS: Record<string, CsvColumnGroup> = {
  StationCode: {
    canonicalName: "StationCode",
    legacyName: "BP",
  },
  StationName: {
    canonicalName: "StationName",
    legacyName: "Bahnhof",
  },
  Category: {
    canonicalName: "Category",
    legacyName: "Kategorie",
    optional: true,
  },
  Region: {
    canonicalName: "Region",
    legacyName: "Region",
  },
  MinimumStopTime_IPV: {
    canonicalName: "MinimumStopTime_IPV",
    legacyName: "Fahrgastwechselzeit_IPV",
  },
  PassingThroughStation_IPV: {
    canonicalName: "PassingThroughStation_IPV",
    legacyName: "StopFlag_IPV",
    optional: true,
  },
  MinimumStopTime_A: {
    canonicalName: "MinimumStopTime_A",
    legacyName: "Fahrgastwechselzeit_A",
  },
  PassingThroughStation_A: {
    canonicalName: "PassingThroughStation_A",
    legacyName: "StopFlag_A",
    optional: true,
  },
  MinimumStopTime_B: {
    canonicalName: "MinimumStopTime_B",
    legacyName: "Fahrgastwechselzeit_B",
  },
  PassingThroughStation_B: {
    canonicalName: "PassingThroughStation_B",
    legacyName: "StopFlag_B",
    optional: true,
  },
  MinimumStopTime_C: {
    canonicalName: "MinimumStopTime_C",
    legacyName: "Fahrgastwechselzeit_C",
  },
  PassingThroughStation_C: {
    canonicalName: "PassingThroughStation_C",
    legacyName: "StopFlag_C",
    optional: true,
  },
  MinimumStopTime_D: {
    canonicalName: "MinimumStopTime_D",
    legacyName: "Fahrgastwechselzeit_D",
  },
  PassingThroughStation_D: {
    canonicalName: "PassingThroughStation_D",
    legacyName: "StopFlag_D",
    optional: true,
  },
  ZAZ_TrainDispatchingTime: {
    canonicalName: "ZAZ (Train dispatching time)",
    legacyName: "ZAZ",
  },
  ConnectionTime: {
    canonicalName: "ConnectionTime",
    legacyName: "Umsteigezeit",
  },
  Labels: {
    canonicalName: "Labels",
    legacyName: "Labels",
    optional: true,
  },
  XCoord: {
    canonicalName: "XCoord",
    legacyName: "X",
    optional: true,
  },
  YCoord: {
    canonicalName: "YCoord",
    legacyName: "Y",
    optional: true,
  },
  Create: {
    canonicalName: "Create",
    legacyName: "Erstellen",
    optional: true,
  },
};

@Injectable({
  providedIn: "root",
})
export class BaseDataService {
  // Description of observable data service: https://coryrylan.com/blog/angular-observable-data-services
  baseDataSubject = new BehaviorSubject<BaseData[]>([]);
  readonly baseDataObservable = this.baseDataSubject.asObservable();
  baseDataStore: {baseData: BaseData[]} = {baseData: []}; // store the data in memory
  private importUsedLegacyColumns = false;

  private static readonly REQUIRED_CSV_COLUMN_GROUPS: ReadonlyArray<CsvColumnGroup> =
    Object.values(CSV_COLUMNS);

  static parseStringArray(inLabels: string): string[] {
    if (inLabels === undefined) {
      return [];
    }
    const labels = inLabels.trim();
    if (labels === "") {
      return [];
    }
    const splittedLabels = labels.split(",", 99999);
    const trimmed = [];
    splittedLabels.forEach((s) => {
      const t = s.trim();
      if (t !== "") {
        trimmed.push(t);
      }
    });
    return trimmed;
  }

  static parseTimeAsFloat(timeAsString: string): number {
    if (timeAsString === undefined) {
      return 0;
    } else {
      timeAsString = timeAsString.replace(" ", "");
      if (timeAsString === "") {
        return 0;
      } else {
        return parseFloat(timeAsString.replace(",", "."));
      }
    }
  }

  static addZazValue(zaz: number, time: number): number {
    if (time !== 0) {
      return time + zaz;
    } else {
      return time;
    }
  }

  private static getCsvValue(row: any, canonicalName: string, legacyName?: string): any {
    if (row[canonicalName] !== undefined) {
      return row[canonicalName];
    }
    return legacyName !== undefined ? row[legacyName] : undefined;
  }

  private getCsvValueWithAliases(row: any, column: CsvColumnGroup): any {
    if (row[column.canonicalName] !== undefined) {
      return row[column.canonicalName];
    }
    if (column.legacyName && row[column.legacyName] !== undefined) {
      this.importUsedLegacyColumns = true;
      return row[column.legacyName];
    }
    return undefined;
  }

  private parseNoHaltFromCsvWithAliases(row: any, column: CsvColumnGroup): boolean {
    if (row[column.canonicalName] !== undefined) {
      return BaseDataService.parseTimeAsFloat(row[column.canonicalName]) === 1;
    }
    if (column.legacyName && row[column.legacyName] !== undefined) {
      this.importUsedLegacyColumns = true;
      return BaseDataService.parseTimeAsFloat(row[column.legacyName]) !== 1;
    }
    // Missing PassingThroughStation/StopFlag means regular stop.
    return false;
  }

  didLastImportUseLegacyColumns(): boolean {
    return this.importUsedLegacyColumns;
  }

  static validateCsvColumns(rows: any[]): void {
    if (rows.length === 0) {
      return;
    }
    const headers = Object.keys(rows[0]);
    const missing = BaseDataService.REQUIRED_CSV_COLUMN_GROUPS.filter(
      ({canonicalName, legacyName, optional}) =>
        !optional &&
        !headers.includes(canonicalName) &&
        (legacyName === undefined || !headers.includes(legacyName)),
    ).map(({canonicalName}) => canonicalName);
    const unknown = headers.filter(
      (col) =>
        !BaseDataService.REQUIRED_CSV_COLUMN_GROUPS.some(
          ({canonicalName, legacyName}) => canonicalName === col || legacyName === col,
        ),
    );
    if (missing.length > 0) {
      throw new Error(`CSV import failed: missing columns: ${missing.join(", ")}`);
    }
    if (unknown.length > 0) {
      throw new Error(`CSV import failed: unknown columns: ${unknown.join(", ")}`);
    }
  }

  setBaseData(baseDataDto) {
    this.importUsedLegacyColumns = false;
    BaseDataService.validateCsvColumns(baseDataDto);
    this.baseDataStore.baseData = baseDataDto.map((row) => {
      const trainDispatchingTime = BaseDataService.parseTimeAsFloat(
        this.getCsvValueWithAliases(row, CSV_COLUMNS.ZAZ_TrainDispatchingTime),
      );
      const haltezeitIPV = BaseDataService.addZazValue(
        trainDispatchingTime,
        BaseDataService.parseTimeAsFloat(
          this.getCsvValueWithAliases(row, CSV_COLUMNS.MinimumStopTime_IPV),
        ),
      );
      const haltezeitA = BaseDataService.addZazValue(
        trainDispatchingTime,
        BaseDataService.parseTimeAsFloat(
          this.getCsvValueWithAliases(row, CSV_COLUMNS.MinimumStopTime_A),
        ),
      );
      const haltezeitB = BaseDataService.addZazValue(
        trainDispatchingTime,
        BaseDataService.parseTimeAsFloat(
          this.getCsvValueWithAliases(row, CSV_COLUMNS.MinimumStopTime_B),
        ),
      );
      const haltezeitC = BaseDataService.addZazValue(
        trainDispatchingTime,
        BaseDataService.parseTimeAsFloat(
          this.getCsvValueWithAliases(row, CSV_COLUMNS.MinimumStopTime_C),
        ),
      );
      const haltezeitD = BaseDataService.addZazValue(
        trainDispatchingTime,
        BaseDataService.parseTimeAsFloat(
          this.getCsvValueWithAliases(row, CSV_COLUMNS.MinimumStopTime_D),
        ),
      );

      // PassingThroughStation: 1 = pass-through (no_halt = true), 0 = stop.
      // Legacy StopFlag imports remain supported with their original inverse semantics.
      const no_halt_IPV = this.parseNoHaltFromCsvWithAliases(
        row,
        CSV_COLUMNS.PassingThroughStation_IPV,
      );
      const no_halt_A = this.parseNoHaltFromCsvWithAliases(
        row,
        CSV_COLUMNS.PassingThroughStation_A,
      );
      const no_halt_B = this.parseNoHaltFromCsvWithAliases(
        row,
        CSV_COLUMNS.PassingThroughStation_B,
      );
      const no_halt_C = this.parseNoHaltFromCsvWithAliases(
        row,
        CSV_COLUMNS.PassingThroughStation_C,
      );
      const no_halt_D = this.parseNoHaltFromCsvWithAliases(
        row,
        CSV_COLUMNS.PassingThroughStation_D,
      );

      const connectionTime = BaseDataService.parseTimeAsFloat(
        this.getCsvValueWithAliases(row, CSV_COLUMNS.ConnectionTime),
      );
      const regions: string[] = BaseDataService.parseStringArray(
        this.getCsvValueWithAliases(row, CSV_COLUMNS.Region),
      );
      const filterableLabels: string[] = BaseDataService.parseStringArray(
        this.getCsvValueWithAliases(row, CSV_COLUMNS.Labels),
      );
      const categories: string[] = BaseDataService.parseStringArray(
        this.getCsvValueWithAliases(row, CSV_COLUMNS.Category),
      );
      const stationName: string = this.getCsvValueWithAliases(row, CSV_COLUMNS.StationName);
      const create: number = BaseDataService.parseTimeAsFloat(
        this.getCsvValueWithAliases(row, CSV_COLUMNS.Create),
      );
      const posX: string = this.getCsvValueWithAliases(row, CSV_COLUMNS.XCoord);
      const posY: string = this.getCsvValueWithAliases(row, CSV_COLUMNS.YCoord);
      let position: Vec2D;
      if (posX !== undefined && posY !== undefined && posX !== "" && posY !== "") {
        position = new Vec2D(+posX, +posY);
      }

      return new BaseData(
        this.getCsvValueWithAliases(row, CSV_COLUMNS.StationCode),
        {
          [HaltezeitFachCategories.IPV]: {
            haltezeit: MathUtils.roundAndForceValueGreaterEqualOne(10 * haltezeitIPV) / 10.0,
            no_halt: no_halt_IPV,
          },
          [HaltezeitFachCategories.A]: {
            haltezeit: MathUtils.roundAndForceValueGreaterEqualOne(10 * haltezeitA) / 10.0,
            no_halt: no_halt_A,
          },
          [HaltezeitFachCategories.B]: {
            haltezeit: MathUtils.roundAndForceValueGreaterEqualOne(10 * haltezeitB) / 10.0,
            no_halt: no_halt_B,
          },
          [HaltezeitFachCategories.C]: {
            haltezeit: MathUtils.roundAndForceValueGreaterEqualOne(10 * haltezeitC) / 10.0,
            no_halt: no_halt_C,
          },
          [HaltezeitFachCategories.D]: {
            haltezeit: MathUtils.roundAndForceValueGreaterEqualOne(10 * haltezeitD) / 10.0,
            no_halt: no_halt_D,
          },
          [HaltezeitFachCategories.Uncategorized]: {
            haltezeit: 0,
            no_halt: true,
          },
        },
        trainDispatchingTime,
        connectionTime === 0 ? Node.getDefaultConnectionTime() : connectionTime,
        regions,
        filterableLabels,
        categories,
        stationName,
        position,
        create,
      );
    });

    this.baseDataSubject.next(Object.assign({}, this.baseDataStore).baseData);
  }

  getBaseDataByBetriebspunktName(bpName: string): BaseData {
    const baseData = this.baseDataStore.baseData.find(
      (std) => std.getBetriebspunktName() === bpName,
    );
    if (baseData === undefined) {
      return null;
    }
    return baseData;
  }
}

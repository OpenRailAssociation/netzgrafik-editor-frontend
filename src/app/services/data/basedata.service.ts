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

@Injectable({
  providedIn: "root",
})
export class BaseDataService {
  // Description of observable data service: https://coryrylan.com/blog/angular-observable-data-services
  baseDataSubject = new BehaviorSubject<BaseData[]>([]);
  readonly baseDataObservable = this.baseDataSubject.asObservable();
  baseDataStore: {baseData: BaseData[]} = {baseData: []}; // store the data in memory

  private static readonly REQUIRED_CSV_COLUMN_GROUPS: ReadonlyArray<CsvColumnGroup> = [
    {canonicalName: "StationCode"},
    {canonicalName: "StationName"},
    {canonicalName: "Category"},
    {canonicalName: "Region"},
    {canonicalName: "MinimumStopTime_IPV", legacyName: "DwellTime_IPV"},
    {canonicalName: "PassingThroughStation_IPV", legacyName: "StopFlag_IPV", optional: true},
    {canonicalName: "MinimumStopTime_A", legacyName: "DwellTime_A"},
    {canonicalName: "PassingThroughStation_A", legacyName: "StopFlag_A", optional: true},
    {canonicalName: "MinimumStopTime_B", legacyName: "DwellTime_B"},
    {canonicalName: "PassingThroughStation_B", legacyName: "StopFlag_B", optional: true},
    {canonicalName: "MinimumStopTime_C", legacyName: "DwellTime_C"},
    {canonicalName: "PassingThroughStation_C", legacyName: "StopFlag_C", optional: true},
    {canonicalName: "MinimumStopTime_D", legacyName: "DwellTime_D"},
    {canonicalName: "PassingThroughStation_D", legacyName: "StopFlag_D", optional: true},
    {canonicalName: "ZAZ (Train dispatching time)", legacyName: "BufferTime"},
    {canonicalName: "ConnectionTime", legacyName: "TransferTime"},
    {canonicalName: "Labels"},
    {canonicalName: "XCoord"},
    {canonicalName: "YCoord"},
    {canonicalName: "Create"},
  ];

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

  private static parseNoHaltFromCsv(row: any, canonicalName: string, legacyName: string): boolean {
    if (row[canonicalName] !== undefined) {
      return BaseDataService.parseTimeAsFloat(row[canonicalName]) === 1;
    }
    if (row[legacyName] !== undefined) {
      return BaseDataService.parseTimeAsFloat(row[legacyName]) !== 1;
    }
    // Missing PassingThroughStation/StopFlag means regular stop.
    return false;
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
    BaseDataService.validateCsvColumns(baseDataDto);
    this.baseDataStore.baseData = baseDataDto.map((row) => {
      const trainDispatchingTime = BaseDataService.parseTimeAsFloat(
        BaseDataService.getCsvValue(row, "ZAZ (Train dispatching time)", "BufferTime"),
      );
      const haltezeitIPV = BaseDataService.addZazValue(
        trainDispatchingTime,
        BaseDataService.parseTimeAsFloat(
          BaseDataService.getCsvValue(row, "MinimumStopTime_IPV", "DwellTime_IPV"),
        ),
      );
      const haltezeitA = BaseDataService.addZazValue(
        trainDispatchingTime,
        BaseDataService.parseTimeAsFloat(
          BaseDataService.getCsvValue(row, "MinimumStopTime_A", "DwellTime_A"),
        ),
      );
      const haltezeitB = BaseDataService.addZazValue(
        trainDispatchingTime,
        BaseDataService.parseTimeAsFloat(
          BaseDataService.getCsvValue(row, "MinimumStopTime_B", "DwellTime_B"),
        ),
      );
      const haltezeitC = BaseDataService.addZazValue(
        trainDispatchingTime,
        BaseDataService.parseTimeAsFloat(
          BaseDataService.getCsvValue(row, "MinimumStopTime_C", "DwellTime_C"),
        ),
      );
      const haltezeitD = BaseDataService.addZazValue(
        trainDispatchingTime,
        BaseDataService.parseTimeAsFloat(
          BaseDataService.getCsvValue(row, "MinimumStopTime_D", "DwellTime_D"),
        ),
      );

      // PassingThroughStation: 1 = pass-through (no_halt = true), 0 = stop.
      // Legacy StopFlag imports remain supported with their original inverse semantics.
      const no_halt_IPV = BaseDataService.parseNoHaltFromCsv(
        row,
        "PassingThroughStation_IPV",
        "StopFlag_IPV",
      );
      const no_halt_A = BaseDataService.parseNoHaltFromCsv(
        row,
        "PassingThroughStation_A",
        "StopFlag_A",
      );
      const no_halt_B = BaseDataService.parseNoHaltFromCsv(
        row,
        "PassingThroughStation_B",
        "StopFlag_B",
      );
      const no_halt_C = BaseDataService.parseNoHaltFromCsv(
        row,
        "PassingThroughStation_C",
        "StopFlag_C",
      );
      const no_halt_D = BaseDataService.parseNoHaltFromCsv(
        row,
        "PassingThroughStation_D",
        "StopFlag_D",
      );

      const connectionTime = BaseDataService.parseTimeAsFloat(
        BaseDataService.getCsvValue(row, "ConnectionTime", "TransferTime"),
      );
      const regions: string[] = BaseDataService.parseStringArray(row.Region);
      const filterableLabels: string[] = BaseDataService.parseStringArray(row.Labels);
      const kategorien: string[] = BaseDataService.parseStringArray(row.Category);
      const bahnhof: string = row.StationName;
      const create: number = BaseDataService.parseTimeAsFloat(row.Create);
      const posX: string = row.XCoord;
      const posY: string = row.YCoord;
      let position: Vec2D;
      if (posX !== undefined && posY !== undefined && posX !== "" && posY !== "") {
        position = new Vec2D(+posX, +posY);
      }

      return new BaseData(
        row.StationCode,
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
        kategorien,
        bahnhof,
        position,
        create,
      );
    });

    this.baseDataSubject.next(Object.assign({}, this.baseDataStore).baseData);
  }

  getStationCodeBaseData(bpName: string): BaseData {
    const baseData = this.baseDataStore.baseData.find((std) => std.getStationCode() === bpName);
    if (baseData === undefined) {
      return null;
    }
    return baseData;
  }
}

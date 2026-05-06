import {Injectable} from "@angular/core";
import {BehaviorSubject} from "rxjs";
import {BaseData} from "../../models/basedata.model";
import {HaltezeitFachCategories} from "../../data-structures/business.data.structures";
import {Node} from "../../models/node.model";
import {MathUtils} from "../../utils/math";
import {Vec2D} from "../../utils/vec2D";

@Injectable({
  providedIn: "root",
})
export class BaseDataService {
  // Description of observable data service: https://coryrylan.com/blog/angular-observable-data-services
  baseDataSubject = new BehaviorSubject<BaseData[]>([]);
  readonly baseDataObservable = this.baseDataSubject.asObservable();
  baseDataStore: {baseData: BaseData[]} = {baseData: []}; // store the data in memory

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

  private static readonly REQUIRED_CSV_COLUMNS = [
    "StationCode",
    "StationName",
    "Category",
    "Region",
    "DwellTime_IPV",
    "StopFlag_IPV",
    "DwellTime_A",
    "StopFlag_A",
    "DwellTime_B",
    "StopFlag_B",
    "DwellTime_C",
    "StopFlag_C",
    "DwellTime_D",
    "StopFlag_D",
    "BufferTime",
    "TransferTime",
    "Labels",
    "XCoord",
    "YCoord",
    "Create",
  ];

  static validateCsvColumns(rows: any[]): void {
    if (rows.length === 0) {
      return;
    }
    const headers = Object.keys(rows[0]);
    const missing = BaseDataService.REQUIRED_CSV_COLUMNS.filter((col) => !headers.includes(col));
    const unknown = headers.filter((col) => !BaseDataService.REQUIRED_CSV_COLUMNS.includes(col));
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
      const bufferTime = BaseDataService.parseTimeAsFloat(row.BufferTime);
      const haltezeitIPV = BaseDataService.addZazValue(
        bufferTime,
        BaseDataService.parseTimeAsFloat(row.DwellTime_IPV),
      );
      const haltezeitA = BaseDataService.addZazValue(
        bufferTime,
        BaseDataService.parseTimeAsFloat(row.DwellTime_A),
      );
      const haltezeitB = BaseDataService.addZazValue(
        bufferTime,
        BaseDataService.parseTimeAsFloat(row.DwellTime_B),
      );
      const haltezeitC = BaseDataService.addZazValue(
        bufferTime,
        BaseDataService.parseTimeAsFloat(row.DwellTime_C),
      );
      const haltezeitD = BaseDataService.addZazValue(
        bufferTime,
        BaseDataService.parseTimeAsFloat(row.DwellTime_D),
      );

      // StopFlag: 1 = stop (no_halt = false), 0 = no stop (no_halt = true)
      const no_halt_IPV = BaseDataService.parseTimeAsFloat(row.StopFlag_IPV) !== 1;
      const no_halt_A = BaseDataService.parseTimeAsFloat(row.StopFlag_A) !== 1;
      const no_halt_B = BaseDataService.parseTimeAsFloat(row.StopFlag_B) !== 1;
      const no_halt_C = BaseDataService.parseTimeAsFloat(row.StopFlag_C) !== 1;
      const no_halt_D = BaseDataService.parseTimeAsFloat(row.StopFlag_D) !== 1;

      const connectionTime = BaseDataService.parseTimeAsFloat(row.TransferTime);
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
        bufferTime,
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

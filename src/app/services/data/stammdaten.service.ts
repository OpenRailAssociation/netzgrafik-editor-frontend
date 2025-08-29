import {Injectable} from "@angular/core";
import {BehaviorSubject} from "rxjs";
import {Stammdaten} from "../../models/stammdaten.model";
import {HaltezeitFachCategories} from "../../data-structures/business.data.structures";
import {Node} from "../../models/node.model";
import {MathUtils} from "../../utils/math";
import {Vec2D} from "../../utils/vec2D";

@Injectable({
  providedIn: "root",
})
export class StammdatenService {
  // Description of observable data service: https://coryrylan.com/blog/angular-observable-data-services
  stammdatenSubject = new BehaviorSubject<Stammdaten[]>([]);
  readonly stammdatenObservable = this.stammdatenSubject.asObservable();
  stammdatenStore: {stammdaten: Stammdaten[]} = {stammdaten: []}; // store the data in memory

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
      return MathUtils.roundAndForceValueGreaterEqualOne(time + zaz);
    } else {
      return time;
    }
  }

  setStammdaten(stammdatenDto) {
    this.stammdatenStore.stammdaten = stammdatenDto.map((stammdatenBP) => {
      const zaz = StammdatenService.parseTimeAsFloat(stammdatenBP.ZAZ);
      const haltezeitIPV = StammdatenService.addZazValue(
        zaz,
        StammdatenService.parseTimeAsFloat(stammdatenBP.Fahrgastwechselzeit_IPV),
      );
      const haltezeitA = StammdatenService.addZazValue(
        zaz,
        StammdatenService.parseTimeAsFloat(stammdatenBP.Fahrgastwechselzeit_A),
      );
      const haltezeitB = StammdatenService.addZazValue(
        zaz,
        StammdatenService.parseTimeAsFloat(stammdatenBP.Fahrgastwechselzeit_B),
      );
      const haltezeitC = StammdatenService.addZazValue(
        zaz,
        StammdatenService.parseTimeAsFloat(stammdatenBP.Fahrgastwechselzeit_C),
      );
      const haltezeitD = StammdatenService.addZazValue(
        zaz,
        StammdatenService.parseTimeAsFloat(stammdatenBP.Fahrgastwechselzeit_D),
      );
      const connectionTime = StammdatenService.parseTimeAsFloat(stammdatenBP.Umsteigezeit);
      const regions: string[] = StammdatenService.parseStringArray(stammdatenBP.Region);
      const filterableLabels: string[] = StammdatenService.parseStringArray(stammdatenBP.Labels);
      const kategorien: string[] = StammdatenService.parseStringArray(stammdatenBP.Kategorie);
      const bahnhof: string = stammdatenBP.Bahnhof;
      const erstellen: string = stammdatenBP.Erstellen;
      const posX: string = stammdatenBP.X;
      const posY: string = stammdatenBP.Y;
      let position: Vec2D;
      if (posX !== undefined && posY !== undefined && posX !== "" && posY !== "") {
        position = new Vec2D(+posX, +posY);
      }

      return new Stammdaten(
        stammdatenBP.BP,
        {
          [HaltezeitFachCategories.IPV]: {
            haltezeit: MathUtils.roundAndForceValueGreaterEqualOne(haltezeitIPV),
            no_halt: haltezeitIPV === 0,
          },
          [HaltezeitFachCategories.A]: {
            haltezeit: MathUtils.roundAndForceValueGreaterEqualOne(haltezeitA),
            no_halt: haltezeitA === 0,
          },
          [HaltezeitFachCategories.B]: {
            haltezeit: MathUtils.roundAndForceValueGreaterEqualOne(haltezeitB),
            no_halt: haltezeitB === 0,
          },
          [HaltezeitFachCategories.C]: {
            haltezeit: MathUtils.roundAndForceValueGreaterEqualOne(haltezeitC),
            no_halt: haltezeitC === 0,
          },
          [HaltezeitFachCategories.D]: {
            haltezeit: MathUtils.roundAndForceValueGreaterEqualOne(haltezeitD),
            no_halt: haltezeitD === 0,
          },
          [HaltezeitFachCategories.Uncategorized]: {
            haltezeit: 0,
            no_halt: true,
          },
        },
        zaz,
        connectionTime === 0 ? Node.getDefaultConnectionTime() : connectionTime,
        regions,
        filterableLabels,
        kategorien,
        bahnhof,
        position,
        erstellen,
      );
    });

    this.stammdatenSubject.next(Object.assign({}, this.stammdatenStore).stammdaten);
  }

  getBPStammdaten(bpName: string): Stammdaten {
    const stammdaten = this.stammdatenStore.stammdaten.find((std) => std.getBP() === bpName);
    if (stammdaten === undefined) {
      return null;
    }
    return stammdaten;
  }
}

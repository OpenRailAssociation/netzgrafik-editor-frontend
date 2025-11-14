import {NetzgrafikDto} from "../../data-structures/business.data.structures";
import netzgrafikLegacy2NodesJson from "./2-nodes-legacy.json";
import netzgrafikLegacy3NodesJson from "./3-nodes-legacy.json";

export class NetzgrafikTestData {
  // old exported json data, still using numberOfStops trainrunSections format
  static getLegacyNetzgrafik2Nodes(): NetzgrafikDto {
    return JSON.parse(JSON.stringify(netzgrafikLegacy2NodesJson)) as NetzgrafikDto;
  }
  static getLegacyNetzgrafik3Nodes(): NetzgrafikDto {
    return JSON.parse(JSON.stringify(netzgrafikLegacy3NodesJson)) as NetzgrafikDto;
  }
}

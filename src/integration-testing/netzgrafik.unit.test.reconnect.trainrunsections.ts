import {NetzgrafikDto} from "../app/data-structures/business.data.structures";
import testReconnectTrainrunSectionNetzgrafik from "./test-data/testReconnectTrainrunSectionNetzgrafik.json";

export class NetzgrafikUnitTestingReconnectTrainrunSection {
  static getUnitTestReconnectTrainrunSectionNetzgrafik(): NetzgrafikDto {
    return JSON.parse(JSON.stringify(testReconnectTrainrunSectionNetzgrafik)) as NetzgrafikDto;
  }
}

import {NetzgrafikDto} from "../app/data-structures/business.data.structures";
import testNetzgrafikOdMatrix from "./test-data/testNetzgrafikOdMatrix.json";

export class NetzgrafikUnitTestingOdMatrix {
  static getUnitTestNetzgrafik(): NetzgrafikDto {
    return JSON.parse(JSON.stringify(testNetzgrafikOdMatrix)) as NetzgrafikDto;
  }
}

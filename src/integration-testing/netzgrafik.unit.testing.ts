import {NetzgrafikDto} from "../app/data-structures/business.data.structures";
import testNetzgrafik from "./test-data/testNetzgrafik.json";

export class NetzgrafikUnitTesting {
  static getUnitTestNetzgrafik(): NetzgrafikDto {
    return JSON.parse(JSON.stringify(testNetzgrafik)) as NetzgrafikDto;
  }
}

import {NetzgrafikDto} from "../app/data-structures/business.data.structures";
import testTransitionNetzgrafik from "./test-data/testTransitionNetzgrafik.json";

export class NetzgrafikUnitTestingTransition {
  static getUnitTestTransitionNetzgrafik(): NetzgrafikDto {
    return JSON.parse(JSON.stringify(testTransitionNetzgrafik)) as NetzgrafikDto;
  }
}

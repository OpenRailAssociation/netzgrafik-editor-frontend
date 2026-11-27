import {NetzgrafikDto} from "../app/data-structures/business.data.structures";
import testTrackEstimator from "./test-data/testNetzugrafikTrackEstimator.json";

export class NetzgrafikTrackEstimatorTesting {
  static getUnitTestNetzgrafik(): NetzgrafikDto {
    return JSON.parse(JSON.stringify(testTrackEstimator)) as NetzgrafikDto;
  }
}

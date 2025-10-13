export class TimeUtils {
  public static convertTime2HHMMSS(timeSecondsAfterMidnight: number): string {
    const hours = Math.floor(timeSecondsAfterMidnight / 3600);
    const minutes = Math.floor(timeSecondsAfterMidnight / 60) % 60;
    const seconds = timeSecondsAfterMidnight % 60;

    const retVal: string = [hours, minutes, seconds].map((v) => (v < 10 ? "0" + v : v)).join(":");
    return retVal;
  }
}

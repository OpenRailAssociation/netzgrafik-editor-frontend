export class TimeFormatter {
  public static formatHHMM(inTime: number) {
    let time = inTime / 60;
    if (time < 0) {
      time = Math.abs(time) % (24 * 60);
      time = 24 * 60 - time;
    }
    time = time % (24 * 60);

    const min = Math.floor(time % 60);
    const hour = Math.floor(time / 60);

    if (hour === undefined) {
      return TimeFormatter.formatLeadingZeros(hour);
    }
    return TimeFormatter.formatLeadingZeros(hour) + ":" + TimeFormatter.formatLeadingZeros(min);
  }

  private static formatLeadingZeros(data: number) {
    let text = "";
    if (data < 10) {
      text = text + "0" + data;
    }
    if (data >= 10) {
      text = text + data;
    }
    return text;
  }
}

import {ThemeRegistration} from "./theme-registration";
import {StaticDomTags} from "../editor-main-view/data-views/static.dom.tags";

export class ThemeBase {
  themeRegistration: ThemeRegistration;
  backgroundColor: string;
  backgroundStreckengraphikColor: string;
  isDark = false;

  constructor(
    themeReference: ThemeRegistration,
    backgroundColor = "whitesmoke",
    backgroundStreckengraphikColor = "white",
    isDark = false,
  ) {
    this.themeRegistration = themeReference;
    this.backgroundColor = backgroundColor;
    this.backgroundStreckengraphikColor = backgroundStreckengraphikColor;
    this.isDark = isDark;
    ThemeBase.setColors(ThemeBase.getGlobalColors(backgroundColor, backgroundStreckengraphikColor));
  }

  static getGlobalColors(
    backgroundColor = "whitesmoke",
    backgroundStreckengraphikColor = "white",
  ): string[] {
    return [
      "COLOR_Default: rgb(118, 118, 118)",
      "COLOR_Focus: rgb(0, 0, 0)",
      "COLOR_Muted: rgb(220, 220, 220)",
      "COLOR_Warning: rgb(253, 207, 73)",

      "COLOR_Warning_BACKGROUND: #fff7eb",
      "COLOR_BACKGROUND: " + backgroundColor,
      "COLOR_STRECKENGRAPHIK_BACKGROUND: " + backgroundStreckengraphikColor,
      "COLOR_MUTED_SILVER: #DCDCDC",

      "COLOR_TRAINRUN_SECTION: rgb(192, 192, 192)",
      "COLOR_TRAINRUN_SECTION_HOVER: rgb(128, 128, 128)",

      "COLOR_TRAINRUN_TRANSITION: rgb(192, 192, 192)",
      "COLOR_TRAINRUN_TRANSITION_HOVER: rgb(128, 128, 128)",
    ];
  }

  static setUIColors(colorStrings: string[]) {
    ThemeBase.setColors(colorStrings, StaticDomTags.TAG_UI_DIALOG + "_");
  }

  static setRenderingColors(colorStrings: string[]) {
    ThemeBase.setColors(colorStrings);
  }

  private static setColors(colorStrings: string[], colorPrefix = "") {
    for (const colorString of colorStrings) {
      const keyValue = colorString.split(":");
      document.documentElement.style.setProperty("--" + colorPrefix + keyValue[0], keyValue[1]);
    }
  }
}

import {ThemeBase} from "./theme-base";
import {ThemeFach} from "./theme-fach";
import {ThemeRegistration} from "./theme-registration";
import {StaticDomTags} from "../editor-main-view/data-views/static.dom.tags";

export class ThemeFachPrint extends ThemeBase {
  constructor(backgroundColor = "whitesmoke", backgroundStreckengraphikColor = "white") {
    super(ThemeRegistration.ThemeFachPrint, backgroundColor, backgroundStreckengraphikColor, false);
    ThemeBase.setUIColors(ThemeFach.getThemeFachColors());
    ThemeBase.setRenderingColors(ThemeFachPrint.getThemeFachPrintColors());
  }

  static getThemeFachPrintColors(): string[] {
    return [
      "NODE_COLOR_BACKGROUND: #dedede",
      "NODE_COLOR: #dedede",
      "NODE_DOCKABLE: #ffffff",
      "NODE_DOCKABLE_HOVER: #f5f5f5",
      "NODE_TEXT_COLOR: black",
      "NODE_TEXT_FOCUS: black",

      "CONNECTION_COLOR: #767676",
      "CONNECTION_COLOR_HOVER: #767676",
      "CONNECTION_COLOR_WARNING: #767676",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_NORMAL: #2c2c2c",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_NORMAL_FOCUS: #000000",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_NORMAL_MUTED: #9b9b9b",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_NORMAL_RELATED: #6f6f6f",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_EC: #EC0000",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_EC_FOCUS: #ff0000",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_EC_MUTED: #ffa2a2",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_EC_RELATED: #ff5c5c",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IC: #EC0000",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IC_FOCUS: #ff0000",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IC_MUTED: #ffa2a2",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IC_RELATED: #ff5c5c",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IR: #EC0000",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IR_FOCUS: #ff0000",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IR_MUTED: #ffa2a2",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IR_RELATED: #ff5c5c",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_RE: #2e972e",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_RE_FOCUS: #008000",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_RE_MUTED: #a2d0a2",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_RE_RELATED: #5cae5c",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_S: #2c2c2c",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_S_FOCUS: #000000",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_S_MUTED: #9b9b9b",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_S_RELATED: #aaaaaa",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_GEX: #781bd3",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_GEX_FOCUS: #781bd3",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_GEX_MUTED: #d7bbf3",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_GEX_RELATED: #cb9cfb",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_G: #4545ff",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_G_FOCUS: #0000d0",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_G_MUTED: #8e8eff",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_G_RELATED: #aaaaea",

      "COLOR_GRAYEDOUT: white",
      "COLOR_TRANSITION_GRAYEDOUT: whitesmoke",

      "COLOR_STRECKENGRAPHIK_LINE_GRID_X: darkgray",
      "COLOR_STRECKENGRAPHIK_LINE_GRID_Y: darkgray",

      "COLOR_Edit: #eb00ff",
    ];
  }
}

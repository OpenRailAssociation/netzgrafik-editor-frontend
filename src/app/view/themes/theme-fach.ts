import {ThemeBase} from "./theme-base";
import {ThemeRegistration} from "./theme-registration";
import {StaticDomTags} from "../editor-main-view/data-views/static.dom.tags";

export class ThemeFach extends ThemeBase {
  constructor(backgroundColor = "whitesmoke", backgroundStreckengraphikColor = "white") {
    super(ThemeRegistration.ThemeFach, backgroundColor, backgroundStreckengraphikColor, false);
    ThemeBase.setUIColors(ThemeFach.getThemeFachColors());
    ThemeBase.setRenderingColors(ThemeFach.getThemeFachColors());
  }

  static getThemeFachColors(): string[] {
    return [
      "NODE_COLOR_BACKGROUND: whitesmoke",
      "NODE_COLOR: white",
      "NODE_DOCKABLE: white",
      "NODE_DOCKABLE_HOVER: white",
      "NODE_TEXT_COLOR: rgb(118, 118, 118)",
      "NODE_TEXT_FOCUS: rgb(0, 0, 0)",

      "CONNECTION_COLOR: #767676",
      "CONNECTION_COLOR_HOVER: #767676",
      "CONNECTION_COLOR_WARNING: #767676",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_NORMAL: #767676",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_NORMAL_FOCUS: #9c9a9a",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_NORMAL_MUTED: #DCDCDC",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_NORMAL_RELATED: #767676",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_EC: #f05b40",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_EC_FOCUS: #ec1e24",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_EC_MUTED: #fcc0c0",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_EC_RELATED: #f58467",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IC: #f05b40",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IC_FOCUS: #ec1e24",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IC_MUTED: #fcc0c0",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IC_RELATED: #f58467",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IR: #f05b40",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IR_FOCUS: #ec1e24",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IR_MUTED: #fcc0c0",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IR_RELATED: #f58467",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_RE: #13ab13",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_RE_FOCUS: #0f9d0f",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_RE_MUTED: #c9d9c9",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_RE_RELATED: #00ce00",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_S: #565353",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_S_FOCUS: #3c3c3c",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_S_MUTED: #cccbcb",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_S_RELATED: #797979",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_GEX: #756baf",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_GEX_FOCUS: #5b52a2",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_GEX_MUTED: #d2cee7",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_GEX_RELATED: #8f87bf",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_G: #6783c1",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_G_FOCUS: #436fb5",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_G_MUTED: #d1d6ec",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_G_RELATED: #879acd",

      "COLOR_GRAYEDOUT: white",
      "COLOR_TRANSITION_GRAYEDOUT: whitesmoke",

      "COLOR_STRECKENGRAPHIK_LINE_GRID_X: darkgray",
      "COLOR_STRECKENGRAPHIK_LINE_GRID_Y: darkgray",

      "COLOR_Edit: #f939e9",
    ];
  }
}

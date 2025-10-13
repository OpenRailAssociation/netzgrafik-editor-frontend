import {ThemeBase} from "./theme-base";
import {ThemeRegistration} from "./theme-registration";
import {StaticDomTags} from "../editor-main-view/data-views/static.dom.tags";

export class ThemeDefaultUx extends ThemeBase {
  constructor(backgroundColor = "white", backgroundStreckengraphikColor = "white") {
    super(ThemeRegistration.ThemeDefaultUx, backgroundColor, backgroundStreckengraphikColor, false);
    ThemeBase.setUIColors(ThemeDefaultUx.getThemeDefaultUxColors());
    ThemeBase.setRenderingColors(ThemeDefaultUx.getThemeDefaultUxColors());
  }

  static getThemeDefaultUxColors(): string[] {
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
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_NORMAL_FOCUS: #000000",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_NORMAL_MUTED: #DCDCDC",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_NORMAL_RELATED: #767676",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_EC: #B38BBD",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_EC_FOCUS: #6F2282",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_EC_MUTED: #E1D2E5",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_EC_RELATED: #B38BBD",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IC: #B38BBD",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IC_FOCUS: #6F2282",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IC_MUTED: #E1D2E5",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IC_RELATED: #B38BBD",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IR: #DAA4C4",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IR_FOCUS: #BA5290",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IR_MUTED: #F0DBE8",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_IR_RELATED: #DAA4C4",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_RE: #9193BA",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_RE_FOCUS: #2D327D",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_RE_MUTED: #D4D5E4",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_RE_RELATED: #9193BA",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_S: #79B8E1",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_S_FOCUS: #0079C7",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_S_MUTED: #CBE3F3",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_S_RELATED: #79B8E1",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_GEX: #767676",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_GEX_FOCUS: #000000",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_GEX_MUTED: #DCDCDC",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_GEX_RELATED: #DCDCDC",

      StaticDomTags.PREFIX_COLOR_VARIABLE + "_G: #767676",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_G_FOCUS: #000000",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_G_MUTED: #DCDCDC",
      StaticDomTags.PREFIX_COLOR_VARIABLE + "_G_RELATED: #DCDCDC",

      "COLOR_GRAYEDOUT: white",
      "COLOR_TRANSITION_GRAYEDOUT: whitesmoke",

      "COLOR_STRECKENGRAPHIK_LINE_GRID_X: darkgray",
      "COLOR_STRECKENGRAPHIK_LINE_GRID_Y: darkgray",

      "COLOR_Edit: rgb(47, 210, 204)",
    ];
  }
}

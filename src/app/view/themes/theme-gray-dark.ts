import * as d3 from "d3";
import {ThemeBase} from "./theme-base";
import {ThemeGray} from "./theme-gray";
import {ThemeRegistration} from "./theme-registration";
import {StaticDomTags} from "../editor-main-view/data-views/static.dom.tags";

export class ThemeGrayDark extends ThemeBase {
  constructor(
    backgroundColor = "var(--sbb-header-lean-background-color)",
    backgroundStreckengraphikColor = "var(--sbb-header-lean-background-color)",
  ) {
    super(ThemeRegistration.ThemeGrayDark, backgroundColor, backgroundStreckengraphikColor, true);
    ThemeBase.setUIColors(ThemeGray.getThemeGrayColors());
    ThemeBase.setRenderingColors(ThemeGrayDark.getThemeGrayDarkColors());
  }

  static getThemeGrayDarkColors(): string[] {
    const normal = 40;
    const focus = 0;
    const muted = 0;
    const related = 20;

    return [
      "NODE_COLOR_BACKGROUND: #101010",
      "NODE_COLOR: #363636",
      "NODE_DOCKABLE: #060606",
      "NODE_DOCKABLE_HOVER: #060606",
      "NODE_TEXT_COLOR: #767676",
      "NODE_TEXT_FOCUS: whitesmoke",

      "CONNECTION_COLOR: #959595",
      "CONNECTION_COLOR_HOVER: #959595",
      "CONNECTION_COLOR_WARNING: #959595",

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_NORMAL: " +
        d3.scaleLinear().domain([0, 100]).range(["#666666", "#FFFFFF"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_NORMAL_FOCUS: " +
        d3.scaleLinear().domain([0, 100]).range(["#666666", "#FFFFFF"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_NORMAL_MUTED: " +
        d3.scaleLinear().domain([0, 100]).range(["#333333", "#FFFFFF"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_NORMAL_RELATED: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#FFFFFF"])(related),

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_EC: " +
        d3.scaleLinear().domain([0, 100]).range(["#cccccc", "#FFFFFF"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_EC_FOCUS: " +
        d3.scaleLinear().domain([0, 100]).range(["#cccccc", "#FFFFFF"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_EC_MUTED: " +
        d3.scaleLinear().domain([0, 100]).range(["#333333", "#FFFFFF"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_EC_RELATED:" +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#FFFFFF"])(related),

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IC: " +
        d3.scaleLinear().domain([0, 100]).range(["#cccccc", "#FFFFFF"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IC_FOCUS: " +
        d3.scaleLinear().domain([0, 100]).range(["#cccccc", "#FFFFFF"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IC_MUTED: " +
        d3.scaleLinear().domain([0, 100]).range(["#333333", "#FFFFFF"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IC_RELATED: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#FFFFFF"])(related),

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IR:" +
        d3.scaleLinear().domain([0, 100]).range(["#cccccc", "#FFFFFF"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IR_FOCUS: " +
        d3.scaleLinear().domain([0, 100]).range(["#cccccc", "#FFFFFF"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IR_MUTED: " +
        d3.scaleLinear().domain([0, 100]).range(["#333333", "#FFFFFF"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IR_RELATED: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#FFFFFF"])(related),

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_RE: " +
        d3.scaleLinear().domain([0, 100]).range(["#bbbbbb", "#FFFFFF"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_RE_FOCUS:" +
        d3.scaleLinear().domain([0, 100]).range(["#bbbbbb", "#FFFFFF"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_RE_MUTED:" +
        d3.scaleLinear().domain([0, 100]).range(["#333333", "#FFFFFF"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_RE_RELATED: " +
        d3.scaleLinear().domain([0, 100]).range(["#bbbbbb", "#FFFFFF"])(related),

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_S: " +
        d3.scaleLinear().domain([0, 100]).range(["#aaaaaa", "#FFFFFF"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_S_FOCUS: " +
        d3.scaleLinear().domain([0, 100]).range(["#aaaaaa", "#FFFFFF"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_S_MUTED: " +
        d3.scaleLinear().domain([0, 100]).range(["#333333", "#FFFFFF"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_S_RELATED: " +
        d3.scaleLinear().domain([0, 100]).range(["#aaaaaa", "#FFFFFF"])(related),

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_GEX:" +
        d3.scaleLinear().domain([0, 100]).range(["#888888", "#FFFFFF"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_GEX_FOCUS: " +
        d3.scaleLinear().domain([0, 100]).range(["#888888", "#FFFFFF"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_GEX_MUTED: " +
        d3.scaleLinear().domain([0, 100]).range(["#333333", "#FFFFFF"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_GEX_RELATED: " +
        d3.scaleLinear().domain([0, 100]).range(["#999999", "#FFFFFF"])(related),

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_G: " +
        d3.scaleLinear().domain([0, 100]).range(["#666666", "#FFFFFF"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_G_FOCUS: " +
        d3.scaleLinear().domain([0, 100]).range(["#666666", "#FFFFFF"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_G_MUTED:" +
        d3.scaleLinear().domain([0, 100]).range(["#333333", "#FFFFFF"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_G_RELATED: " +
        d3.scaleLinear().domain([0, 100]).range(["#777777", "#FFFFFF"])(related),

      "COLOR_GRAYEDOUT: #121212",
      "COLOR_TRANSITION_GRAYEDOUT: #242424",

      "COLOR_STRECKENGRAPHIK_LINE_GRID_X: whitesmoke",
      "COLOR_STRECKENGRAPHIK_LINE_GRID_Y: whitesmoke",

      "COLOR_Edit: rgb(47, 210, 204)",
    ];
  }
}

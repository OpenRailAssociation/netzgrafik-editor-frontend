import * as d3 from "d3";
import {ThemeBase} from "./theme-base";
import {ThemeRegistration} from "./theme-registration";
import {StaticDomTags} from "../editor-main-view/data-views/static.dom.tags";

export class ThemeGray extends ThemeBase {
  constructor(backgroundColor = "white", backgroundStreckengraphikColor = "white") {
    super(ThemeRegistration.ThemeGray, backgroundColor, backgroundStreckengraphikColor, false);
    ThemeBase.setUIColors(ThemeGray.getThemeGrayColors());
    ThemeBase.setRenderingColors(ThemeGray.getThemeGrayColors());
  }

  static getThemeGrayColors(): string[] {
    const normal = 30;
    const focus = 20;
    const muted = 0;
    const related = 30;

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

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_NORMAL: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_NORMAL_FOCUS: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_NORMAL_MUTED: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_NORMAL_RELATED: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(related),

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_EC: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_EC_FOCUS: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_EC_MUTED: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_EC_RELATED:" +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(related),

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IC: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IC_FOCUS: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IC_MUTED: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IC_RELATED: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(related),

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IR:" +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IR_FOCUS: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IR_MUTED: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_IR_RELATED: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(related),

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_RE: " +
        d3.scaleLinear().domain([0, 100]).range(["#bbbbbb", "#000000"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_RE_FOCUS:" +
        d3.scaleLinear().domain([0, 100]).range(["#bbbbbb", "#000000"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_RE_MUTED:" +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_RE_RELATED: " +
        d3.scaleLinear().domain([0, 100]).range(["#bbbbbb", "#000000"])(related),

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_S: " +
        d3.scaleLinear().domain([0, 100]).range(["#aaaaaa", "#000000"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_S_FOCUS: " +
        d3.scaleLinear().domain([0, 100]).range(["#aaaaaa", "#000000"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_S_MUTED: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_S_RELATED: " +
        d3.scaleLinear().domain([0, 100]).range(["#aaaaaa", "#000000"])(related),

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_GEX:" +
        d3.scaleLinear().domain([0, 100]).range(["#999999", "#000000"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_GEX_FOCUS: " +
        d3.scaleLinear().domain([0, 100]).range(["#999999", "#000000"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_GEX_MUTED: " +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_GEX_RELATED: " +
        d3.scaleLinear().domain([0, 100]).range(["#999999", "#000000"])(related),

      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_G: " +
        d3.scaleLinear().domain([0, 100]).range(["#777777", "#000000"])(normal),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_G_FOCUS: " +
        d3.scaleLinear().domain([0, 100]).range(["#777777", "#000000"])(focus),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_G_MUTED:" +
        d3.scaleLinear().domain([0, 100]).range(["#dddddd", "#000000"])(muted),
      StaticDomTags.PREFIX_COLOR_VARIABLE +
        "_G_RELATED: " +
        d3.scaleLinear().domain([0, 100]).range(["#777777", "#000000"])(related),

      "COLOR_GRAYEDOUT: white",
      "COLOR_TRANSITION_GRAYEDOUT: whitesmoke",

      "COLOR_STRECKENGRAPHIK_LINE_GRID_X: darkgray",
      "COLOR_STRECKENGRAPHIK_LINE_GRID_Y: darkgray",

      "COLOR_Edit: rgb(47, 210, 204)",
    ];
  }
}

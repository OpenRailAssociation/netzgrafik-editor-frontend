import {Injectable} from "@angular/core";
import {BehaviorSubject} from "rxjs";
import {NetzgrafikColorDto, TrainrunCategory} from "../../data-structures/business.data.structures";
import {StaticDomTags} from "../../view/editor-main-view/data-views/static.dom.tags";
import {NetzgrafikColor} from "../../models/netzgrafikColor.model";
import {LogService} from "../../logger/log.service";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {ColorRefType} from "../../data-structures/technical.data.structures";

@Injectable({
  providedIn: "root",
})
export class NetzgrafikColoringService {
  // Description of observable data service: https://coryrylan.com/blog/angular-observable-data-services
  netzgrafikColorSubject = new BehaviorSubject<NetzgrafikColor[]>([]);
  readonly netzgrafikColorObservable = this.netzgrafikColorSubject.asObservable();
  netzgrafikColorStore: {netzgrafikColors: NetzgrafikColor[]} = {
    netzgrafikColors: [],
  }; // store the data in memory

  private isDarkMode = false;
  private generatedStyleSheets: CSSStyleSheet[];

  constructor(private logService: LogService) {
    this.generateColors();
  }

  private static generateLinePatternColorUI(sheet: CSSStyleSheet, verbose = false) {
    [
      "path.edge_line.layer_3.Freq_30." +
        StaticDomTags.TAG_UI_DIALOG +
        " {  stroke: var(--sbb-header-lean-background-color); }",
      "path.edge_line.layer_2.Freq_20." +
        StaticDomTags.TAG_UI_DIALOG +
        " {  stroke: var(--sbb-header-lean-background-color); }",
      "path.edge_line.layer_1.Freq_15." +
        StaticDomTags.TAG_UI_DIALOG +
        " {  stroke: var(--sbb-header-lean-background-color); }",
      "path.edge_line.layer_3.Freq_15." +
        StaticDomTags.TAG_UI_DIALOG +
        " {  stroke: var(--sbb-header-lean-background-color); }",
      "path.edge_line.layer_3.Freq_15." +
        StaticDomTags.TAG_UI_DIALOG +
        " {  stroke: var(--sbb-header-lean-background-color); }",
    ].forEach((rule) => {
      sheet.insertRule(rule, sheet.cssRules.length);
      if (verbose) {
        console.log(rule);
      }
    });
  }

  private static generateLinePatternColor(sheet: CSSStyleSheet, verbose = false) {
    [
      "path.edge_line.layer_3.Freq_30           {  stroke: var(--COLOR_BACKGROUND); }",
      "path.edge_line.layer_2.Freq_20           {  stroke: var(--COLOR_BACKGROUND); }",
      "path.edge_line.layer_1.Freq_15           {  stroke: var(--COLOR_BACKGROUND); }",
      "path.edge_line.layer_3.Freq_15           {  stroke: var(--COLOR_BACKGROUND); }",
      "path.transition_line.layer_3.Freq_30     {  stroke: var(--NODE_DOCKABLE); }",
      "path.transition_line.layer_2.Freq_20     {  stroke: var(--NODE_DOCKABLE); }",
      "path.transition_line.layer_1.Freq_15     {  stroke: var(--NODE_DOCKABLE); }",
      "path.transition_line.layer_3.Freq_15     {  stroke: var(--NODE_DOCKABLE); }",
    ].forEach((rule) => {
      sheet.insertRule(rule, sheet.cssRules.length);
      if (verbose) {
        console.log(rule);
      }
    });
  }

  private static generateButtonColors(
    sheet: CSSStyleSheet,
    colorRef: ColorRefType,
    verbose = false,
  ) {
    [
      {
        tag: "",
        color: "NODE_TEXT_FOCUS",
        backgroundColor:
          StaticDomTags.PREFIX_COLOR_VARIABLE +
          "_" +
          colorRef +
          "_" +
          StaticDomTags.TAG_MUTED.toUpperCase(),
      },
      {
        tag: StaticDomTags.TAG_SELECTED,
        color: "sbb-color-white",
        backgroundColor:
          StaticDomTags.PREFIX_COLOR_VARIABLE +
          "_" +
          colorRef +
          "_" +
          StaticDomTags.TAG_FOCUS.toUpperCase(),
      },
    ].forEach((d) => {
      const rule =
        "button." +
        "ColorRef_" +
        colorRef +
        (d.tag !== "" ? "." + d.tag : "") +
        " { color: var(--" +
        d.color +
        "); background-color: var(--" +
        d.backgroundColor +
        "); border-color: transparent; }";
      sheet.insertRule(rule, sheet.cssRules.length);
      if (verbose) {
        console.log(rule);
      }
    });
  }

  private static generateColors(
    sheet: CSSStyleSheet,
    colorRef: ColorRefType,
    cssElement: string,
    domElement: string,
    verbose = false,
  ) {
    [
      {
        tag: "",
        color: StaticDomTags.PREFIX_COLOR_VARIABLE + "_" + colorRef,
      },
      {
        tag: StaticDomTags.TAG_HOVER,
        color:
          StaticDomTags.PREFIX_COLOR_VARIABLE +
          "_" +
          colorRef +
          "_" +
          StaticDomTags.TAG_FOCUS.toUpperCase(),
      },
      {
        tag: StaticDomTags.TAG_MUTED,
        color:
          StaticDomTags.PREFIX_COLOR_VARIABLE +
          "_" +
          colorRef +
          "_" +
          StaticDomTags.TAG_MUTED.toUpperCase(),
      },
      {
        tag: StaticDomTags.TAG_FOCUS,
        color:
          StaticDomTags.PREFIX_COLOR_VARIABLE +
          "_" +
          colorRef +
          "_" +
          StaticDomTags.TAG_FOCUS.toUpperCase(),
      },
      {
        tag: StaticDomTags.TAG_SELECTED,
        color: "COLOR_Edit",
      },
      {
        tag: StaticDomTags.TAG_GRAYEDOUT,
        color: "COLOR_GRAYEDOUT",
      },
      {
        tag: StaticDomTags.TAG_SELECTED + "." + StaticDomTags.TAG_GRAYEDOUT,
        color: "COLOR_GRAYEDOUT",
      },
      {
        tag: StaticDomTags.TAG_WARNING,
        color: "COLOR_Warning",
      },
    ].forEach((d) => {
      const rule =
        domElement +
        "." +
        "ColorRef_" +
        colorRef +
        (d.tag !== "" ? "." + d.tag : "") +
        " { " +
        cssElement +
        ": var(--" +
        d.color +
        "); }";
      sheet.insertRule(rule, sheet.cssRules.length);
      if (verbose) {
        console.log(rule);
      }
    });
  }

  private static generateUIColors(
    sheet: CSSStyleSheet,
    colorRef: ColorRefType,
    cssElement: string,
    domElement: string,
    verbose = false,
  ) {
    [
      {
        tag: "",
        color:
          StaticDomTags.TAG_UI_DIALOG + "_" + StaticDomTags.PREFIX_COLOR_VARIABLE + "_" + colorRef,
      },
      {
        tag: StaticDomTags.TAG_HOVER,
        color:
          StaticDomTags.TAG_UI_DIALOG +
          "_" +
          StaticDomTags.PREFIX_COLOR_VARIABLE +
          "_" +
          colorRef +
          "_" +
          StaticDomTags.TAG_FOCUS.toUpperCase(),
      },
      {
        tag: StaticDomTags.TAG_MUTED,
        color:
          StaticDomTags.TAG_UI_DIALOG +
          "_" +
          StaticDomTags.PREFIX_COLOR_VARIABLE +
          "_" +
          colorRef +
          "_" +
          StaticDomTags.TAG_MUTED.toUpperCase(),
      },
      {
        tag: StaticDomTags.TAG_FOCUS,
        color:
          StaticDomTags.TAG_UI_DIALOG +
          "_" +
          StaticDomTags.PREFIX_COLOR_VARIABLE +
          "_" +
          colorRef +
          "_" +
          StaticDomTags.TAG_FOCUS.toUpperCase(),
      },
      {
        tag: StaticDomTags.TAG_SELECTED,
        color: "COLOR_Edit",
      },
      {
        tag: StaticDomTags.TAG_GRAYEDOUT,
        color: "COLOR_GRAYEDOUT",
      },
      {
        tag: StaticDomTags.TAG_SELECTED + "." + StaticDomTags.TAG_GRAYEDOUT,
        color: "COLOR_GRAYEDOUT",
      },
      {
        tag: StaticDomTags.TAG_WARNING,
        color: "COLOR_Warning",
      },
    ].forEach((d) => {
      const rule =
        domElement +
        "." +
        StaticDomTags.TAG_UI_DIALOG +
        "_" +
        "ColorRef_" +
        colorRef +
        (d.tag !== "" ? "." + d.tag : "") +
        " { " +
        cssElement +
        ": var(--" +
        d.color +
        "); }";
      sheet.insertRule(rule, sheet.cssRules.length);
      if (verbose) {
        console.log(rule);
      }
    });
  }

  setDarkMode(darkMode) {
    this.isDarkMode = darkMode;
    this.generateColors();

    document.documentElement.style.setProperty(
      "--Button_TrainrunDialog_opacity",
      this.isDarkMode ? "0.6" : "0.9",
    );
  }

  generateColors() {
    this.netzgrafikColorStore.netzgrafikColors.forEach((netzgrafikColor) => {
      const colors = netzgrafikColor.getColors(this.isDarkMode);

      document.documentElement.style.setProperty(
        "--" + StaticDomTags.PREFIX_COLOR_VARIABLE + "_" + netzgrafikColor.getColorRef(),
        colors.color,
      );
      document.documentElement.style.setProperty(
        "--" +
          StaticDomTags.PREFIX_COLOR_VARIABLE +
          "_" +
          netzgrafikColor.getColorRef() +
          "_" +
          StaticDomTags.TAG_FOCUS.toUpperCase(),
        colors.colorFocus,
      );
      document.documentElement.style.setProperty(
        "--" +
          StaticDomTags.PREFIX_COLOR_VARIABLE +
          "_" +
          netzgrafikColor.getColorRef() +
          "_" +
          StaticDomTags.TAG_MUTED.toUpperCase(),
        colors.colorMuted,
      );
      document.documentElement.style.setProperty(
        "--" +
          StaticDomTags.PREFIX_COLOR_VARIABLE +
          "_" +
          netzgrafikColor.getColorRef() +
          "_" +
          StaticDomTags.TAG_RELATED.toUpperCase(),
        colors.colorRelated,
      );

      const uiColors = netzgrafikColor.getColors(false);
      document.documentElement.style.setProperty(
        "--" +
          StaticDomTags.TAG_UI_DIALOG +
          "_" +
          StaticDomTags.PREFIX_COLOR_VARIABLE +
          "_" +
          netzgrafikColor.getColorRef(),
        uiColors.color,
      );
      document.documentElement.style.setProperty(
        "--" +
          StaticDomTags.TAG_UI_DIALOG +
          "_" +
          StaticDomTags.PREFIX_COLOR_VARIABLE +
          "_" +
          netzgrafikColor.getColorRef() +
          "_" +
          StaticDomTags.TAG_FOCUS.toUpperCase(),
        uiColors.colorFocus,
      );
      document.documentElement.style.setProperty(
        "--" +
          StaticDomTags.TAG_UI_DIALOG +
          "_" +
          StaticDomTags.PREFIX_COLOR_VARIABLE +
          "_" +
          netzgrafikColor.getColorRef() +
          "_" +
          StaticDomTags.TAG_MUTED.toUpperCase(),
        uiColors.colorMuted,
      );
      document.documentElement.style.setProperty(
        "--" +
          StaticDomTags.TAG_UI_DIALOG +
          "_" +
          StaticDomTags.PREFIX_COLOR_VARIABLE +
          "_" +
          netzgrafikColor.getColorRef() +
          "_" +
          StaticDomTags.TAG_RELATED.toUpperCase(),
        uiColors.colorRelated,
      );
    });
  }

  generateGlobalStyles(
    trainrunCategories: TrainrunCategory[],
    trainrunSections: TrainrunSection[],
    verbose = false,
  ) {
    // collect all used colorRefs
    const colorRefs = this.collectColorRefs(trainrunCategories, trainrunSections);

    // check whether for each collect colorRef the object exists - otherwise create default
    colorRefs.forEach((colorRef) => this.createDefaultColorForNotExistingColors(colorRef));

    // generate colors
    this.generateColors();

    // Create an empty "constructed" stylesheet
    const sheet = new CSSStyleSheet();
    const sheetKnotenauslastung = new CSSStyleSheet();
    const sheetLinePattern = new CSSStyleSheet();
    this.generatedStyleSheets = [sheetKnotenauslastung, sheet, sheetLinePattern];
    document.adoptedStyleSheets = this.generatedStyleSheets;

    // generate CSS (styling)
    colorRefs.forEach((colorRef) =>
      this.generateColorAndStyling(colorRef, sheetKnotenauslastung, sheet, sheetLinePattern),
    );

    return document.adoptedStyleSheets;
  }

  setNetzgrafikColors(netzgrafikColors: NetzgrafikColorDto[]) {
    this.netzgrafikColorStore.netzgrafikColors = netzgrafikColors.map(
      (netzgrafikColor) => new NetzgrafikColor(netzgrafikColor),
    );
    this.netzgrafikColorUpdated();
  }

  getNetzgrafikColor(colorRef: ColorRefType): NetzgrafikColor {
    return this.netzgrafikColorStore.netzgrafikColors.find(
      (netzgrafikColor: NetzgrafikColor) => netzgrafikColor.getColorRef() === colorRef,
    );
  }

  changeColorRef(netzgrafikColorId: number, colorRef: ColorRefType) {
    const found = this.netzgrafikColorStore.netzgrafikColors.find(
      (netzgrafikColor) => netzgrafikColor.getId() === netzgrafikColorId,
    );
    if (found !== undefined) {
      found.setColorRef(colorRef);
      this.netzgrafikColorUpdated();
    }
  }

  netzgrafikColorUpdated() {
    this.netzgrafikColorSubject.next(Object.assign({}, this.netzgrafikColorStore).netzgrafikColors);
  }

  getDtos() {
    return this.netzgrafikColorStore.netzgrafikColors.map((netzgrafikColor) =>
      netzgrafikColor.getDto(),
    );
  }

  createDefaultColorForNotExistingColors(
    colorRef: ColorRefType,
    defaults: ColorRefType[] = ["EC", "IC", "IR", "RE", "S", "G", "GEX"],
  ) {
    if (defaults.find((d) => d === colorRef) !== undefined) {
      return;
    }
    let netzgrafikColor = this.getNetzgrafikColor(colorRef);
    if (netzgrafikColor === undefined) {
      netzgrafikColor = new NetzgrafikColor();
      netzgrafikColor.setColorRef(colorRef);
      this.netzgrafikColorStore.netzgrafikColors.push(netzgrafikColor);
      this.netzgrafikColorUpdated();
    }
  }

  private collectColorRefs(
    trainrunCategories: TrainrunCategory[],
    trainrunSections: TrainrunSection[],
  ): ColorRefType[] {
    let colorRefs: ColorRefType[] = [];
    trainrunCategories.forEach((cat) => {
      colorRefs.push(cat.colorRef);
    });

    trainrunSections.forEach((ts) => {
      colorRefs.push(ts.getTravelTimeFormatterColorRef());
      colorRefs.push(ts.getSourceDepartureFormatterColorRef());
      colorRefs.push(ts.getSourceArrivalFormatterColorRef());
      colorRefs.push(ts.getTargetDepartureFormatterColorRef());
      colorRefs.push(ts.getTargetArrivalFormatterColorRef());
    });

    colorRefs = colorRefs.filter((v, i, a) => a.indexOf(v) === i);
    colorRefs = colorRefs.filter((str) => str !== undefined);

    // Add default colorRef when no trainrun is selected
    return [...colorRefs, "NORMAL"];
  }

  private generateColorAndStyling(
    colorRef: ColorRefType,
    sheetKnotenauslastung: CSSStyleSheet,
    sheet: CSSStyleSheet,
    sheetLinePattern: CSSStyleSheet,
    verbose = false,
  ) {
    NetzgrafikColoringService.generateButtonColors(sheet, colorRef, verbose);

    NetzgrafikColoringService.generateColors(
      sheet,
      colorRef,
      "stroke",
      StaticDomTags.EDGE_LINE_DOM_REF,
      verbose,
    );
    NetzgrafikColoringService.generateColors(
      sheet,
      colorRef,
      "fill",
      StaticDomTags.EDGE_LINE_ARROW_DOM_REF,
      verbose,
    );
    NetzgrafikColoringService.generateColors(
      sheet,
      colorRef,
      "stroke",
      StaticDomTags.EDGE_LINE_ARROW_DOM_REF,
      verbose,
    );
    NetzgrafikColoringService.generateColors(
      sheet,
      colorRef,
      "stroke",
      StaticDomTags.EDGE_LINE_STOPS_DOM_REF,
      verbose,
    );

    NetzgrafikColoringService.generateColors(
      sheet,
      colorRef,
      "fill",
      StaticDomTags.EDGE_LINE_DOM_REF + "." + StaticDomTags.TAG_HEADWAY_BAND,
      verbose,
    );

    NetzgrafikColoringService.generateColors(
      sheet,
      colorRef,
      "fill",
      StaticDomTags.EDGE_LINE_STOPS_DOM_REF + "." + StaticDomTags.EDGE_LINE_STOPS_FILL,
      verbose,
    );
    NetzgrafikColoringService.generateColors(
      sheet,
      colorRef,
      "stroke",
      StaticDomTags.EDGE_LINE_STOPS_DOM_REF,
      verbose,
    );
    NetzgrafikColoringService.generateColors(
      sheet,
      colorRef,
      "fill",
      StaticDomTags.EDGE_LINE_STOPS_DOM_REF + "." + StaticDomTags.TAG_FILL,
      verbose,
    );
    NetzgrafikColoringService.generateColors(
      sheet,
      colorRef,
      "stroke",
      StaticDomTags.EDGE_LINE_STOP_ICON_CLASS_DOM_REF,
      verbose,
    );
    NetzgrafikColoringService.generateColors(
      sheet,
      colorRef,
      "fill",
      StaticDomTags.EDGE_LINE_STOP_ICON_CLASS_DOM_REF + "." + StaticDomTags.TAG_FILL,
      verbose,
    );
    NetzgrafikColoringService.generateColors(
      sheet,
      colorRef,
      "fill",
      StaticDomTags.EDGE_LINE_TEXT_DOM_REF,
      verbose,
    );
    NetzgrafikColoringService.generateColors(
      sheet,
      colorRef,
      "stroke",
      StaticDomTags.TRANSITION_LINE_DOM_REF,
      verbose,
    );

    // TODO - Knotenauslastung refactoring will impact this part
    NetzgrafikColoringService.generateColors(
      sheetKnotenauslastung,
      colorRef,
      "stroke",
      StaticDomTags.KNOTENAUSLASTUNG_DATA_GROUP_PATH,
      verbose,
    );
    NetzgrafikColoringService.generateColors(
      sheetKnotenauslastung,
      colorRef,
      "fill",
      StaticDomTags.KNOTENAUSLASTUNG_DATA_GROUP_PATH,
      verbose,
    );
    NetzgrafikColoringService.generateColors(
      sheetKnotenauslastung,
      colorRef,
      "fill",
      StaticDomTags.KNOTENAUSLASTUNG_DATA_GROUP_TEXT,
      verbose,
    );

    // Line Pattern Coloring
    NetzgrafikColoringService.generateLinePatternColor(sheetLinePattern, verbose);
    NetzgrafikColoringService.generateLinePatternColorUI(sheetLinePattern, verbose);
  }
}

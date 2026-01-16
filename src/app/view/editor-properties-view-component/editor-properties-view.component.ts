import {Component} from "@angular/core";
import {DataService} from "../../services/data/data.service";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {SbbRadioChange} from "@sbb-esta/angular/radio-button";
import {ThemeBase} from "../themes/theme-base";
import {ThemeRegistration} from "../themes/theme-registration";
import {StreckengrafikRenderingType} from "../themes/streckengrafik-rendering-type";
import {TravelTimeCreationEstimatorType} from "../themes/editor-trainrun-traveltime-creator-type";
import {PortOrderingType} from "../../data-structures/technical.data.structures";

@Component({
  selector: "sbb-editor-properties-view-component",
  templateUrl: "./editor-properties-view.component.html",
  styleUrls: ["./editor-properties-view.component.scss"],
})
export class EditorPropertiesViewComponent {
  static DEFAULT_DARK_BACKGROUNDCOLOR = "#050505";
  static DEFAULT_BACKGROUNDCOLOR = "#f5f5f5";
  static BACKGROUNDCOLOR_WHITE = "#ffffff";

  colorThemeOptions = [
    {
      name: $localize`:@@app.view.editor-properties-view-component.standardColorTheme:Standard color theme`,
      themeRegistration: ThemeRegistration.ThemeFach,
      isDark: false,
    },
    {
      name: $localize`:@@app.view.editor-properties-view-component.specialColorTheme:Special color theme`,
      themeRegistration: ThemeRegistration.ThemeDefaultUx,
      isDark: false,
    },
    {
      name: $localize`:@@app.view.editor-properties-view-component.grayscaleColorTheme:Grayscale color theme`,
      themeRegistration: ThemeRegistration.ThemeGray,
      isDark: false,
    },
    {
      name: $localize`:@@app.view.editor-properties-view-component.optimizedPrintColorTheme:Optimized color theme for printing/exporting`,
      themeRegistration: ThemeRegistration.ThemeFachPrint,
      isDark: false,
    },
    {
      name: $localize`:@@app.view.editor-properties-view-component.standardDarkColorTheme:Standard color theme (dark)`,
      themeRegistration: ThemeRegistration.ThemeFachDark,
      isDark: true,
    },
    {
      name: $localize`:@@app.view.editor-properties-view-component.specialDarkColorTheme:Special color theme (dark)`,
      themeRegistration: ThemeRegistration.ThemeDefaultUxDark,
      isDark: true,
    },
    {
      name: $localize`:@@app.view.editor-properties-view-component.grayscaleDarkColorTheme:Grayscale color theme (dark)`,
      themeRegistration: ThemeRegistration.ThemeGrayDark,
      isDark: true,
    },
  ];
  activeColorTheme: ThemeBase = null;

  streckengrafikRenderingTypeOptions = [
    {
      name: $localize`:@@app.view.editor-properties-view-component.timeScaledDistance:travel time scaled`,
      title: $localize`:@@app.view.editor-properties-view-component.timeScaledDistanceTooltip:The route graphic sections are displayed with travel time scaling, i.e. it is assumed that the selected train travels at a constant speed.`,
      streckengrafikRenderingType: StreckengrafikRenderingType.TimeScaledDistance,
    },
    {
      name: $localize`:@@app.view.editor-properties-view-component.uniformDistance:uniform`,
      title: $localize`:@@app.view.editor-properties-view-component.uniformDistanceTooltip:The route graphic sections are uniformly displayed.`,
      streckengrafikRenderingType: StreckengrafikRenderingType.UniformDistance,
    },
  ];
  activeStreckengrafikRenderingType: StreckengrafikRenderingType = null;

  travelTimeCreationEstimatorTypeOptions = [
    {
      name: $localize`:@@app.view.editor-properties-view-component.fixed:Constant 1min`,
      title: $localize`:@@app.view.editor-properties-view-component.fixedTooltip:Adopts the travel time with a constant 1min (default).`,
      travelTimeCreationEstimatorType: TravelTimeCreationEstimatorType.Fixed,
    },
    {
      name: $localize`:@@app.view.editor-properties-view-component.retrieveFromEdge:Section travel time`,
      title: $localize`:@@app.view.editor-properties-view-component.retrieveFromEdgeTooltip:Takes over the max. travel time on the same section of all trains of the same category, otherwise max. travel time of all trains, otherwise 1 min.`,
      travelTimeCreationEstimatorType: TravelTimeCreationEstimatorType.RetrieveFromEdge,
    },
  ];
  activeTravelTimeCreationEstimatorType: TravelTimeCreationEstimatorType = null;

  portOrderingTypeOptions = [
    {
      name: $localize`:@@app.view.editor-properties-view-component.alphabeticalPortOrdering:Alphabetical`,
      title: $localize`:@@app.view.editor-properties-view-component.alphabeticalPortOrderingTooltip:Order ports alphabetically by train category.`,
      portOrderingType: PortOrderingType.Alphabetical,
    },
    {
      name: $localize`:@@app.view.editor-properties-view-component.crossingAwarePortOrdering:Crossing aware`,
      title: $localize`:@@app.view.editor-properties-view-component.crossingAwarePortOrderingTooltip:Minimize visual crossings using global propagation.`,
      portOrderingType: PortOrderingType.CrossingAware,
    },
  ];
  activePortOrderingType: PortOrderingType = null;

  activeDarkBackgroundColor = EditorPropertiesViewComponent.DEFAULT_DARK_BACKGROUNDCOLOR;
  activeBackgroundColor = EditorPropertiesViewComponent.DEFAULT_BACKGROUNDCOLOR;

  constructor(
    private dataService: DataService,
    private uiInteractionService: UiInteractionService,
  ) {
    const activeTheme = this.uiInteractionService.getActiveTheme();
    this.activeColorTheme = activeTheme;
    this.activeStreckengrafikRenderingType =
      this.uiInteractionService.getActiveStreckengrafikRenderingType();
    this.activeTravelTimeCreationEstimatorType =
      this.uiInteractionService.getActiveTravelTimeCreationEstimatorType();
    this.activePortOrderingType = this.uiInteractionService.getActivePortOrderingType();

    if (activeTheme.isDark) {
      this.activeDarkBackgroundColor = this.getHexColor(activeTheme.backgroundColor);
    } else {
      this.activeBackgroundColor = this.getHexColor(activeTheme.backgroundColor);
    }
  }

  isActiveColorThemeDark(): boolean {
    return this.uiInteractionService.getActiveTheme().isDark;
  }

  onUpdateColorTheme(event: SbbRadioChange) {
    this.uiInteractionService.createTheme(
      event.value,
      this.activeBackgroundColor,
      this.activeDarkBackgroundColor,
    );
  }

  onUpdateStreckengrafikRenderingType(event: SbbRadioChange) {
    this.uiInteractionService.setActiveStreckengrafikRenderingType(event.value);
  }

  onUpdateTravelTimeCreationEstimatorType(event: SbbRadioChange) {
    this.uiInteractionService.setActiveTravelTimeCreationEstimatorType(event.value);
  }

  onUpdatePortOrderingType(event: SbbRadioChange) {
    this.uiInteractionService.setActivePortOrderingType(event.value);
  }

  colorPicked(value) {
    this.onUpdateColorTheme(
      new SbbRadioChange(null, this.uiInteractionService.getActiveTheme().themeRegistration),
    );
  }

  isDefaultBackgroundColorActive(): boolean {
    return this.activeBackgroundColor === EditorPropertiesViewComponent.DEFAULT_BACKGROUNDCOLOR;
  }

  isDefaultDarkBackgroundColorActive(): boolean {
    return (
      this.activeDarkBackgroundColor === EditorPropertiesViewComponent.DEFAULT_DARK_BACKGROUNDCOLOR
    );
  }

  isBackgroundColorWhite(): boolean {
    return this.activeBackgroundColor === EditorPropertiesViewComponent.BACKGROUNDCOLOR_WHITE;
  }

  setBackgroundColorToWhite() {
    this.activeBackgroundColor = EditorPropertiesViewComponent.BACKGROUNDCOLOR_WHITE;
    this.onUpdateColorTheme(
      new SbbRadioChange(null, this.uiInteractionService.getActiveTheme().themeRegistration),
    );
  }

  onResetBackgroundColor() {
    this.activeBackgroundColor = EditorPropertiesViewComponent.DEFAULT_BACKGROUNDCOLOR;
    this.onUpdateColorTheme(
      new SbbRadioChange(null, this.uiInteractionService.getActiveTheme().themeRegistration),
    );
  }

  onResetDarkBackgroundColor() {
    this.activeDarkBackgroundColor = EditorPropertiesViewComponent.DEFAULT_DARK_BACKGROUNDCOLOR;
    this.onUpdateColorTheme(
      new SbbRadioChange(null, this.uiInteractionService.getActiveTheme().themeRegistration),
    );
  }

  isLocalStoredColorTheme() {
    return this.uiInteractionService.isLocalStoredColorTheme();
  }

  resetLocalStoredColorData() {
    this.uiInteractionService.resetLocalStoredColorData();
    this.activeColorTheme = this.uiInteractionService.getActiveTheme();
  }

  private getHexColor(colorStr): string {
    const a = document.createElement("div");
    a.style.color = colorStr;
    const colors = window
      .getComputedStyle(document.body.appendChild(a))
      .color.match(/\d+/g)
      .map((v) => parseInt(v, 10));
    document.body.removeChild(a);
    if (colors.length >= 3) {
      // eslint-disable-next-line no-bitwise
      return (
        "#" +
        ((1 << 24) + (colors[0] << 16) + (colors[1] << 8) + colors[2]).toString(16).substring(1)
      );
    } else {
      return colorStr;
    }
  }
}

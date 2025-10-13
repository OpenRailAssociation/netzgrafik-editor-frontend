import {ThemeDefaultUxDark} from "../../view/themes/theme-default-ux-dark";
import {ThemeFach} from "../../view/themes/theme-fach";
import {ThemeFachDark} from "../../view/themes/theme-fach-dark";
import {ThemeDefaultUx} from "../../view/themes/theme-default-ux";
import {ThemeFachPrint} from "../../view/themes/theme-fach-print";
import {ThemeGray} from "../../view/themes/theme-gray";
import {ThemeBase} from "./theme-base";
import {ThemeRegistration} from "./theme-registration";
import {NetzgrafikColor} from "../../models/netzgrafikColor.model";
import {ThemeGrayDark} from "./theme-gray-dark";

describe("Theme Tests", () => {
  it("ThemeBase test - simple", () => {
    expect(new ThemeBase(ThemeRegistration.ThemeDefaultUx).themeRegistration).toBe(0);
    expect(new ThemeBase(ThemeRegistration.ThemeDefaultUxDark).themeRegistration).toBe(1);
    expect(new ThemeBase(ThemeRegistration.ThemeFach).themeRegistration).toBe(2);
    expect(new ThemeBase(ThemeRegistration.ThemeFachDark).themeRegistration).toBe(3);
    expect(new ThemeBase(ThemeRegistration.ThemeFachPrint).themeRegistration).toBe(4);
    expect(new ThemeBase(ThemeRegistration.ThemeGray).themeRegistration).toBe(5);
    expect(new ThemeBase(ThemeRegistration.ThemeGrayDark).themeRegistration).toBe(6);
  });

  it("ThemeBase test - extended", () => {
    expect(new ThemeBase(ThemeRegistration.ThemeDefaultUx, "red", "white", false).isDark).toBe(
      false,
    );
    expect(new ThemeBase(ThemeRegistration.ThemeDefaultUxDark, "red", "white", false).isDark).toBe(
      false,
    );
    expect(new ThemeBase(ThemeRegistration.ThemeFach, "red", "white", false).isDark).toBe(false);
    expect(new ThemeBase(ThemeRegistration.ThemeFachDark, "red", "white", false).isDark).toBe(
      false,
    );
    expect(new ThemeBase(ThemeRegistration.ThemeFachPrint, "red", "white", true).isDark).toBe(true);
    expect(new ThemeBase(ThemeRegistration.ThemeGray, "red", "white", true).isDark).toBe(true);
    expect(new ThemeBase(ThemeRegistration.ThemeGrayDark, "red", "white", true).isDark).toBe(true);
  });

  it("getTheme...Colors() ", () => {
    const nbrColorEntries = 46;
    expect(ThemeDefaultUx.getThemeDefaultUxColors().length).toBe(nbrColorEntries);
    expect(ThemeDefaultUxDark.getThemeDefaultUxDarkColors().length).toBe(nbrColorEntries);
    expect(ThemeFach.getThemeFachColors().length).toBe(nbrColorEntries);
    expect(ThemeFachDark.getThemeFachDarkColors().length).toBe(nbrColorEntries);
    expect(ThemeFachPrint.getThemeFachPrintColors().length).toBe(nbrColorEntries);
    expect(ThemeGray.getThemeGrayColors().length).toBe(nbrColorEntries);
    expect(ThemeFachDark.getThemeFachDarkColors().length).toBe(nbrColorEntries);
  });

  it("check...Colors_keys() ", () => {
    const nbrColorEntries = 46;
    const keys: string[] = [];
    ThemeDefaultUx.getThemeDefaultUxColors().forEach((str: string) => keys.push(str.split(":")[0]));

    ThemeDefaultUx.getThemeDefaultUxColors().forEach((entry: string) => {
      const key: string = entry.split(":")[0];
      expect(keys.includes(key)).toBe(true);
    });

    ThemeDefaultUxDark.getThemeDefaultUxDarkColors().forEach((entry: string) => {
      const key: string = entry.split(":")[0];
      expect(keys.includes(key)).toBe(true);
    });

    ThemeFach.getThemeFachColors().forEach((entry: string) => {
      const key: string = entry.split(":")[0];
      expect(keys.includes(key)).toBe(true);
    });

    ThemeFachDark.getThemeFachDarkColors().forEach((entry: string) => {
      const key: string = entry.split(":")[0];
      expect(keys.includes(key)).toBe(true);
    });

    ThemeFachPrint.getThemeFachPrintColors().forEach((entry: string) => {
      const key: string = entry.split(":")[0];
      expect(keys.includes(key)).toBe(true);
    });

    ThemeGray.getThemeGrayColors().forEach((entry: string) => {
      const key: string = entry.split(":")[0];
      expect(keys.includes(key)).toBe(true);
    });

    ThemeFachDark.getThemeFachDarkColors().forEach((entry: string) => {
      const key: string = entry.split(":")[0];
      expect(keys.includes(key)).toBe(true);
    });
  });

  it("ThemeBase..GlobalColors ", () => {
    expect(ThemeBase.getGlobalColors().length).toBe(12);
    expect(ThemeBase.getGlobalColors("red").length).toBe(12);
    expect(ThemeBase.getGlobalColors("red", "yellow").length).toBe(12);

    expect(ThemeBase.getGlobalColors("red", "yellow").includes("COLOR_BACKGROUND: red")).toBe(true);
    expect(
      ThemeBase.getGlobalColors("red", "yellow").includes(
        "COLOR_STRECKENGRAPHIK_BACKGROUND: yellow",
      ),
    ).toBe(true);
  });

  it("ThemeBase..checks ", () => {
    ThemeBase.setUIColors(ThemeDefaultUx.getThemeDefaultUxColors());
    ThemeBase.setRenderingColors(ThemeDefaultUx.getThemeDefaultUxColors());
    expect(ThemeBase.getGlobalColors().length).toBe(12);
  });

  it("NetzgrafikColor  - id check", () => {
    const nc1 = new NetzgrafikColor();
    const nc1Data = nc1.getDto();
    nc1Data.id = nc1Data.id + 10;
    const nc2 = new NetzgrafikColor(nc1Data);
    expect(new NetzgrafikColor().getId()).toBe(nc2.getId() + 1);
  });

  it("ThemeDefaultUx - test", () => {
    const t1 = new ThemeDefaultUx();
    const t2 = new ThemeDefaultUx("red");
    const t3 = new ThemeDefaultUx("yellow", "blue");
    expect(t1.backgroundColor).toBe("white");
    expect(t1.backgroundStreckengraphikColor).toBe("white");
    expect(t2.backgroundColor).toBe("red");
    expect(t2.backgroundStreckengraphikColor).toBe("white");
    expect(t3.backgroundColor).toBe("yellow");
    expect(t3.backgroundStreckengraphikColor).toBe("blue");
  });

  it("ThemeDefaultUxDark  - test", () => {
    const t1 = new ThemeDefaultUxDark();
    const t2 = new ThemeDefaultUxDark("red");
    const t3 = new ThemeDefaultUxDark("yellow", "blue");
    expect(t1.backgroundColor).toBe("var(--sbb-header-lean-background-color)");
    expect(t1.backgroundStreckengraphikColor).toBe("var(--sbb-header-lean-background-color)");
    expect(t2.backgroundColor).toBe("red");
    expect(t2.backgroundStreckengraphikColor).toBe("var(--sbb-header-lean-background-color)");
    expect(t3.backgroundColor).toBe("yellow");
    expect(t3.backgroundStreckengraphikColor).toBe("blue");
  });

  it("ThemeFach - test", () => {
    const t1 = new ThemeFach();
    const t2 = new ThemeFach("red");
    const t3 = new ThemeFach("yellow", "blue");
    expect(t1.backgroundColor).toBe("whitesmoke");
    expect(t1.backgroundStreckengraphikColor).toBe("white");
    expect(t2.backgroundColor).toBe("red");
    expect(t2.backgroundStreckengraphikColor).toBe("white");
    expect(t3.backgroundColor).toBe("yellow");
    expect(t3.backgroundStreckengraphikColor).toBe("blue");
  });

  it("ThemeFachDark   - test", () => {
    const t1 = new ThemeFachDark();
    const t2 = new ThemeFachDark("red");
    const t3 = new ThemeFachDark("yellow", "blue");
    expect(t1.backgroundColor).toBe("var(--sbb-header-lean-background-color)");
    expect(t1.backgroundStreckengraphikColor).toBe("var(--sbb-header-lean-background-color)");
    expect(t2.backgroundColor).toBe("red");
    expect(t2.backgroundStreckengraphikColor).toBe("var(--sbb-header-lean-background-color)");
    expect(t3.backgroundColor).toBe("yellow");
    expect(t3.backgroundStreckengraphikColor).toBe("blue");
  });

  it("ThemeFachPrint - test", () => {
    const t1 = new ThemeFachPrint();
    const t2 = new ThemeFachPrint("red");
    const t3 = new ThemeFachPrint("yellow", "blue");
    expect(t1.backgroundColor).toBe("whitesmoke");
    expect(t1.backgroundStreckengraphikColor).toBe("white");
    expect(t2.backgroundColor).toBe("red");
    expect(t2.backgroundStreckengraphikColor).toBe("white");
    expect(t3.backgroundColor).toBe("yellow");
    expect(t3.backgroundStreckengraphikColor).toBe("blue");
  });

  it("ThemeGray   - test", () => {
    const t1 = new ThemeGray();
    const t2 = new ThemeGray("red");
    const t3 = new ThemeGray("yellow", "blue");
    expect(t1.backgroundColor).toBe("white");
    expect(t1.backgroundStreckengraphikColor).toBe("white");
    expect(t2.backgroundColor).toBe("red");
    expect(t2.backgroundStreckengraphikColor).toBe("white");
    expect(t3.backgroundColor).toBe("yellow");
    expect(t3.backgroundStreckengraphikColor).toBe("blue");
  });

  it("ThemeGrayDark - test", () => {
    const t1 = new ThemeGrayDark();
    const t2 = new ThemeGrayDark("red");
    const t3 = new ThemeGrayDark("yellow", "blue");
    expect(t1.backgroundColor).toBe("var(--sbb-header-lean-background-color)");
    expect(t1.backgroundStreckengraphikColor).toBe("var(--sbb-header-lean-background-color)");
    expect(t2.backgroundColor).toBe("red");
    expect(t2.backgroundStreckengraphikColor).toBe("var(--sbb-header-lean-background-color)");
    expect(t3.backgroundColor).toBe("yellow");
    expect(t3.backgroundStreckengraphikColor).toBe("blue");
  });
});

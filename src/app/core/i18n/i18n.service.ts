import {Injectable} from "@angular/core";
import {registerLocaleData} from "@angular/common";
import {loadTranslations} from "@angular/localize";

@Injectable({
  providedIn: "root",
})
export class I18nService {
  readonly allowedLanguages = ["en", "fr", "de"];
  private currentLanguage: string = this.getLanguageFromStorage() || this.detectNavigatorLanguage();
  translations: any = {};

  get language(): string {
    return this.currentLanguage;
  }

  async setLanguage(language?: string) {
    if (language && this.allowedLanguages.includes(this.language)) {
      this.setLanguageToStorage(language);
      this.currentLanguage = language;
    }

    const languageModule = await import(
      /* webpackInclude: /(en|de|fr)\.mjs$/ */
      `/node_modules/@angular/common/locales/${this.language}.mjs`
    );
    registerLocaleData(languageModule.default);

    await this.loadTranslations();
  }

  private setLanguageToStorage(language: string) {
    localStorage.setItem("i18nLng", language);
  }

  private getLanguageFromStorage(): string | null {
    const lang = localStorage.getItem("i18nLng");
    return this.allowedLanguages.includes(lang) ? lang : null;
  }

  private detectNavigatorLanguage(): string {
    const navigatorLanguage = navigator.language.slice(0, 2);
    return this.allowedLanguages.includes(navigatorLanguage)
      ? navigatorLanguage
      : this.allowedLanguages[0];
  }

  async loadTranslations() {
    const languageTranslationsModule = await import(`src/assets/i18n/${this.language}.json`);

    this.translations = this.flattenTranslations(languageTranslationsModule.default);
    loadTranslations(this.translations);
  }

  // Helper function to flatten nested translations
  // nested JSON :
  // {
  //   "app": {
  //     "login": "Login",
  //     "models": {...}
  //   }
  // }
  // flattened JSON :
  // {
  //   "app.login": "Login",
  //   "app.models...": ...,
  //   "app.models...": ...
  // }
  private flattenTranslations(translations: any): any {
    const flattenedTranslations = {};

    function flatten(obj, prefix = "") {
      for (const key in obj) {
        if (typeof obj[key] === "string") {
          flattenedTranslations[prefix + key] = obj[key];
        } else if (typeof obj[key] === "object") {
          flatten(obj[key], prefix + key + ".");
        }
      }
    }

    flatten(translations);
    return flattenedTranslations;
  }

  // Used for the pipe and allowing parameters
  translate(key: string, params?: any): string {
    let translation = this.translations[key] || key;

    if (params) {
      Object.keys(params).forEach((param) => {
        translation = translation.replace(`{$${param}}`, params[param]);
      });
    }

    return translation;
  }
}

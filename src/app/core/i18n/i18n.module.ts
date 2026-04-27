import {NgModule, LOCALE_ID, inject, provideAppInitializer} from "@angular/core";
import {CommonModule} from "@angular/common";
import {TranslatePipe} from "./translate.pipe";
import {I18nService} from "./i18n.service";

@NgModule({
  declarations: [TranslatePipe], // Declare the pipe
  imports: [CommonModule],
  providers: [
    I18nService,
    provideAppInitializer(() => {
      const initializerFn = (
        (i18nService: I18nService) => () =>
          i18nService.setLanguage()
      )(inject(I18nService));
      return initializerFn();
    }),
    {
      // Set the runtime locale for the app
      provide: LOCALE_ID,
      useFactory: (i18nService: I18nService) => i18nService.language,
      deps: [I18nService],
    },
  ],
  exports: [TranslatePipe], // Export the pipe
})
export class I18nModule {}

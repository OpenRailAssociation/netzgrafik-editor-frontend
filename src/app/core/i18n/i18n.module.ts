import {NgModule, LOCALE_ID, APP_INITIALIZER} from "@angular/core";
import {CommonModule} from "@angular/common";
import {TranslatePipe} from "./translate.pipe";
import {I18nService} from "./i18n.service";

@NgModule({
  declarations: [TranslatePipe], // Declare the pipe
  imports: [CommonModule],
  providers: [
    I18nService,
    {
      provide: APP_INITIALIZER,
      useFactory: (i18nService: I18nService) => () => i18nService.setLanguage(),
      deps: [I18nService],
      multi: true,
    },
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

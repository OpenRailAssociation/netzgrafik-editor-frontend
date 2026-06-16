import {NgModule, LOCALE_ID, provideAppInitializer, inject} from "@angular/core";
import {CommonModule} from "@angular/common";
import {TranslatePipe} from "./translate.pipe";
import {I18nService} from "./i18n.service";

@NgModule({
  declarations: [TranslatePipe], // Declare the pipe
  imports: [CommonModule],
  providers: [
    I18nService,
    provideAppInitializer(() => {
      const dep0 = inject(I18nService);
      const initializerFactory = (i18nService: I18nService) => () => i18nService.setLanguage();
      const initializer = initializerFactory(dep0);
      return typeof initializer === "function" ? initializer() : initializer;
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

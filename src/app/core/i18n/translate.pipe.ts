import {Pipe, PipeTransform} from "@angular/core";
import {I18nService} from "./i18n.service";

@Pipe({
  name: "translate",
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  constructor(private i18nService: I18nService) {}

  transform(key: string, params?: any): string {
    return this.i18nService.translate(key, params);
  }
}

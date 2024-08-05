import {Component, Input, Output} from "@angular/core";
import {AuthService} from "./services/auth/auth.service";
import {TrainrunService} from "./services/data/trainrun.service";
import {TrainrunSectionService} from "./services/data/trainrunsection.service";
import {DataService} from "./services/data/data.service";
import {environment} from "../environments/environment";
import packageJson from "../../package.json";
import {Observable, merge} from "rxjs";
import {ProjectDto} from "./api/generated";
import {NetzgrafikDto} from "./data-structures/business.data.structures";
import {Operation} from "./models/operation.model";

@Component({
  selector: "sbb-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent {
  readonly disableBackend = environment.disableBackend;
  readonly version = packageJson.version;
  readonly locale = localStorage.getItem("locale");
  readonly environmentLabel = environment.label;
  readonly authenticated: Promise<unknown>;

  projectInMenu: Observable<ProjectDto | null>;

  allLocals = [
    {
      locale: "en",
      label: "🇬🇧 English",
      order: 1
    },
    {
      locale: "de",
      label: "🇩🇪 Deutsch",
      order: 2
    },
    /*
    {
      locale: "fr",
      label: "🇫🇷 Français",
      order: 3
    },
    {
      locale: "it",
      label: "🇮🇹 Italiano",
      order: 4
    }
    */
  ];

  get userName() {
    if (this.disableBackend) {
      return undefined;
    }
    return this.authService.claims?.name;
  }

  get email() {
    if (this.disableBackend) {
      return undefined;
    }
    return this.authService.claims?.email;
  }

  constructor(private authService: AuthService,
              private dataService: DataService,
              private trainrunService: TrainrunService,
              private trainrunSectionService: TrainrunSectionService) {
    if (!this.disableBackend) {
      this.authenticated = authService.initialized;
    }
    this.sortAllLocales();
  }

  logout() {
    if (!this.disableBackend) {
      this.authService.logOut();
    }
  }

  changeLocale(locale: string) {
    if (locale === this.locale) {
      return;
    }
    localStorage.setItem("locale", locale);
    location.reload();
    this.sortAllLocales();
  }

  getCurrentLocale(): string {
    return this.locale;
  }

  @Input()
  get netzgrafikDto() {
    return this.dataService.getNetzgrafikDto();
  }

  set netzgrafikDto(netzgrafikDto: NetzgrafikDto) {
    this.dataService.loadNetzgrafikDto(netzgrafikDto);
  }

  @Output()
  operation: Observable<Operation> = merge(this.trainrunService.operation, this.trainrunSectionService.operation);

  private sortAllLocales() {
    this.allLocals.sort((a, b) => a.order - b.order);
    const f = this.allLocals.find(a => a.locale === this.locale);
    this.allLocals = this.allLocals.filter(a => a.locale !== this.locale);
    this.allLocals.unshift(f);
  }
}

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
import {LabelService} from "./services/data/label.serivce";
import {NodeService} from "./services/data/node.service";
import {I18nService} from "./core/i18n/i18n.service";

@Component({
  selector: "sbb-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent {
  readonly disableBackend = environment.disableBackend;
  readonly version = packageJson.version;
  readonly environmentLabel = environment.label;
  readonly authenticated: Promise<unknown>;
  protected currentLanguage: string = this.i18nService.language;

  projectInMenu: Observable<ProjectDto | null>;

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
              private trainrunSectionService: TrainrunSectionService,
              private nodeService: NodeService,
              private labelService: LabelService,
              private i18nService: I18nService,
            ) {
    if (!this.disableBackend) {
      this.authenticated = authService.initialized;
    }
  }

  logout() {
    if (!this.disableBackend) {
      this.authService.logOut();
    }
  }

  @Input()
  get language() {
    return this.currentLanguage;
  }
  
  set language(language: string) {
    if (language !== this.currentLanguage) {
      this.i18nService.setLanguage(language);
      this.currentLanguage = language;
    }
  }

  @Input()
  get netzgrafikDto() {
    return this.dataService.getNetzgrafikDto();
  }

  set netzgrafikDto(netzgrafikDto: NetzgrafikDto) {
    this.dataService.loadNetzgrafikDto(netzgrafikDto);
  }

  @Output()
  operation: Observable<Operation> = merge(
    this.trainrunService.operation,
    this.trainrunSectionService.operation,
    this.nodeService.operation,
    this.labelService.operation,
  );
}

import {Component, Input, Output, OnInit} from "@angular/core";
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
import {LabelService} from "./services/data/label.service";
import {NodeService} from "./services/data/node.service";
import {I18nService} from "./core/i18n/i18n.service";
import {PositionTransformationService} from "./services/util/position.transformation.service";
import {NetzgrafikDefault} from "./sample-netzgrafik/netzgrafik.default";
import {UiInteractionService} from "./services/ui/ui.interaction.service";
import {NoteService} from "./services/data/note.service";

@Component({
  selector: "sbb-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements OnInit {
  readonly disableBackend = environment.disableBackend;
  readonly version = packageJson.version;
  readonly environmentLabel = environment.label;
  readonly authenticated: Promise<unknown>;
  protected currentLanguage: string = this.i18nService.language;
  private netzgrafikDtoIsSet = false;

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

  constructor(
    private authService: AuthService,
    private dataService: DataService,
    private uiInteractionService: UiInteractionService,
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private nodeService: NodeService,
    private positionTransformationService: PositionTransformationService,
    private labelService: LabelService,
    private i18nService: I18nService,
    private noteService: NoteService,
  ) {
    if (!this.disableBackend) {
      this.authenticated = authService.initialized;
    }
  }

  ngOnInit() {
    if (this.disableBackend && !this.netzgrafikDtoIsSet) {
      this.netzgrafikDto = NetzgrafikDefault.getDefaultNetzgrafik();
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
    this.netzgrafikDtoIsSet = true;
    this.dataService.loadNetzgrafikDto(netzgrafikDto, false);
    this.uiInteractionService.closeTrainrunDialog();
  }

  @Output()
  operation: Observable<Operation> = merge(
    this.trainrunService.operation,
    this.trainrunSectionService.operation,
    this.nodeService.operation,
    this.positionTransformationService.operation,
    this.labelService.operation,
    this.noteService.operation,
  );
}

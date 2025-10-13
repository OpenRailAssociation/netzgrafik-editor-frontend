import {Component} from "@angular/core";
import {DataService} from "../services/data/data.service";
import {UiInteractionService} from "../services/ui/ui.interaction.service";
import {map, takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {ActivatedRoute} from "@angular/router";
import {FilterWindowType} from "../view/filter-main-side-view/filter-main-side-view.component";
import {VersionControlService} from "../services/data/version-control.service";
import {NavigationParameters} from "../utils/navigation-parameters";
import {FilterService} from "../services/ui/filter.service";
import {DomSanitizer} from "@angular/platform-browser";
import {EditorMode} from "../view/editor-menu/editor-mode";
import {UndoService} from "../services/data/undo.service";
import {EditorView} from "../view/editor-main-view/data-views/editor.view";
import {environment} from "../../environments/environment";
import {NodeService} from "../services/data/node.service";

export enum IconSidebarMode {
  VARIANTEN = "varianten",
  FILTER = "filter",
  NONE = "none",
  PROPERTIES = "properties",
}

@Component({
  selector: "sbb-netzgrafik-editor",
  templateUrl: "./netzgrafik-application.component.html",
  styleUrls: ["./netzgrafik-application.component.scss"],
})
export class NetzgrafikApplicationComponent {
  mode = IconSidebarMode.NONE;
  expanded = false;

  readonly disableBackend = environment.disableBackend;

  private readonly destroyed = new Subject<void>();

  constructor(
    private dataService: DataService,
    private uiInteractionService: UiInteractionService,
    private filterService: FilterService,
    private readonly activatedRoute: ActivatedRoute,
    private readonly versionControlService: VersionControlService,
    private readonly undoService: UndoService,
    private readonly nodeService: NodeService,
    private sanitizer: DomSanitizer,
  ) {
    activatedRoute.params
      .pipe(
        map((params) => new NavigationParameters(params)),
        takeUntil(this.destroyed),
      )
      .subscribe((params) => {
        uiInteractionService.setEditorMode(EditorMode.NetzgrafikEditing);
        uiInteractionService.showNetzgrafik();
        const variantId = params.tryGetVariantId();
        if (variantId !== null) {
          versionControlService.load(variantId, true);
        }
        uiInteractionService.setViewboxProperties(
          EditorView.svgName,
          uiInteractionService.getDefaultViewProperties(),
        );
      });
  }

  getSidebarClassTag(): string {
    if (this.disableBackend) {
      return "disableBackend";
    }
    return "";
  }

  getVariantIsWritable(): boolean {
    return this.versionControlService.getVariantIsWritable();
  }

  onVariantenClicked() {
    this.uiInteractionService.showOrCloseFilter(FilterWindowType.VARIANT_INFO);
  }

  onFilterClicked() {
    this.uiInteractionService.showOrCloseFilter(FilterWindowType.EDITOR_FILTER);
  }

  onEditToolClicked() {
    this.uiInteractionService.showOrCloseFilter(FilterWindowType.EDIT_TOOLS);
  }

  onToolsClicked() {
    this.uiInteractionService.showOrCloseFilter(FilterWindowType.TOOLS);
  }

  onPropertiesClicked() {
    this.uiInteractionService.showOrCloseFilter(FilterWindowType.PROPERTIES);
  }

  setMode(mode: string) {
    this.mode = mode as IconSidebarMode;
  }

  getFilterStyle() {
    if (this.filterService.isAnyFilterActive()) {
      return this.sanitizer.bypassSecurityTrustStyle("color:red");
    }
    return this.sanitizer.bypassSecurityTrustStyle("");
  }

  getEditStyle() {
    if (this.uiInteractionService.getEditorMode() === EditorMode.MultiNodeMoving) {
      if (this.nodeService.getSelectedNodes().length > 0) {
        return this.sanitizer.bypassSecurityTrustStyle("color:red");
      }
    }
    return this.sanitizer.bypassSecurityTrustStyle("");
  }

  getFilterActivatedTag() {
    return this.getActivatedTag(FilterWindowType.EDITOR_FILTER);
  }

  getPropertiesActivatedTag() {
    return this.getActivatedTag(FilterWindowType.PROPERTIES);
  }

  getMoreFunctionActivatedTag() {
    return this.getActivatedTag(FilterWindowType.TOOLS);
  }

  getEditActivatedTag() {
    return this.getActivatedTag(FilterWindowType.EDIT_TOOLS);
  }

  getVariantsActivatedTag() {
    return this.getActivatedTag(FilterWindowType.VARIANT_INFO);
  }

  private getActivatedTag(type: FilterWindowType): string {
    if (this.uiInteractionService.isFilterWindowType(type)) {
      return "SideBarMainIcon sbb-active";
    }
    return "SideBarMainIcon";
  }
}

import {Component} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {SbbCheckbox} from "@sbb-esta/angular/checkbox";
import {SbbInput} from "@sbb-esta/angular/input";

import {NodeService} from "../../../services/data/node.service";
import {I18nModule} from "../../../core/i18n/i18n.module";
import {Node} from "../../../models/node.model";
import {DataService} from "../../../services/data/data.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {ConfirmationDialogParameter} from "../../dialogs/confirmation-dialog/confirmation-dialog.component";

function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

@Component({
  selector: "sbb-global-nodes-management",
  standalone: true,
  imports: [FormsModule, SbbCheckbox, SbbInput, I18nModule],
  templateUrl: "./global-nodes-management.component.html",
  styleUrl: "./global-nodes-management.component.scss",
})
export class GlobalNodesManagementComponent {
  query: string;
  allNodes: Node[];
  matchingNodes: Node[];

  constructor(
    private dataService: DataService,
    private nodeService: NodeService,
    private uiInteractionService: UiInteractionService,
  ) {
    this.query = "";
    this.allNodes = this.nodeService.getNodes();
    this.nodeService.nodes.subscribe((nodes) => this.updateState({nodes}));
  }

  updateState({nodes = this.allNodes, query = this.query}: {nodes?: Node[]; query?: string}) {
    // Save state locally
    this.query = query;
    this.allNodes = nodes;

    const normalizedQuery = normalizeStr(this.query);

    this.matchingNodes = normalizedQuery
      ? this.allNodes.filter(
          (node) =>
            normalizeStr(node.getFullName()).includes(normalizedQuery) ||
            normalizeStr(node.getBetriebspunktName()).includes(normalizedQuery),
        )
      : this.allNodes;
  }

  getGlobalCheckboxStatus(): boolean | undefined {
    let allCollapsed = true;
    let noneCollapsed = true;
    this.matchingNodes.every((node) => {
      const isCollapsed = node.getIsCollapsed();
      allCollapsed = allCollapsed && isCollapsed;
      noneCollapsed = noneCollapsed && !isCollapsed;

      // If both allCollapsed and noneCollapsed fail, stop iterating
      return allCollapsed || noneCollapsed;
    });

    if (allCollapsed) return false;
    if (noneCollapsed) return true;
    return undefined;
  }

  toggleIsCollapsed(node: Node, isCollapsed: boolean) {
    node.setIsCollapsed(isCollapsed);
    this.dataService.triggerViewUpdate();
  }
  onClickGlobalCheckbox(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const currentGlobalCheckboxStatus = this.getGlobalCheckboxStatus();
    const newCheckboxStatus = !currentGlobalCheckboxStatus;
    const newIsCollapsed = !newCheckboxStatus;

    const allNodesImpacted = this.allNodes.length === this.matchingNodes.length;
    const impactedNodesCount = this.matchingNodes.length;

    const apply = () => {
      this.matchingNodes.forEach((node) => {
        node.setIsCollapsed(newIsCollapsed);
      });
    };

    const dialogTitle = $localize`:@@app.view.editor-edit-tools-view-component.global-nodes-management:Global nodes management`;
    const dialogContent = newIsCollapsed
      ? allNodesImpacted
        ? $localize`:@@app.view.editor-edit-tools-view-component.confirm-collapse-all:Are you sure you want to collapse all nodes?`
        : $localize`:@@app.view.editor-edit-tools-view-component.confirm-collapse-matching:Are you sure you want to collapse the ${impactedNodesCount}:count: nodes matching "${this.query}:query:"?`
      : allNodesImpacted
        ? $localize`:@@app.view.editor-edit-tools-view-component.confirm-expand-all:Are you sure you want to expand all nodes?`
        : $localize`:@@app.view.editor-edit-tools-view-component.confirm-expand-matching:Are you sure you want to expand the ${impactedNodesCount}:count: nodes matching "${this.query}:query:"?`;
    const confirmationDialogParameter = new ConfirmationDialogParameter(dialogTitle, dialogContent);

    this.uiInteractionService
      .showConfirmationDiagramDialog(confirmationDialogParameter)
      .subscribe((confirmed: boolean) => {
        if (confirmed) apply();
      });
  }
}

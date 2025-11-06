import {Component} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {SbbCheckbox} from "@sbb-esta/angular/checkbox";
import {SbbInput} from "@sbb-esta/angular/input";

import {NodeService} from "../../../services/data/node.service";
import {I18nModule} from "../../../core/i18n/i18n.module";

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

  constructor(private nodeService: NodeService) {
    this.query = "";
  }

  toggleIsCollapsedOnAllVisibleNodes(newValue: boolean) {
    this.getVisibleNodes().forEach((node) => {
      node.setIsCollapsed(newValue);
    });
  }

  getVisibleNodes() {
    const allNodes = this.nodeService.getNodes();
    const normalizedQuery = normalizeStr(this.query);
    if (!normalizedQuery) return allNodes;

    return allNodes.filter(
      (node) =>
        normalizeStr(node.getFullName()).includes(normalizedQuery) ||
        normalizeStr(node.getBetriebspunktName()).includes(normalizedQuery),
    );
  }
  getGlobalCheckboxStatus(): boolean | undefined {
    let allCollapsed = true;
    let noneCollapsed = true;
    this.getVisibleNodes().every((node) => {
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
}

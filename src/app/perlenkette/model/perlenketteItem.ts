import {PerlenketteNode} from "./perlenketteNode";
import {PerlenketteSection} from "./perlenketteSection";

export interface PerlenketteItem {
  isPerlenketteNode(): boolean;

  getPerlenketteNode(): PerlenketteNode;

  isPerlenketteSection(): boolean;

  getPerlenketteSection(): PerlenketteSection;

  getIsCollapsed(): boolean;
}

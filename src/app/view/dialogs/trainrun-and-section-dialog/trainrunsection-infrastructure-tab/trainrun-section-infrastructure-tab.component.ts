import {Component, OnInit, ChangeDetectionStrategy} from "@angular/core";
import {TrainrunSection} from "../../../../models/trainrunsection.model";
import {Resource} from "../../../../models/resource.model";
import {ResourceService} from "../../../../services/data/resource.service";
import {TrainrunSectionService} from "../../../../services/data/trainrunsection.service";
import {
  createDefaultSectionInfrastructure,
  findSharedSectionResourceId,
  InfrastructureDataSource,
  SectionInfrastructureResource,
  SectionTrackClass,
} from "../../../../types/infrastructure-resource.types";

@Component({
  selector: "sbb-trainrun-section-infrastructure-tab",
  templateUrl: "./trainrun-section-infrastructure-tab.component.html",
  styleUrls: ["./trainrun-section-infrastructure-tab.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TrainrunSectionInfrastructureTabComponent implements OnInit {
  public selectedTrainrunSection: TrainrunSection;
  public sectionInfrastructure: SectionInfrastructureResource = createDefaultSectionInfrastructure();
  public readonly sectionTrackClasses = Object.values(SectionTrackClass);

  constructor(
    private resourceService: ResourceService,
    private trainrunSectionService: TrainrunSectionService,
  ) {}

  ngOnInit(): void {
    this.selectedTrainrunSection = this.trainrunSectionService.getSelectedTrainrunSection();
    this.sectionInfrastructure = this.getOrCreateSectionResource().getSectionInfrastructure();
  }

  onSectionInfrastructureChanged() {
    this.sectionInfrastructure = {
      ...this.sectionInfrastructure,
      source: InfrastructureDataSource.Manual,
      lastUpdatedAt: new Date().toISOString(),
    };
    this.resourceService.changeSectionInfrastructure(
      this.selectedTrainrunSection.getResourceId(),
      this.sectionInfrastructure,
    );
  }

  onSectionTrackClassChanged(trackClass: SectionTrackClass) {
    this.sectionInfrastructure.trackClass = trackClass;
    this.onSectionInfrastructureChanged();
  }

  isSectionInfrastructureInvalid(): boolean {
    return this.sectionInfrastructure.trackCount < 0 || this.sectionInfrastructure.maximumSpeedKph < 0;
  }

  private getOrCreateSectionResource(): Resource {
    const sourceNodeId = this.selectedTrainrunSection.getSourceNodeId();
    const targetNodeId = this.selectedTrainrunSection.getTargetNodeId();
    const sectionsOnSameEdge = this.trainrunSectionService
      .getTrainrunSections()
      .filter(
        (section) =>
          (section.getSourceNodeId() === sourceNodeId && section.getTargetNodeId() === targetNodeId) ||
          (section.getSourceNodeId() === targetNodeId && section.getTargetNodeId() === sourceNodeId),
      );
    const sharedResourceId = findSharedSectionResourceId(
      sectionsOnSameEdge.map((section) => ({
        sourceNodeId: section.getSourceNodeId(),
        targetNodeId: section.getTargetNodeId(),
        resourceId: section.getResourceId(),
      })),
      sourceNodeId,
      targetNodeId,
    );

    if (sharedResourceId !== undefined) {
      sectionsOnSameEdge.forEach((section) => section.setResourceId(sharedResourceId));
      this.trainrunSectionService.trainrunSectionsUpdated();
      return this.resourceService.getResource(sharedResourceId);
    }

    const resource = this.resourceService.createAndGetResource();
    resource.setSectionInfrastructure(createDefaultSectionInfrastructure());
    sectionsOnSameEdge.forEach((section) => section.setResourceId(resource.getId()));
    this.trainrunSectionService.trainrunSectionsUpdated();
    return resource;
  }
}
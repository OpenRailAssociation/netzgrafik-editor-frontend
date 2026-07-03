import {Trainrun} from "../models/trainrun.model";
import {Node} from "../models/node.model";
import {NetzgrafikDefault} from "../sample-netzgrafik/netzgrafik.default";
import {
  NetzgrafikDto,
  TrainrunCategory,
  TrainrunSectionDto,
} from "../data-structures/business.data.structures";
import {Note} from "../models/note.model";
import {LogService} from "../logger/log.service";

export class DataMigration {
  static getMinimalTurnaroundTime(): number {
    return 8;
  }

  static getNodeHeadwayStop(cat: TrainrunCategory): number {
    if (cat.shortName === "G") {
      return 3;
    }
    if (cat.shortName === "GEX") {
      return 3;
    }
    return 2;
  }

  static getNodeHeadwayNonStop(cat: TrainrunCategory): number {
    return this.getNodeHeadwayStop(cat);
  }

  static getSectionHeadway(cat: TrainrunCategory): number {
    // TODO -> this must be overorked - because on the section the headway view is more complicated
    // TODO -> than this very simplistic implementation.
    return this.getNodeHeadwayStop(cat);
  }

  static migrateNodeLabelIds(node: Node) {
    if (node.getLabelIds() === undefined) {
      node.setLabelIds([]);
    }
  }

  static migrateNoteLabelIds(note: Note) {
    if (note.getLabelIds() === undefined) {
      note.setLabelIds([]);
    }
  }

  static migrateTrainrunLabelIds(trainrun: Trainrun) {
    if (trainrun.getLabelIds() === undefined) {
      trainrun.setLabelIds([]);
    }
  }

  static migrateNetzgrafikDto(netzgrafikDto: NetzgrafikDto) {
    // Change of data structure requires this migration step: separation of coloring / line pattern
    const checkFirstElement = netzgrafikDto.metadata.trainrunTimeCategories.find(() => true);
    if (checkFirstElement !== undefined && checkFirstElement.linePatternRef === undefined) {
      netzgrafikDto.metadata.trainrunCategories =
        NetzgrafikDefault.getDefaultNetzgrafik().metadata.trainrunCategories;
      netzgrafikDto.metadata.trainrunFrequencies =
        NetzgrafikDefault.getDefaultNetzgrafik().metadata.trainrunFrequencies;
      netzgrafikDto.metadata.trainrunTimeCategories =
        NetzgrafikDefault.getDefaultNetzgrafik().metadata.trainrunTimeCategories;
    }
    const checkFirstFrequencyElement = netzgrafikDto.metadata.trainrunFrequencies.find(() => true);
    if (
      checkFirstFrequencyElement !== undefined &&
      checkFirstFrequencyElement.offset === undefined
    ) {
      netzgrafikDto.metadata.trainrunFrequencies =
        NetzgrafikDefault.getDefaultNetzgrafik().metadata.trainrunFrequencies;
    }

    if (netzgrafikDto.metadata.netzgrafikColors === undefined) {
      netzgrafikDto.metadata.netzgrafikColors =
        NetzgrafikDefault.getDefaultNetzgrafik().metadata.netzgrafikColors;
    }

    if (netzgrafikDto.metadata.analyticsSettings === undefined) {
      netzgrafikDto.metadata.analyticsSettings =
        NetzgrafikDefault.getDefaultNetzgrafik().metadata.analyticsSettings;
    }

    if (netzgrafikDto.freeFloatingTexts === undefined) {
      netzgrafikDto.freeFloatingTexts = NetzgrafikDefault.getDefaultNetzgrafik().freeFloatingTexts;
    }
    if (netzgrafikDto.labels === undefined) {
      netzgrafikDto.labels = NetzgrafikDefault.getDefaultNetzgrafik().labels;
    }
    if (netzgrafikDto.labelGroups === undefined) {
      netzgrafikDto.labelGroups = NetzgrafikDefault.getDefaultNetzgrafik().labelGroups;
    }
    if (netzgrafikDto.filterData === undefined) {
      netzgrafikDto.filterData = NetzgrafikDefault.getDefaultNetzgrafik().filterData;
    }

    netzgrafikDto.metadata.trainrunCategories.forEach((cat: TrainrunCategory) => {
      if (cat.minimalTurnaroundTime === undefined) {
        cat.minimalTurnaroundTime = DataMigration.getMinimalTurnaroundTime();
      }
      if (cat.nodeHeadwayStop === undefined) {
        cat.nodeHeadwayStop = DataMigration.getNodeHeadwayStop(cat);
      }
      if (cat.nodeHeadwayNonStop === undefined) {
        cat.nodeHeadwayNonStop = DataMigration.getNodeHeadwayNonStop(cat);
      }
      if (cat.sectionHeadway === undefined) {
        cat.sectionHeadway = DataMigration.getSectionHeadway(cat);
      }
    });
  }

  static sanitizeTrainrunSectionsWithSameSourceAndTargetNodes(
    netzgrafikDto: NetzgrafikDto,
    logger?: LogService,
  ) {
    // Ensures that all trainrun sections have different source and target nodes. This function is important
    // to maintain the relationship between the trainrun section and the nodes correctly and to
    // avoid errors.
    const errornousTrainrunSections: TrainrunSectionDto[] = [];
    netzgrafikDto.trainrunSections.forEach((trs) => {
      if (trs.sourceNodeId === trs.targetNodeId) {
        errornousTrainrunSections.push(trs);
      }
    });

    // delete all errornous trainrun sections with identical source and target nodes
    errornousTrainrunSections.forEach((trs) => {
      const node = netzgrafikDto.nodes.find(
        (n) => n.id === trs.sourceNodeId && n.id === trs.targetNodeId,
      );
      if (node) {
        const sectionPorts = node.ports
          .filter((p) => p.trainrunSectionId === trs.id)
          .map((p) => p.id);
        node.ports = node.ports.filter((p) => !sectionPorts.includes(p.id));
        node.transitions = node.transitions.filter(
          (t) => !sectionPorts.includes(t.port1Id) && !sectionPorts.includes(t.port2Id),
        );
      }
      netzgrafikDto.trainrunSections = netzgrafikDto.trainrunSections.filter(
        (t) => t.id !== trs.id,
      );
    });
    netzgrafikDto.trainruns = netzgrafikDto.trainruns.filter(
      (trainrun) =>
        netzgrafikDto.trainrunSections.find((trs) => trs.trainrunId === trainrun.id) !== undefined,
    );

    if (errornousTrainrunSections.length > 0) {
      const message = $localize`:@@app.services.data.data-service.deleted-trainrun-sections:Deleted ${errornousTrainrunSections.length} trainrun sections with identical source and target nodes. This was caused by a bug in an older version of the editor. Please check your Netzgrafik for correctness.`;
      logger?.error(message);
    }
  }
}

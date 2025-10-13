import {Injectable, OnDestroy} from "@angular/core";
import {DataService} from "./data.service";
import {
  FreeFloatingTextDto,
  NetzgrafikDto,
  NodeDto,
  TrainrunDto,
  TrainrunSectionDto,
} from "../../data-structures/business.data.structures";
import {Trainrun} from "../../models/trainrun.model";
import {FilterService} from "../ui/filter.service";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {TrainrunService} from "./trainrun.service";
import {TrainrunSectionService} from "./trainrunsection.service";
import {UndoService} from "./undo.service";
import {UiInteractionService} from "../ui/ui.interaction.service";
import {EditorMode} from "../../view/editor-menu/editor-mode";
import {NodeService} from "./node.service";
import {Node} from "../../models/node.model";
import {ConnectionDto, PortDto} from "../../data-structures/technical.data.structures";
import {NoteService} from "./note.service";
import {Note} from "../../models/note.model";

@Injectable({
  providedIn: "root",
})
export class CopyService implements OnDestroy {
  constructor(
    private readonly dataService: DataService,
    private readonly trainrunService: TrainrunService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly nodeService: NodeService,
    private readonly noteService: NoteService,
    private readonly filterService: FilterService,
    private readonly uiInteractionService: UiInteractionService,
    private readonly undoService: UndoService,
  ) {}

  ngOnDestroy() {
    this.resetLocalStorage();
  }

  public copyCurrentVisibleNetzgrafik(): NetzgrafikDto {
    const currentNetzgrafikJSON = JSON.stringify(this.dataService.getNetzgrafikDto());
    const copiedNetzgrafik: NetzgrafikDto = JSON.parse(currentNetzgrafikJSON);
    this.filterSelectedTrainrun(copiedNetzgrafik);
    this.filterTrainrun(copiedNetzgrafik);
    this.filterTrainrunSection(copiedNetzgrafik);
    this.filterNote(copiedNetzgrafik);
    this.filterMultiSelected(copiedNetzgrafik);
    this.removeEmptyTrainruns(copiedNetzgrafik);
    this.removeConnections(copiedNetzgrafik);
    this.saveCopiedDataToLocalStorage(copiedNetzgrafik);
    return copiedNetzgrafik;
  }

  private filterSelectedTrainrun(copiedNetzgrafik: NetzgrafikDto) {
    const selected: Trainrun = this.trainrunService.getSelectedTrainrun();
    if (selected !== null) {
      copiedNetzgrafik.freeFloatingTexts = [];
      copiedNetzgrafik.trainruns = copiedNetzgrafik.trainruns.filter(
        (t: TrainrunDto) => t.id === selected.getId(),
      );
      copiedNetzgrafik.trainrunSections = copiedNetzgrafik.trainrunSections.filter(
        (ts: TrainrunSectionDto) => ts.trainrunId === selected.getId(),
      );

      copiedNetzgrafik.nodes = copiedNetzgrafik.nodes.filter(
        (n: NodeDto) =>
          copiedNetzgrafik.trainrunSections.find(
            (ts: TrainrunSectionDto) => ts.targetNodeId === n.id || ts.sourceNodeId === n.id,
          ) !== undefined,
      );
    }
  }

  private filterTrainrun(copiedNetzgrafik: NetzgrafikDto) {
    const trainrunToRemove: TrainrunDto[] = [];
    copiedNetzgrafik.trainruns.forEach((trainrunDto: TrainrunDto) => {
      const trainrun: Trainrun = this.trainrunService.getTrainrunFromId(trainrunDto.id);
      if (!this.filterService.filterTrainrun(trainrun)) {
        trainrunToRemove.push(trainrunDto);
      }
    });
    trainrunToRemove.forEach((trainrunDto: TrainrunDto) => {
      copiedNetzgrafik.trainruns = copiedNetzgrafik.trainruns.filter(
        (data: TrainrunDto) => data.id !== trainrunDto.id,
      );
      copiedNetzgrafik.trainrunSections = copiedNetzgrafik.trainrunSections.filter(
        (data: TrainrunSectionDto) => data.trainrunId !== trainrunDto.id,
      );
    });
  }

  private filterTrainrunSection(copiedNetzgrafik: NetzgrafikDto) {
    const trainrunSectionToRemove: TrainrunSectionDto[] = [];
    copiedNetzgrafik.trainrunSections.forEach((trainrunSectionDto: TrainrunSectionDto) => {
      const trainrunSection: TrainrunSection = this.trainrunSectionService.getTrainrunSectionFromId(
        trainrunSectionDto.id,
      );
      if (!this.filterService.filterTrainrunsection(trainrunSection)) {
        trainrunSectionToRemove.push(trainrunSectionDto);
      }
    });
    trainrunSectionToRemove.forEach((trainrunSectionDto: TrainrunSectionDto) => {
      copiedNetzgrafik.trainrunSections = copiedNetzgrafik.trainrunSections.filter(
        (data: TrainrunSectionDto) => data.id !== trainrunSectionDto.id,
      );
    });
  }

  private filterNote(copiedNetzgrafik: NetzgrafikDto) {
    copiedNetzgrafik.freeFloatingTexts = copiedNetzgrafik.freeFloatingTexts.filter(
      (text: FreeFloatingTextDto) => {
        const note = this.noteService.getNoteFromId(text.id);
        return this.filterService.filterNote(note);
      },
    );
  }

  private filterMultiSelected(copiedNetzgrafik: NetzgrafikDto) {
    if (this.uiInteractionService.getEditorMode() === EditorMode.MultiNodeMoving) {
      // selected notes to copy
      const selNodes: Node[] = [];
      this.nodeService.getNodes().forEach((n: Node) => {
        if (n.selected()) {
          selNodes.push(n);
        }
      });
      copiedNetzgrafik.nodes = copiedNetzgrafik.nodes.filter(
        (n: NodeDto) => selNodes.find((sn: Node) => sn.getId() === n.id) !== undefined,
      );
      copiedNetzgrafik.trainrunSections = copiedNetzgrafik.trainrunSections.filter(
        (ts: TrainrunSectionDto) =>
          selNodes.find((sn: Node) => sn.getId() === ts.sourceNodeId) !== undefined &&
          selNodes.find((sn: Node) => sn.getId() === ts.targetNodeId) !== undefined,
      );

      // note (free floating texts
      copiedNetzgrafik.freeFloatingTexts = copiedNetzgrafik.freeFloatingTexts.filter(
        (text: FreeFloatingTextDto) => {
          const note: Note = this.noteService.getNoteFromId(text.id);
          if (note === undefined) {
            return false;
          }
          return note.selected();
        },
      );
    }
  }

  private removeEmptyTrainruns(copiedNetzgrafik: NetzgrafikDto) {
    copiedNetzgrafik.trainruns = copiedNetzgrafik.trainruns.filter(
      (t: TrainrunDto) =>
        copiedNetzgrafik.trainrunSections.find(
          (ts: TrainrunSectionDto) => ts.trainrunId === t.id,
        ) !== undefined,
    );
  }

  private removeConnections(copiedNetzgrafik: NetzgrafikDto) {
    copiedNetzgrafik.nodes.forEach((n: NodeDto) => {
      n.connections = n.connections.filter((c: ConnectionDto) => {
        const port1 = n.ports.find((p: PortDto) => p.id === c.port1Id);
        const port2 = n.ports.find((p: PortDto) => p.id === c.port2Id);

        const pts1 = copiedNetzgrafik.trainrunSections.find(
          (ts: TrainrunSectionDto) => port1.trainrunSectionId === ts.id,
        );
        const pts2 = copiedNetzgrafik.trainrunSections.find(
          (ts: TrainrunSectionDto) => port2.trainrunSectionId === ts.id,
        );
        return pts1 !== undefined && pts2 !== undefined;
      });
    });
  }

  public insertCopiedNetzgrafik() {
    const netzgrafik: NetzgrafikDto = this.loadCopiedDataFromLocalStorage();
    if (netzgrafik !== undefined) {
      this.undoService.pushCurrentVersion(true);
      this.dataService.insertCopyNetzgrafikDto(netzgrafik);
      this.nodeService.unselectAllNodes();
    }
  }

  resetLocalStorage() {
    this.saveCopiedDataToLocalStorage(undefined);
  }

  loadCopiedDataFromLocalStorage(): NetzgrafikDto {
    try {
      const serializedState = localStorage.getItem("CopyService");
      if (
        serializedState === null ||
        serializedState === undefined ||
        serializedState === "undefined"
      ) {
        return undefined;
      }
      const localStoredInfo = JSON.parse(serializedState);
      return localStoredInfo.netzgrafik;
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }

  private saveCopiedDataToLocalStorage(netzgrafik: NetzgrafikDto) {
    try {
      localStorage.setItem(
        "CopyService",
        JSON.stringify({
          netzgrafik: netzgrafik,
        }),
      );
    } catch (err) {
      console.error(err);
    }
  }
}

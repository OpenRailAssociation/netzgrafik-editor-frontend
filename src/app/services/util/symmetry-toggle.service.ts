import {Injectable} from "@angular/core";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {TrainrunSectionTimesService} from "../data/trainrun-section-times.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {UiInteractionService} from "../ui/ui.interaction.service";
import {TrainrunService} from "../data/trainrun.service";
import {TrainrunsectionHelper} from "./trainrunsection.helper";
import {
  SymmetryOn,
  SymmetryReference,
  SymmetrySelectionDialogParameter,
} from "../../view/dialogs/symmetry-selection-dialog/symmetry-selection-dialog.component";

@Injectable({
  providedIn: "root",
})
export class SymmetryToggleService {
  constructor(
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private uiInteractionService: UiInteractionService,
  ) {}

  onLeftNodeSymmetryToggleChanged(
    trainrunSection: TrainrunSection,
    trainrunSectionTimesService: TrainrunSectionTimesService,
    symmetry: boolean,
    revertToggleCallback: () => void,
  ) {
    // Symmetry -> Asymmetry and on/off case
    if (
      !symmetry ||
      trainrunSectionTimesService.areLeftAndRightTimeStructuresEqual(SymmetryOn.LeftNode)
    ) {
      trainrunSectionTimesService.onLeftNodeSymmetryChanged(
        symmetry,
        !TrainrunsectionHelper.isTargetRightOrBottom(trainrunSection),
      );
      return;
    }

    // Asymmetry -> Symmetry, show the dialog to choose symmetry reference
    this.showSymmetrySelectionDialog(SymmetryOn.LeftNode, trainrunSectionTimesService).then(
      (reference: SymmetryReference | null) => {
        if (!(reference in SymmetryReference)) {
          // User cancelled, need to revert toggle state
          revertToggleCallback();
          return;
        }
        trainrunSectionTimesService.onLeftNodeSymmetryChanged(
          symmetry,
          !TrainrunsectionHelper.isTargetRightOrBottom(trainrunSection),
          reference,
        );
      },
    );
  }

  onRightNodeSymmetryToggleChanged(
    trainrunSection: TrainrunSection,
    trainrunSectionTimesService: TrainrunSectionTimesService,
    symmetry: boolean,
    revertToggleCallback: () => void,
  ) {
    // Symmetry -> Asymmetry and on/off case
    if (
      !symmetry ||
      trainrunSectionTimesService.areLeftAndRightTimeStructuresEqual(SymmetryOn.RightNode)
    ) {
      trainrunSectionTimesService.onRightNodeSymmetryChanged(
        symmetry,
        !TrainrunsectionHelper.isTargetRightOrBottom(trainrunSection),
      );
      return;
    }

    // Asymmetry -> Symmetry, show the dialog to choose symmetry reference
    this.showSymmetrySelectionDialog(SymmetryOn.RightNode, trainrunSectionTimesService).then(
      (reference: SymmetryReference | null) => {
        if (!(reference in SymmetryReference)) {
          // User cancelled, need to revert toggle state
          revertToggleCallback();
          return;
        }
        trainrunSectionTimesService.onRightNodeSymmetryChanged(
          symmetry,
          !TrainrunsectionHelper.isTargetRightOrBottom(trainrunSection),
          reference,
        );
      },
    );
  }

  onTrainrunSymmetryToggleChanged(
    trainrunId: number,
    trainrunSectionTimesService: TrainrunSectionTimesService,
    revertToggleCallback: () => void,
  ) {
    if (trainrunSectionTimesService.areAllTimeStructuresEqual(trainrunId)) {
      trainrunSectionTimesService.onTrainrunSymmetryChanged(trainrunId);
      return;
    }
    this.showSymmetrySelectionDialog(SymmetryOn.Trainrun, trainrunSectionTimesService).then(
      (reference: SymmetryReference | null) => {
        if (!(reference in SymmetryReference)) {
          // User cancelled (user clicks Cancel / X / outside the dialog), don't enable symmetry
          revertToggleCallback();
          return;
        }
        trainrunSectionTimesService.onTrainrunSymmetryChanged(trainrunId, reference);
      },
    );
  }

  private showSymmetrySelectionDialog(
    symmetryOn: SymmetryOn,
    trainrunSectionTimesService: TrainrunSectionTimesService,
  ): Promise<SymmetryReference | null> {
    const parameter = new SymmetrySelectionDialogParameter(
      symmetryOn,
      this.trainrunService,
      this.trainrunSectionService,
      trainrunSectionTimesService,
    );

    return new Promise<SymmetryReference | null>((resolve) => {
      parameter.dialogFeedback.subscribe((result: SymmetryReference | null) => {
        resolve(result);
      });
      this.uiInteractionService.showSymmetrySelectionDialog(parameter);
    });
  }
}

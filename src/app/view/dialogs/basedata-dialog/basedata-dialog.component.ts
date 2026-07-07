import {Component, OnDestroy, TemplateRef, ViewChild} from "@angular/core";
import {TrainrunSectionService} from "../../../services/data/trainrunsection.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {SbbDialog, SbbDialogConfig} from "@sbb-esta/angular/dialog";
import {SbbTableDataSource} from "@sbb-esta/angular/table";
import {BaseData} from "../../../models/basedata.model";
import {HaltezeitFachCategories} from "../../../data-structures/business.data.structures";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";

@Component({
  selector: "sbb-base-data-dialog",
  templateUrl: "./basedata-dialog.component.html",
  styleUrls: ["./basedata-dialog.component.scss"],
  standalone: false,
})
export class BaseDataDialogComponent implements OnDestroy {
  @ViewChild("baseDataTemplate", {static: true})
  baseDataTemplate: TemplateRef<any>;
  public baseData: BaseData[] = [];
  displayedColumns: string[] = [
    "betriebspunktName",
    "stationName",
    "category",
    "region",
    "minimumStopTime_I_P_V",
    "passingThroughStation_I_P_V",
    "minimumStopTime_A",
    "passingThroughStation_A",
    "minimumStopTime_B",
    "passingThroughStation_B",
    "minimumStopTime_C",
    "passingThroughStation_C",
    "minimumStopTime_D",
    "passingThroughStation_D",
    "zaz",
    "connectionTime",
    "filterableLabels",
    "pos",
    "create",
  ];
  dataSource: SbbTableDataSource<any>;
  private destroyed = new Subject<void>();

  constructor(
    public dialog: SbbDialog,
    private trainrunSectionService: TrainrunSectionService,
    private uiInteractionService: UiInteractionService,
  ) {
    this.uiInteractionService.baseDataEditDialog
      .pipe(takeUntil(this.destroyed))
      .subscribe((baseData) => {
        this.openDialog(baseData);
      });
  }

  static getDialogConfig() {
    const dialogConfig = new SbbDialogConfig();
    const width = 1200;
    const height = 512;
    dialogConfig.width = width + "px";
    dialogConfig.minWidth = dialogConfig.width;
    dialogConfig.maxWidth = dialogConfig.width;
    dialogConfig.height = height + "px";
    dialogConfig.minHeight = dialogConfig.height;
    dialogConfig.maxHeight = dialogConfig.height;
    dialogConfig.panelClass = "";
    return dialogConfig;
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  openDialog(baseData: BaseData[]) {
    this.baseData = baseData;

    const baseDataConverted: Record<string, unknown>[] = [];
    this.baseData.forEach((std) => {
      baseDataConverted.push({
        betriebspunktName: std.getBetriebspunktName(),
        stationName: std.getStationName(),
        category: std.getCategories(),
        region: std.getRegions(),
        minimumStopTimeIPV: std.getHaltezeiten()[HaltezeitFachCategories.IPV],
        passingThroughStationIPV: std.getHaltezeiten()[HaltezeitFachCategories.IPV].no_halt ? 1 : 0,
        minimumStopTimeA: std.getHaltezeiten()[HaltezeitFachCategories.A],
        passingThroughStationA: std.getHaltezeiten()[HaltezeitFachCategories.A].no_halt ? 1 : 0,
        minimumStopTimeB: std.getHaltezeiten()[HaltezeitFachCategories.B],
        passingThroughStationB: std.getHaltezeiten()[HaltezeitFachCategories.B].no_halt ? 1 : 0,
        minimumStopTimeC: std.getHaltezeiten()[HaltezeitFachCategories.C],
        passingThroughStationC: std.getHaltezeiten()[HaltezeitFachCategories.C].no_halt ? 1 : 0,
        minimumStopTimeD: std.getHaltezeiten()[HaltezeitFachCategories.D],
        passingThroughStationD: std.getHaltezeiten()[HaltezeitFachCategories.D].no_halt ? 1 : 0,
        connectionTime: std.getConnectionTime(),
        zaz: std.getBufferTime(),
        filterableLabels: std.getLabels(),
        pos: std.getPosition(),
        create: std.getCreate(),
      });
    });

    this.dataSource = new SbbTableDataSource(baseDataConverted);
    const dialogConfig = BaseDataDialogComponent.getDialogConfig();
    const dialogRef = this.dialog.open(this.baseDataTemplate, dialogConfig);
  }
}

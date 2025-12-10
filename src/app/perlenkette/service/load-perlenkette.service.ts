import {Injectable, OnDestroy} from "@angular/core";
import {PerlenketteTrainrun} from "../model/perlenketteTrainrun";
import {PerlenketteNode} from "../model/perlenketteNode";
import {PerlenketteSection} from "../model/perlenketteSection";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {TrainrunService} from "../../services/data/trainrun.service";
import {Trainrun} from "../../models/trainrun.model";
import {GeneralViewFunctions} from "../../view/util/generalViewFunctions";
import {PerlenketteItem} from "../model/perlenketteItem";
import {TrainrunIterator} from "../../services/util/trainrun.iterator";
import {ConnectionValidator} from "../../services/util/connection.validator";
import {PerlenketteConnection} from "../model/perlenketteConnection";
import {Node} from "../../models/node.model";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {NodeService} from "../../services/data/node.service";
import {FilterService} from "../../services/ui/filter.service";
import {TrainrunSection} from "../../models/trainrunsection.model";

@Injectable({
  providedIn: "root",
})
export class LoadPerlenketteService implements OnDestroy {
  private readonly perlenketteTrainrunSubject = new BehaviorSubject<PerlenketteTrainrun>(undefined);
  private readonly perlenketteTrainrun$ = this.perlenketteTrainrunSubject.asObservable();

  private readonly destroyed$ = new Subject<void>();

  trainruns: Trainrun[];

  constructor(
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private nodeService: NodeService,
    private filterService: FilterService,
  ) {
    this.trainrunService.trainruns.pipe(takeUntil(this.destroyed$)).subscribe((trainruns) => {
      this.trainruns = trainruns;
      this.render();
    });

    this.trainrunSectionService.trainrunSections
      .pipe(takeUntil(this.destroyed$))
      .subscribe((trainrunsSection) => {
        this.render();
      });

    this.nodeService.transitions.pipe(takeUntil(this.destroyed$)).subscribe((transition) => {
      this.render();
    });

    this.nodeService.nodes.pipe(takeUntil(this.destroyed$)).subscribe((node) => {
      this.render();
    });

    this.nodeService.connections.pipe(takeUntil(this.destroyed$)).subscribe((connection) => {
      this.render();
    });
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  public render() {
    if (!this.trainruns) {
      return;
    }
    const selectedTrainrun: Trainrun = this.getSelectedTrainrun();
    if (selectedTrainrun) {
      const perlenketteTrainrun = this.getPerlenketteTrainrun(selectedTrainrun);
      this.perlenketteTrainrunSubject.next(perlenketteTrainrun);
    }
  }

  getPerlenketteData(): Observable<PerlenketteTrainrun> {
    return this.perlenketteTrainrun$;
  }

  getSelectedTrainrun(): Trainrun {
    let selectedTrainrun: Trainrun = undefined;
    if (this.trainruns) {
      this.trainruns.forEach((trainrun) => {
        if (trainrun.selected() && selectedTrainrun === undefined) {
          selectedTrainrun = trainrun;
        }
      });
    }
    return selectedTrainrun;
  }

  private getPerlenketteTrainrun(trainrun: Trainrun): PerlenketteTrainrun {
    return new PerlenketteTrainrun(
      trainrun.getId(),
      trainrun.getFrequency(),
      trainrun.getFrequencyOffset(),
      trainrun.getTrainrunTimeCategory(),
      trainrun.getTitle(),
      trainrun.getCategoryShortName(),
      trainrun.getCategoryColorRef(),
      this.getPerlenketteItem(trainrun),
      trainrun.getDirection(),
    );
  }

  private getPerlenketteItem(trainrun: Trainrun): PerlenketteItem[] {
    const perlenketteItem: PerlenketteItem[] = [];

    let allTrainrunSections = this.trainrunSectionService.getAllTrainrunSectionsForTrainrun(
      trainrun.getId(),
    );

    while (allTrainrunSections.length > 0) {
      // traverse over all trainrun parts
      const trainrunSection = allTrainrunSections[0];

      // filter all still visited trainrun sections
      allTrainrunSections = allTrainrunSections.filter(
        (ts) => ts.getId() !== trainrunSection.getId(),
      );

      const bothEndNodes = this.trainrunService.getBothEndNodesFromTrainrunPart(trainrunSection);
      const startForwardNode = GeneralViewFunctions.getLeftOrTopNode(
        bothEndNodes.endNode1,
        bothEndNodes.endNode2,
      );

      if (startForwardNode) {
        const startTrainrunSection = startForwardNode.getExtremityTrainrunSection(trainrun.getId());
        if (startTrainrunSection === undefined) {
          return perlenketteItem;
        }
        // Start Node
        perlenketteItem.push(
          new PerlenketteNode(
            startForwardNode.getId(),
            startForwardNode.getBetriebspunktName(),
            startForwardNode.getFullName(),
            startForwardNode.getConnectionTime(),
            this.getPerlenketteConnections(trainrun, startForwardNode),
            startForwardNode.getTransition(startTrainrunSection.getId()),
            true,
            false,
          ),
        );
        let lastNode = startForwardNode;
        const iterator: TrainrunIterator = this.trainrunService.getIterator(
          startForwardNode,
          startTrainrunSection,
        );

        let firstSection = true;
        while (iterator.hasNext()) {
          const currentTrainrunSectionNodePair = iterator.next();
          const trainrunSection = currentTrainrunSectionNodePair.trainrunSection;
          const node = currentTrainrunSectionNodePair.node;
          // Section X
          perlenketteItem.push(
            new PerlenketteSection(
              trainrunSection.getId(),
              trainrunSection.getTravelTime(),
              lastNode,
              node,
              trainrunSection.getNumberOfStops(),
              false,
              firstSection,
              false,
            ),
          );
          firstSection = false;

          // Node X
          perlenketteItem.push(
            new PerlenketteNode(
              node.getId(),
              node.getBetriebspunktName(),
              node.getFullName(),
              node.getConnectionTime(),
              this.getPerlenketteConnections(trainrun, node),
              node.getTransition(trainrunSection.getId()),
              false,
              false,
            ),
          );
          lastNode = node;

          // filter all still visited trainrun sections
          allTrainrunSections = allTrainrunSections.filter(
            (ts) => ts.getId() !== currentTrainrunSectionNodePair.trainrunSection.getId(),
          );
        }

        if (perlenketteItem.length > 1) {
          const itemSec = perlenketteItem[perlenketteItem.length - 2];
          if (itemSec.isPerlenketteSection()) {
            const pn = itemSec.getPerlenketteSection();
            pn.setLastTrainrunPartSection(true);
          }
          const itemNode = perlenketteItem[perlenketteItem.length - 1];
          if (itemNode.isPerlenketteNode()) {
            const pn = itemNode.getPerlenketteNode();
            pn.setLastTrainrunPartNode(true);
          }
        }
      }
    }
    return perlenketteItem;
  }

  private getPerlenketteConnections(trainrun: Trainrun, node: Node) {
    const perlenketteConnections: PerlenketteConnection[] = [];

    node.getConnections().forEach((connection) => {
      let port1 = node.getPort(connection.getPortId1());
      let port2 = node.getPort(connection.getPortId2());

      if (
        port1.getTrainrunSection().getTrainrunId() === trainrun.getId() ||
        port2.getTrainrunSection().getTrainrunId() === trainrun.getId()
      ) {
        // Handle only connection related to trainrun of interest!
        if (port2.getTrainrunSection().getTrainrunId() === trainrun.getId()) {
          const tmpPort1 = port1;
          port1 = port2;
          port2 = tmpPort1;
        }

        // filter connection
        if (!this.filterService.filterTrainrun(port2.getTrainrunSection().getTrainrun())) {
          return;
        }

        let terminalStation;
        let terminalStationBackward;
        if (node.getId() !== port2.getTrainrunSection().getTargetNode().getId()) {
          terminalStation = this.trainrunService
            .getEndNode(port2.getTrainrunSection().getSourceNode(), port2.getTrainrunSection())
            .getBetriebspunktName();
          terminalStationBackward = this.trainrunService
            .getEndNode(port2.getTrainrunSection().getTargetNode(), port2.getTrainrunSection())
            .getBetriebspunktName();
        } else if (node.getId() !== port2.getTrainrunSection().getSourceNode().getId()) {
          terminalStation = this.trainrunService
            .getEndNode(port2.getTrainrunSection().getTargetNode(), port2.getTrainrunSection())
            .getBetriebspunktName();
          terminalStationBackward = this.trainrunService
            .getEndNode(port2.getTrainrunSection().getSourceNode(), port2.getTrainrunSection())
            .getBetriebspunktName();
        }

        let beginningStation: Node = undefined;
        if (node.getId() !== port1.getTrainrunSection().getTargetNode().getId()) {
          beginningStation = this.trainrunService.getEndNode(
            port1.getTrainrunSection().getSourceNode(),
            port1.getTrainrunSection(),
          );
        } else if (node.getId() !== port1.getTrainrunSection().getSourceNode().getId()) {
          beginningStation = this.trainrunService.getEndNode(
            port1.getTrainrunSection().getTargetNode(),
            port1.getTrainrunSection(),
          );
        }

        // calculate real connection time
        const arrivalTime = node.getArrivalTime(port1.getTrainrunSection());
        let departureTime = node.getDepartureTime(port2.getTrainrunSection());
        if (departureTime < arrivalTime) {
          departureTime += 60;
        }
        let remainingTime = 24 * 3600;
        for (let freqOff1 = 0; freqOff1 < 8; freqOff1 += 1) {
          const freq1 = freqOff1 * port1.getTrainrunSection().getTrainrun().getFrequency();
          for (let freqOff2 = 0; freqOff2 < 8; freqOff2 += 1) {
            const freq2 = freqOff2 * port2.getTrainrunSection().getTrainrun().getFrequency();
            const d =
              departureTime +
              freq2 +
              port2.getTrainrunSection().getTrainrun().getTrainrunFrequency().offset;
            const a =
              arrivalTime +
              freq1 +
              port1.getTrainrunSection().getTrainrun().getTrainrunFrequency().offset;
            const delta = d - a;
            if (delta >= node.getConnectionTime()) {
              remainingTime = Math.min(remainingTime, delta);
            }
          }
        }

        const perlenketteConnection = new PerlenketteConnection(
          port2.getTrainrunSection().getTrainrun().getTitle(),
          port2.getTrainrunSection().getTrainrun().getCategoryShortName(),
          beginningStation.getBetriebspunktName(),
          beginningStation.getId(),
          terminalStation,
          terminalStationBackward,
          port2.getTrainrunSection().getTrainrun().getFrequency(),
          ConnectionValidator.validateConnection(connection, node),
          remainingTime,
          port2.getTrainrunSection().getTrainrun(),
          port2,
          connection.getId(),
          node.getId(),
          connection,
          node,
        );
        perlenketteConnections.push(perlenketteConnection);
      }
    });

    return perlenketteConnections;
  }
}

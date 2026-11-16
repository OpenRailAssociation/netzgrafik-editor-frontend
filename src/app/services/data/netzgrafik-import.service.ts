import {Injectable} from "@angular/core";
import {Direction, NetzgrafikDto, NodeDto} from "../../data-structures/business.data.structures";
import {LogService} from "../../logger/log.service";
import {FilterService} from "../ui/filter.service";
import {UiInteractionService} from "../ui/ui.interaction.service";
import {TrainrunSectionValidator} from "../util/trainrunsection.validator";
import {DataService} from "./data.service";
import {NodeService} from "./node.service";
import {ResourceService} from "./resource.service";
import {TrainrunService} from "./trainrun.service";
import {TrainrunSectionService} from "./trainrunsection.service";

/** Name of the URL fragment parameter holding a compressed Netzgrafik JSON to import on startup. */
export const FRAGMENT_PARAMETER = "netzgrafik";

/**
 * Returns the encoded Netzgrafik of a URL fragment such as `#netzgrafik=<data>`, or null.
 * `<data>` is the Netzgrafik JSON, compressed with deflate-raw and encoded as base64url.
 * The fragment is never sent to a server, so a link can carry a whole Netzgrafik without any
 * hosting, CORS or Content-Security-Policy changes.
 */
export function getFragmentNetzgrafik(hash: string): string | null {
  const value = new URLSearchParams(hash.replace(/^#/, "")).get(FRAGMENT_PARAMETER);
  return value ? value : null;
}

const base64UrlToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Decodes the `<data>` of `#netzgrafik=<data>` into the Netzgrafik JSON text. */
export async function decodeNetzgrafikFragment(value: string): Promise<string> {
  const stream = new Blob([base64UrlToBytes(value)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

/** Encodes a Netzgrafik JSON text for `#netzgrafik=<data>` (inverse of decodeNetzgrafikFragment). */
export async function encodeNetzgrafikFragment(json: string): Promise<string> {
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return bytesToBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()));
}

/** Imports Netzgrafik JSON (Netzgrafik-Editor exports as well as 3rd-party generated JSON). */
@Injectable({
  providedIn: "root",
})
export class NetzgrafikImportService {
  constructor(
    private dataService: DataService,
    private nodeService: NodeService,
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private resourceService: ResourceService,
    private filterService: FilterService,
    private uiInteractionService: UiInteractionService,
    private logger: LogService,
  ) {}

  /** Whether the value has the top-level structure of a Netzgrafik JSON. */
  static isNetzgrafikDto(value: unknown): value is NetzgrafikDto {
    return (
      typeof value === "object" &&
      value !== null &&
      "nodes" in value &&
      "trainrunSections" in value &&
      "trainruns" in value &&
      "resources" in value &&
      "metadata" in value
    );
  }

  /**
   * Parses and imports a Netzgrafik JSON string. Logs an error and returns false if the text is
   * not a Netzgrafik JSON.
   */
  importNetzgrafikJson(text: string): boolean {
    let netzgrafikDto: unknown;
    try {
      netzgrafikDto = JSON.parse(text);
    } catch {
      netzgrafikDto = undefined;
    }
    if (!NetzgrafikImportService.isNetzgrafikDto(netzgrafikDto)) {
      const msg = $localize`:@@app.view.editor-side-view.editor-tools-view-component.import-netzgrafik-error:JSON error`;
      this.logger.error(msg);
      return false;
    }
    this.importNetzgrafikDto(netzgrafikDto);
    return true;
  }

  /**
   * Imports the Netzgrafik of a `#netzgrafik=<data>` URL fragment (see getFragmentNetzgrafik).
   * Logs an error and returns false if it cannot be decoded or is not a Netzgrafik JSON.
   */
  async importNetzgrafikFromFragment(value: string): Promise<boolean> {
    let text: string;
    try {
      text = await decodeNetzgrafikFragment(value);
    } catch (e) {
      const msg = $localize`:@@app.view.editor-side-view.editor-tools-view-component.import-netzgrafik-error:JSON error`;
      this.logger.error(msg, e);
      return false;
    }
    return this.importNetzgrafikJson(text);
  }

  /** Imports a parsed Netzgrafik JSON, replacing the current Netzgrafik. */
  importNetzgrafikDto(netzgrafikDto: NetzgrafikDto) {
    // prepare JSON import
    this.uiInteractionService.showNetzgrafik();
    this.uiInteractionService.closeNodeBaseData();
    this.uiInteractionService.closePerlenkette();
    this.uiInteractionService.resetEditorMode();
    this.nodeService.unselectAllNodes();

    // import data
    if (
      netzgrafikDto.trainrunSections.length === 0 ||
      !this.detectNetzgrafikJSON3rdParty(netzgrafikDto)
    ) {
      // -----------------------------------------------
      // Default: Netzgrafik-Editor exported JSON
      // -----------------------------------------------
      this.dataService.loadNetzgrafikDto(netzgrafikDto);
      // -----------------------------------------------
    } else {
      // -----------------------------------------------
      // 3rd Party: Netzgrafik-Editor exported JSON
      // -----------------------------------------------
      this.processNetzgrafikJSON3rdParty(netzgrafikDto);
    }

    // recompute viewport
    this.uiInteractionService.viewportCenteringOnNodesBoundingBox();
  }

  private detectNetzgrafikJSON3rdParty(netzgrafikDto: NetzgrafikDto): boolean {
    return (
      netzgrafikDto.nodes.find((n: NodeDto) => n.ports === undefined) !== undefined ||
      netzgrafikDto.nodes.filter((n: NodeDto) => n.ports?.length === 0).length ===
        netzgrafikDto.nodes.length
    );
  }
  private processNetzgrafikJSON3rdParty(netzgrafikDto: NetzgrafikDto) {
    // --------------------------------------------------------------------------------
    // 3rd party generated JSON detected
    // --------------------------------------------------------------------------------
    const msg = $localize`:@@app.view.editor-side-view.editor-tools-view-component.import-netzgrafik-as-json-info-3rd-party:3rd party import`;
    this.logger.info(msg);

    // --------------------------------------------------------------------------------
    // (Step 1) Import only nodes
    const netzgrafikOnlyNodeDto: NetzgrafikDto = Object.assign({}, netzgrafikDto);
    netzgrafikOnlyNodeDto.trainruns = [];
    netzgrafikOnlyNodeDto.trainrunSections = [];
    this.dataService.loadNetzgrafikDto(netzgrafikOnlyNodeDto);

    // (Step 2) Import nodes and trainrunSectiosn by trainrun inseration (copy => create)
    this.dataService.insertCopyNetzgrafikDto(netzgrafikDto, false);

    // step(3) Check whether a transitions object was given when not
    //         departureTime - arrivatelTime == 0 => non-stop
    this.nodeService.getNodes().forEach((n) => {
      n.getTransitions().forEach((trans) => {
        const p1 = n.getPort(trans.getPortId1());
        const p2 = n.getPort(trans.getPortId2());
        let arrivalTime = p1.getTrainrunSection().getTargetArrival();
        if (p1.getTrainrunSection().getSourceNodeId() === n.getId()) {
          arrivalTime = p1.getTrainrunSection().getSourceArrival();
        }
        let departureTime = p2.getTrainrunSection().getTargetDeparture();
        if (p2.getTrainrunSection().getSourceNodeId() === n.getId()) {
          departureTime = p2.getTrainrunSection().getSourceDeparture();
        }
        trans.setIsNonStopTransit(arrivalTime - departureTime === 0);
      });

      const res = this.resourceService.createAndGetResource(false);
      n.setResourceId(res.getId());
    });

    // step(4) Migrate 3rd party imported trainruns/node/resource to ensure direction is set
    this.dataService.ensureAllResourcesLinkedToNetzgrafikObjects();
    this.trainrunService.getTrainruns().forEach((t) => {
      const currentDirection = t.getDirection();
      if (currentDirection === undefined) {
        t.setDirection(Direction.ROUND_TRIP);
      }
    });

    // step(5) Recalc/propagate consecutive times
    this.trainrunService.propagateInitialConsecutiveTimes();

    // step(6) Validate all trainrun sections
    this.trainrunSectionService.getTrainrunSections().forEach((ts) => {
      TrainrunSectionValidator.validateOneSection(ts);
      TrainrunSectionValidator.validateTravelTime(ts, this.filterService.getTimeDisplayPrecision());
    });
  }
}

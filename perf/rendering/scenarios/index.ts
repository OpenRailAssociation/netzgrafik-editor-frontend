import type {Scenario} from "../lib/measure.ts";
import {load} from "./load.ts";
import {select} from "./select.ts";
import {panDense} from "./pan-dense.ts";
import {zoomOutIn} from "./zoom-out-in.ts";
import {panOverview} from "./pan-overview.ts";
import {panEmpty} from "./pan-empty.ts";

export const SCENARIOS: Scenario[] = [load, select, panDense, zoomOutIn, panOverview, panEmpty];

import type {Scenario} from "../lib/types.ts";
import {load} from "./load.ts";
import {zoomOutIn} from "./zoom-out-in.ts";
import {panEmpty} from "./pan-empty.ts";
import {panOverview} from "./pan-overview.ts";
import {panDense} from "./pan-dense.ts";

export const SCENARIOS: Scenario[] = [load, zoomOutIn, panEmpty, panOverview, panDense];

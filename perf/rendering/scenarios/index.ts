import type {Scenario} from "../lib/types.ts";
import {load} from "./load.ts";
import {zoomOutIn} from "./zoom-out-in.ts";

export const SCENARIOS: Scenario[] = [load, zoomOutIn];

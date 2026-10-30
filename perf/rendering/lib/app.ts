import type {Page} from "playwright";
import {settle} from "./gestures.ts";

export const injectDataset = (page: Page, dataset: unknown) =>
  page.evaluate((dto) => {
    const root = document.querySelector("sbb-root") as unknown as {netzgrafikDto: unknown};
    root.netzgrafikDto = dto;
  }, dataset);

export const loadDataset = async (page: Page, dataset: unknown) => {
  await injectDataset(page, dataset);
  await settle(page);
};

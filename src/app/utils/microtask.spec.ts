import {batchToMicrotask} from "./microtask";

describe("batchToMicrotask", () => {
  it("runs fn once at the end of the task when called multiple times at once", async () => {
    let calls = 0;
    const batched = batchToMicrotask(() => calls++);

    batched();
    batched();
    batched();
    const callsBeforeFlush = calls;
    await Promise.resolve();
    const callsAfterFirstFlush = calls;

    batched();
    await Promise.resolve();

    expect({callsBeforeFlush, callsAfterFirstFlush, calls}).toEqual({
      callsBeforeFlush: 0,
      callsAfterFirstFlush: 1,
      calls: 2,
    });
  });
});

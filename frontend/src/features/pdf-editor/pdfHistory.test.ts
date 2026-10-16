import { describe, expect, it } from "vitest";
import { commitHistory, redoHistory, undoHistory } from "./pdfHistory";

describe("edit history", () => {
  it("restores an undone edit with redo", () => {
    const added = commitHistory<string[]>([], [], [], ["text"]);
    const undone = undoHistory(added.history, added.future, added.current);
    expect(undone.current).toEqual([]);
    const redone = redoHistory(undone.history, undone.future, undone.current);
    expect(redone.current).toEqual(["text"]);
  });
});

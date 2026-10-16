import { describe, expect, it } from "vitest";
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, StandardFonts } from "pdf-lib";
import { embeddedFontNames, exportEditedPdf, moveEdit, type PdfEdit } from "./pdfExport";
import { deletePage, movePage, type EditorPage } from "./pdfPages";

function visibleText(stream: string) {
  return stream.replace(/<([0-9A-Fa-f]+)>/g, (_, hex: string) => {
    let text = "";
    for (let index = 0; index < hex.length; index += 2) {
      text += String.fromCharCode(Number.parseInt(hex.slice(index, index + 2), 16));
    }
    return text;
  });
}

function copyBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function streamText(pdf: PDFDocument, index: number): string {
  const contents = pdf.getPage(index).node.Contents();
  if (!contents) return "";
  const items = contents instanceof PDFArray ? contents.asArray() : [contents];
  return items.map((item) => {
    const looked = pdf.context.lookup(item);
    if (!(looked instanceof PDFRawStream)) return "";
    const decoded = decodePDFRawStream(looked).decode();
    return new TextDecoder().decode(decoded);
  }).join("\n");
}

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function blankPdf(labels: string[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  labels.forEach((label) => {
    const page = pdf.addPage([200, 200]);
    page.drawText(label, { x: 20, y: 100, size: 12, font });
  });
  return pdf.save();
}

describe("exportEditedPdf", () => {
  it("exports moved bold text with the bold standard font", async () => {
    const original = await blankPdf(["Page"]);
    const edit: PdfEdit = {
      id: "t1",
      kind: "text",
      pageId: "p1",
      text: "Hello",
      x: 10,
      y: 10,
      fontSize: 12,
      color: "#000000",
      embedFont: "Helvetica",
      bold: false,
    };
    const moved = moveEdit({ ...edit, bold: true }, 40, 80);
    const bytes = await exportEditedPdf(copyBuffer(original), [moved], [{ id: "p1", sourceIndex: 0, rotation: 0 }]);
    const pdf = await PDFDocument.load(bytes);
    const text = streamText(pdf, 0);
    expect(text).toContain("1 0 0 1 40 80 Tm");
    expect(text).not.toContain("1 0 0 1 10 10 Tm");
    const names = await embeddedFontNames(copyBuffer(bytes), 0);
    expect(names.some((name) => name.includes("Bold"))).toBe(true);
  });

  it("includes a PNG image edit", async () => {
    const original = await blankPdf(["Page"]);
    const edit: PdfEdit = {
      id: "img",
      kind: "image",
      pageId: "p1",
      x: 30,
      y: 30,
      width: 20,
      height: 20,
      bytesBase64: PNG,
      mime: "image/png",
    };
    const bytes = await exportEditedPdf(copyBuffer(original), [edit], [{ id: "p1", sourceIndex: 0, rotation: 0 }]);
    const pdf = await PDFDocument.load(bytes);
    const resources = pdf.getPage(0).node.Resources();
    const xobject = resources?.lookup(PDFName.of("XObject"), PDFDict);
    expect(xobject).toBeInstanceOf(PDFDict);
  });

  it("drops a deleted page and exports the remaining pages in the new order", async () => {
    const original = await blankPdf(["ONE", "TWO", "THREE"]);
    let pages: EditorPage[] = [
      { id: "a", sourceIndex: 0, rotation: 0 },
      { id: "b", sourceIndex: 1, rotation: 0 },
      { id: "c", sourceIndex: 2, rotation: 0 },
    ];
    pages = deletePage(pages, "b");
    pages = movePage(pages, 1, -1);
    const bytes = await exportEditedPdf(copyBuffer(original), [], pages);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    expect(visibleText(streamText(pdf, 0))).toContain("THREE");
    expect(visibleText(streamText(pdf, 1))).toContain("ONE");
  });
});

import { degrees, PDFDict, PDFDocument, PDFName, StandardFonts, rgb } from "pdf-lib";
import { cleanFontFamily, hexToRgb, type EmbedFont } from "./pdfText";
import type { EditorPage } from "./pdfPages";

export type PdfEdit =
  | {
      id: string;
      kind: "replace";
      pageId: string;
      runId: string;
      text: string;
      x: number;
      y: number;
      width: number;
      fontSize: number;
      color: string;
      embedFont: EmbedFont;
      detectedFamily: string;
      bold: boolean;
    }
  | {
      id: string;
      kind: "text";
      pageId: string;
      text: string;
      x: number;
      y: number;
      fontSize: number;
      color: string;
      embedFont: EmbedFont;
      bold: boolean;
    }
  | {
      id: string;
      kind: "whiteout";
      pageId: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      id: string;
      kind: "image";
      pageId: string;
      x: number;
      y: number;
      width: number;
      height: number;
      bytesBase64: string;
      mime: "image/png" | "image/jpeg";
    };

export function moveEdit<T extends { x: number; y: number }>(edit: T, x: number, y: number): T {
  return { ...edit, x, y };
}

export async function embeddedFontNames(data: ArrayBuffer, pageIndex: number): Promise<string[]> {
  const pdf = await PDFDocument.load(data);
  const page = pdf.getPages()[pageIndex];
  const resources = page?.node.Resources();
  const fonts = resources?.lookupMaybe(PDFName.of("Font"), PDFDict);
  if (!fonts) return [];
  const names: string[] = [];
  for (const [, value] of fonts.entries()) {
    const font = pdf.context.lookup(value);
    if (!(font instanceof PDFDict)) continue;
    const base = font.get(PDFName.of("BaseFont"));
    if (!base) continue;
    const raw = "decodeText" in base && typeof base.decodeText === "function" ? base.decodeText() : String(base);
    names.push(cleanFontFamily(raw));
  }
  return names;
}

function toWinAnsi(text: string): string {
  return Array.from(text)
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code >= 32 && code <= 255 ? char : "?";
    })
    .join("");
}

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function exportEditedPdf(original: ArrayBuffer, edits: PdfEdit[], pages: EditorPage[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(original);
  const pdf = await PDFDocument.create();
  const order = pages.length
    ? pages
    : src.getPages().map((_, sourceIndex) => ({ id: String(sourceIndex), sourceIndex, rotation: 0 }));
  const copied = order.length ? await pdf.copyPages(src, order.map((page) => page.sourceIndex)) : [];
  const fonts = {
    Times: await pdf.embedFont(StandardFonts.TimesRoman),
    "Times-bold": await pdf.embedFont(StandardFonts.TimesRomanBold),
    Helvetica: await pdf.embedFont(StandardFonts.Helvetica),
    "Helvetica-bold": await pdf.embedFont(StandardFonts.HelveticaBold),
    Courier: await pdf.embedFont(StandardFonts.Courier),
    "Courier-bold": await pdf.embedFont(StandardFonts.CourierBold),
  };
  const indexById = new Map(order.map((page, index) => [page.id, index]));
  copied.forEach((page) => {
    pdf.addPage(page);
  });

  for (const edit of edits) {
    const pageIndex = indexById.get(edit.pageId);
    if (pageIndex === undefined) continue;
    const page = pdf.getPages()[pageIndex];
    if (!page) continue;
    if (edit.kind === "whiteout") {
      page.drawRectangle({
        x: edit.x,
        y: edit.y,
        width: Math.max(edit.width, 1),
        height: Math.max(edit.height, 1),
        color: rgb(1, 1, 1),
      });
      continue;
    }
    if (edit.kind === "image") {
      const bytes = decodeBase64(edit.bytesBase64);
      const image = edit.mime === "image/jpeg" ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
      page.drawImage(image, {
        x: edit.x,
        y: edit.y,
        width: Math.max(edit.width, 1),
        height: Math.max(edit.height, 1),
      });
      continue;
    }
    if (edit.kind === "replace") {
      page.drawRectangle({
        x: edit.x - 1,
        y: edit.y - edit.fontSize * 0.25,
        width: edit.width + 2,
        height: edit.fontSize * 1.25,
        color: rgb(1, 1, 1),
      });
    }
    const text = toWinAnsi(edit.text);
    if (!text) continue;
    const color = hexToRgb(edit.color);
    const font = fonts[edit.bold ? `${edit.embedFont}-bold` : edit.embedFont];
    page.drawText(text, {
      x: edit.x,
      y: edit.y,
      size: edit.fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
    });
  }

  order.forEach((info, index) => {
    const page = pdf.getPages()[index];
    if (!page || !info.rotation) return;
    const angle = (page.getRotation().angle + info.rotation) % 360;
    page.setRotation(degrees(angle));
  });
  return pdf.save();
}

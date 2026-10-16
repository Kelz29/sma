import { getDocument, GlobalWorkerOptions, OPS } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { colorsFromOperators, detectTextRuns, type FillOps, type TextRun } from "./pdfText";

GlobalWorkerOptions.workerSrc = workerUrl;

export const fillOps: FillOps = {
  setFillRGBColor: OPS.setFillRGBColor,
  setFillGray: OPS.setFillGray,
  setFillCMYKColor: OPS.setFillCMYKColor,
  setFillColor: OPS.setFillColor,
  showText: OPS.showText,
  showSpacedText: OPS.showSpacedText,
  nextLineShowText: OPS.nextLineShowText,
  nextLineSetSpacingShowText: OPS.nextLineSetSpacingShowText,
};

export type PdfViewport = {
  width: number;
  height: number;
  scale: number;
  convertToViewportPoint: (x: number, y: number) => number[];
  convertToPdfPoint: (x: number, y: number) => number[];
};

type PdfPage = {
  rotate?: number;
  getViewport: (params: { scale: number; rotation?: number }) => PdfViewport;
  getTextContent: () => Promise<{ items: Array<{ str?: string; transform?: number[]; width?: number; fontName?: string }>; styles?: Record<string, { fontFamily?: string }> }>;
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }>;
  render: (params: { canvasContext: CanvasRenderingContext2D; canvas: HTMLCanvasElement; viewport: PdfViewport }) => { promise: Promise<void> };
};

export type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};

export async function openPdf(data: Uint8Array): Promise<PdfDocument> {
  const doc = await getDocument({ data }).promise;
  return {
    numPages: doc.numPages,
    getPage: (pageNumber) => doc.getPage(pageNumber) as unknown as Promise<PdfPage>,
    destroy: async () => {
      const closer = doc as unknown as { destroy?: () => Promise<void> | void };
      await closer.destroy?.();
    },
  };
}

export async function readPageRuns(page: PdfPage): Promise<TextRun[]> {
  const content = await page.getTextContent();
  const operators = await page.getOperatorList();
  const colors = colorsFromOperators(operators.fnArray, operators.argsArray, fillOps);
  return detectTextRuns(content, colors);
}

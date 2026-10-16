import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { trackAction } from "@/features/telemetry/track";
import { openPdf, readPageRuns, type PdfDocument, type PdfViewport } from "../loadPdf";
import { commitHistory, redoHistory, undoHistory } from "../pdfHistory";
import { embeddedFontNames, exportEditedPdf, type PdfEdit } from "../pdfExport";
import { createPages, deletePage, movePage, rotatePage, type EditorPage } from "../pdfPages";
import { findTextMatches, preferEmbeddedFamily, type TextRun } from "../pdfText";

type PdfTheme = "classic" | "modern" | "minimal" | "elegant" | "bold" | "professional";
type PdfDoctype = "invoice" | "quotation";
type Tool = "select" | "text" | "whiteout";

type InvoiceOption = {
  id: number;
  invoice_number: number;
  customer_name: string;
  description?: string | null;
};

type Box = {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
  selected: boolean;
  replaced: boolean;
};

type DragEdit = {
  id: string;
  originX: number;
  originY: number;
  startPdfX: number;
  startPdfY: number;
  snapshot: PdfEdit[];
};

const inputClass =
  "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100";

function newId() {
  return crypto.randomUUID();
}

function editBox(edit: PdfEdit, viewport: PdfViewport) {
  if (edit.kind === "whiteout" || edit.kind === "image") {
    const [x1, y1] = viewport.convertToViewportPoint(edit.x, edit.y);
    const [x2, y2] = viewport.convertToViewportPoint(edit.x + edit.width, edit.y + edit.height);
    return {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }
  const [x, y] = viewport.convertToViewportPoint(edit.x, edit.y);
  const size = edit.fontSize * viewport.scale;
  const estimated = Math.max(edit.text.length, 1) * edit.fontSize * 0.55;
  const textWidth = edit.kind === "replace" ? Math.max(edit.width, estimated) : estimated;
  return {
    left: x,
    top: y - size,
    width: Math.max(textWidth * viewport.scale, 8),
    height: size * 1.2,
  };
}

function cssFamily(embedFont: string): string {
  if (embedFont === "Times") return "Times, 'Times New Roman', serif";
  if (embedFont === "Courier") return "'Courier New', Courier, monospace";
  return "Helvetica, Arial, sans-serif";
}

function SignaturePad({ onCancel, onSave }: { onCancel: () => void; onSave: (pngBase64: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = "#111827";
      context.lineWidth = 2;
      context.lineCap = "round";
    } catch {
      // jsdom has no canvas implementation.
    }
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const base64 = url.split(",")[1] ?? "";
    if (base64) onSave(base64);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-label="Draw a signature">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-4 shadow-xl">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Draw a signature</h2>
        <canvas
          ref={canvasRef}
          width={320}
          height={120}
          className="mt-3 w-full rounded border border-slate-300 bg-white"
          onPointerDown={(event) => {
            const canvas = canvasRef.current;
            const start = point(event);
            if (!canvas || !start) return;
            try {
              const context = canvas.getContext("2d");
              if (!context) return;
              drawing.current = true;
              context.beginPath();
              context.moveTo(start.x, start.y);
            } catch {
              drawing.current = false;
            }
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return;
            const canvas = canvasRef.current;
            const next = point(event);
            if (!canvas || !next) return;
            try {
              canvas.getContext("2d")?.lineTo(next.x, next.y);
              canvas.getContext("2d")?.stroke();
            } catch {
              drawing.current = false;
            }
          }}
          onPointerUp={() => {
            drawing.current = false;
          }}
        />
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Cancel</button>
          <button type="button" onClick={save} className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-medium text-white">Use signature</button>
        </div>
      </div>
    </div>
  );
}

export function PdfEditorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PdfDocument | null>(null);
  const viewportRef = useRef<PdfViewport | null>(null);
  const bytesRef = useRef<ArrayBuffer | null>(null);
  const editsRef = useRef<PdfEdit[]>([]);
  const pagesRef = useRef<EditorPage[]>([]);
  const historyRef = useRef<PdfEdit[][]>([]);
  const futureRef = useRef<PdfEdit[][]>([]);
  const runsByPageRef = useRef<Record<string, TextRun[]>>({});
  const pendingRunId = useRef<string | null>(null);
  const movedRef = useRef(false);

  const [invoiceId, setInvoiceId] = useState("");
  const [theme, setTheme] = useState<PdfTheme>("classic");
  const [doctype, setDoctype] = useState<PdfDoctype>("invoice");
  const [fileName, setFileName] = useState("document.pdf");
  const [pageIndex, setPageIndex] = useState(0);
  const [pages, setPages] = useState<EditorPage[]>([]);
  const [runs, setRuns] = useState<TextRun[]>([]);
  const [runsByPage, setRunsByPage] = useState<Record<string, TextRun[]>>({});
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [edits, setEdits] = useState<PdfEdit[]>([]);
  const [history, setHistory] = useState<PdfEdit[][]>([]);
  const [future, setFuture] = useState<PdfEdit[][]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [tool, setTool] = useState<Tool>("select");
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [dragEdit, setDragEdit] = useState<DragEdit | null>(null);
  const [docVersion, setDocVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findQuery, setFindQuery] = useState("");
  const [signing, setSigning] = useState(false);

  const { data: invoices = [] } = useQuery<InvoiceOption[]>({
    queryKey: ["pdf-editor", "invoices"],
    queryFn: async () => {
      const res = await api.get<InvoiceOption[]>("/invoices/");
      return res.data;
    },
  });

  const currentPage = pages[pageIndex] ?? null;
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;
  const selectedEdit = edits.find((edit) => edit.id === selectedEditId) ?? null;
  const matches = findTextMatches(pages, runsByPage, findQuery);

  useEffect(() => {
    editsRef.current = edits;
  }, [edits]);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    if (!selectedRun) return;
    const existing = edits.find(
      (edit): edit is Extract<PdfEdit, { kind: "replace" }> =>
        edit.kind === "replace" && edit.runId === selectedRun.id && edit.pageId === currentPage?.id,
    );
    setDraft(existing?.text ?? selectedRun.text);
  }, [selectedRun, edits, currentPage?.id]);

  useEffect(() => {
    return () => {
      void docRef.current?.destroy();
    };
  }, []);

  const remember = (result: { history: PdfEdit[][]; future: PdfEdit[][]; current: PdfEdit[] }) => {
    historyRef.current = result.history;
    futureRef.current = result.future;
    editsRef.current = result.current;
    setHistory(result.history);
    setFuture(result.future);
    setEdits(result.current);
  };

  const commit = (next: PdfEdit[]) => {
    remember(commitHistory(historyRef.current, futureRef.current, editsRef.current, next));
  };

  const undo = () => {
    remember(undoHistory(historyRef.current, futureRef.current, editsRef.current));
  };

  const redo = () => {
    remember(redoHistory(historyRef.current, futureRef.current, editsRef.current));
  };

  const paintPage = async (doc: PdfDocument, index: number) => {
    const canvas = canvasRef.current;
    const info = pagesRef.current[index];
    if (!canvas || !info) return;
    const page = await doc.getPage(info.sourceIndex + 1);
    const rotation = ((page.rotate ?? 0) + info.rotation) % 360;
    const base = page.getViewport({ scale: 1, rotation });
    const scale = Math.min(2, 760 / base.width);
    const viewport = page.getViewport({ scale, rotation });
    viewportRef.current = viewport;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    setCanvasSize({ width: viewport.width, height: viewport.height });
    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvas.getContext("2d");
    } catch {
      context = null;
    }
    if (context) {
      await page.render({ canvasContext: context, canvas, viewport }).promise;
    }
    let pageRuns = await readPageRuns(page);
    if (bytesRef.current) {
      try {
        const names = await embeddedFontNames(bytesRef.current, info.sourceIndex);
        pageRuns = pageRuns.map((run) => preferEmbeddedFamily(run, names));
      } catch {
        // Keep the family pdf.js reported when the font dictionary cannot be read.
      }
    }
    runsByPageRef.current = { ...runsByPageRef.current, [info.id]: pageRuns };
    setRunsByPage(runsByPageRef.current);
    setRuns(pageRuns);
    const nextBoxes: Box[] = pageRuns.map((run) => {
      const [x, y] = viewport.convertToViewportPoint(run.x, run.y);
      const size = run.fontSize * viewport.scale;
      const width = run.width * viewport.scale;
      return {
        key: run.id,
        left: x,
        top: y - size,
        width: Math.max(width, 8),
        height: size * 1.2,
        selected: false,
        replaced: editsRef.current.some((edit) => edit.kind === "replace" && edit.runId === run.id && edit.pageId === info.id),
      };
    });
    setBoxes(nextBoxes);
    const pending = pendingRunId.current;
    pendingRunId.current = null;
    setSelectedRunId(pending);
    setSelectedEditId(null);
  };

  const loadBytes = async (data: ArrayBuffer, name: string) => {
    setLoading(true);
    setError(null);
    try {
      bytesRef.current = data.slice(0);
      await docRef.current?.destroy();
      const doc = await openPdf(new Uint8Array(data.slice(0)));
      docRef.current = doc;
      const nextPages = createPages(doc.numPages, newId);
      pagesRef.current = nextPages;
      const collected: Record<string, TextRun[]> = {};
      for (const info of nextPages) {
        const page = await doc.getPage(info.sourceIndex + 1);
        collected[info.id] = await readPageRuns(page);
      }
      runsByPageRef.current = collected;
      setRunsByPage(collected);
      editsRef.current = [];
      historyRef.current = [];
      futureRef.current = [];
      setEdits([]);
      setHistory([]);
      setFuture([]);
      setFileName(name);
      setPages(nextPages);
      setPageIndex(0);
      setFindQuery("");
      setDocVersion((version) => version + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this PDF.");
    } finally {
      setLoading(false);
    }
  };

  const loadInvoice = async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/invoices/${invoiceId}/pdf`, {
        params: { theme, doctype },
        responseType: "arraybuffer",
      });
      const number = invoices.find((invoice) => String(invoice.id) === invoiceId)?.invoice_number;
      const name = `${doctype}-${String(number ?? invoiceId).padStart(5, "0")}.pdf`;
      await loadBytes(res.data as ArrayBuffer, name);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Could not load the invoice PDF.");
    }
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    const data = await file.arrayBuffer();
    await loadBytes(data, file.name.endsWith(".pdf") ? file.name : `${file.name}.pdf`);
  };

  useEffect(() => {
    const doc = docRef.current;
    if (!doc || docVersion === 0) return;
    void paintPage(doc, pageIndex).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not render this page.");
    });
    // paintPage reads the current document and page list through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docVersion, pageIndex, pages[pageIndex]?.rotation]);

  const canvasPoint = (event: React.MouseEvent<HTMLDivElement> | React.PointerEvent) => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const [pdfX, pdfY] = viewport.convertToPdfPoint(x, y);
    return { x, y, pdfX, pdfY };
  };

  const onOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (tool === "whiteout") return;
    const point = canvasPoint(event);
    if (!point || !currentPage) return;
    if (tool === "text") {
      const edit: PdfEdit = {
        id: newId(),
        kind: "text",
        pageId: currentPage.id,
        text: "Text",
        x: point.pdfX,
        y: point.pdfY,
        fontSize: 12,
        color: "#000000",
        embedFont: "Helvetica",
        bold: false,
      };
      commit([...editsRef.current, edit]);
      setSelectedEditId(edit.id);
      setSelectedRunId(null);
      setDraft("Text");
      setTool("select");
      return;
    }
    const hit = [...boxes].reverse().find((box) => (
      point.x >= box.left && point.x <= box.left + box.width && point.y >= box.top && point.y <= box.top + box.height
    ));
    if (!hit) {
      setSelectedRunId(null);
      return;
    }
    setSelectedRunId(hit.key);
    setSelectedEditId(null);
  };

  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (tool !== "whiteout") return;
    const point = canvasPoint(event);
    if (!point) return;
    setDrag({ x: point.pdfX, y: point.pdfY });
  };

  const onMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragEdit) return;
    const point = canvasPoint(event);
    if (!point) return;
    const x = dragEdit.originX + (point.pdfX - dragEdit.startPdfX);
    const y = dragEdit.originY + (point.pdfY - dragEdit.startPdfY);
    if (Math.abs(x - dragEdit.originX) > 0.5 || Math.abs(y - dragEdit.originY) > 0.5) movedRef.current = true;
    const next = editsRef.current.map((edit) => (edit.id === dragEdit.id ? { ...edit, x, y } : edit));
    editsRef.current = next;
    setEdits(next);
  };

  const onMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    if (dragEdit) {
      if (movedRef.current) {
        const result = commitHistory(historyRef.current, futureRef.current, dragEdit.snapshot, editsRef.current);
        historyRef.current = result.history;
        futureRef.current = result.future;
        setHistory(result.history);
        setFuture(result.future);
      }
      setDragEdit(null);
      return;
    }
    if (!drag || tool !== "whiteout" || !currentPage) return;
    const point = canvasPoint(event);
    setDrag(null);
    if (!point) return;
    const x = Math.min(drag.x, point.pdfX);
    const y = Math.min(drag.y, point.pdfY);
    const width = Math.abs(point.pdfX - drag.x);
    const height = Math.abs(point.pdfY - drag.y);
    if (width < 2 || height < 2) return;
    const edit: PdfEdit = { id: newId(), kind: "whiteout", pageId: currentPage.id, x, y, width, height };
    commit([...editsRef.current, edit]);
    setSelectedEditId(edit.id);
    setTool("select");
  };

  const beginEditDrag = (event: React.MouseEvent<HTMLDivElement>, edit: PdfEdit) => {
    if (tool !== "select") return;
    event.stopPropagation();
    event.preventDefault();
    const point = canvasPoint(event);
    if (!point) return;
    movedRef.current = false;
    setSelectedEditId(edit.id);
    setSelectedRunId(null);
    setDragEdit({
      id: edit.id,
      originX: edit.x,
      originY: edit.y,
      startPdfX: point.pdfX,
      startPdfY: point.pdfY,
      snapshot: editsRef.current,
    });
  };

  const replaceForRun = () => edits.find(
    (edit): edit is Extract<PdfEdit, { kind: "replace" }> =>
      edit.kind === "replace" && edit.runId === selectedRun?.id && edit.pageId === currentPage?.id,
  ) ?? null;

  const writeReplace = (patch: Partial<Extract<PdfEdit, { kind: "replace" }>>) => {
    if (!selectedRun || !currentPage) return;
    const existing = replaceForRun();
    const base: Extract<PdfEdit, { kind: "replace" }> = existing ?? {
      id: newId(),
      kind: "replace",
      pageId: currentPage.id,
      runId: selectedRun.id,
      text: draft || selectedRun.text,
      x: selectedRun.x,
      y: selectedRun.y,
      width: selectedRun.width,
      fontSize: selectedRun.fontSize,
      color: selectedRun.color,
      embedFont: selectedRun.embedFont,
      detectedFamily: selectedRun.fontFamily,
      bold: false,
    };
    const nextEdit = { ...base, ...patch };
    const without = editsRef.current.filter((edit) => edit.id !== base.id);
    commit([...without, nextEdit]);
  };

  const applyReplacement = () => {
    if (!selectedRun || !currentPage) return;
    const fontSize = replaceForRun()?.fontSize ?? selectedRun.fontSize;
    const width = Math.max(selectedRun.width, Math.max(draft.length, 1) * fontSize * 0.55);
    writeReplace({ text: draft, width });
  };

  const patchSelected = (patch: Partial<Extract<PdfEdit, { kind: "text" | "replace" | "image" }>>) => {
    if (!selectedEdit) return;
    commit(editsRef.current.map((edit) => (edit.id === selectedEdit.id ? { ...edit, ...patch } as PdfEdit : edit)));
  };

  const deleteSelected = () => {
    if (selectedEdit) {
      commit(editsRef.current.filter((edit) => edit.id !== selectedEdit.id));
      setSelectedEditId(null);
      return;
    }
    if (selectedRun && currentPage) {
      commit(editsRef.current.filter((edit) => !(edit.kind === "replace" && edit.runId === selectedRun.id && edit.pageId === currentPage.id)));
    }
  };

  const placeImage = (bytesBase64: string, mime: "image/png" | "image/jpeg", width: number, height: number) => {
    if (!currentPage) return;
    const edit: PdfEdit = {
      id: newId(),
      kind: "image",
      pageId: currentPage.id,
      x: 72,
      y: 80,
      width,
      height,
      bytesBase64,
      mime,
    };
    commit([...editsRef.current, edit]);
    setSelectedEditId(edit.id);
    setSelectedRunId(null);
    setTool("select");
  };

  const onLogo = async (file: File | null) => {
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("Logo must be smaller than 2 MB.");
      return;
    }
    const mime = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((value) => {
      binary += String.fromCharCode(value);
    });
    placeImage(btoa(binary), mime, 80, 80);
  };

  const goToMatch = (index: number) => {
    if (matches.length === 0) return;
    const wrapped = ((index % matches.length) + matches.length) % matches.length;
    const match = matches[wrapped];
    const nextIndex = pages.findIndex((page) => page.id === match.pageId);
    setSelectedEditId(null);
    pendingRunId.current = match.runId;
    if (nextIndex === pageIndex) {
      setSelectedRunId(match.runId);
      pendingRunId.current = null;
    } else if (nextIndex >= 0) {
      setPageIndex(nextIndex);
    }
  };

  const changePages = (next: EditorPage[], nextIndex = pageIndex) => {
    pagesRef.current = next;
    setPages(next);
    setPageIndex(Math.max(0, Math.min(nextIndex, next.length - 1)));
    setDocVersion((version) => version + 1);
  };

  const download = async () => {
    if (!bytesRef.current) return;
    setError(null);
    try {
      const bytes = await exportEditedPdf(bytesRef.current, editsRef.current, pagesRef.current);
      const raw = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(raw).set(bytes);
      const blob = new Blob([raw], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `edited-${fileName}`;
      link.click();
      URL.revokeObjectURL(url);
      trackAction("pdf_editor_download", "/pdf-editor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export the PDF.");
    }
  };

  const shownBoxes = boxes.map((box) => ({
    ...box,
    selected: box.key === selectedRunId,
    replaced: edits.some((edit) => edit.kind === "replace" && edit.runId === box.key && edit.pageId === currentPage?.id),
  }));
  const pageEdits = currentPage ? edits.filter((edit) => edit.pageId === currentPage.id) : [];
  const viewport = viewportRef.current;
  const downloadFontNote = selectedRun && selectedRun.embedFont.toLowerCase() !== selectedRun.fontFamily.toLowerCase()
    ? selectedRun.embedFont
    : null;
  const runReplace = replaceForRun();
  const runStyle = runReplace ?? (selectedRun ? {
    fontSize: selectedRun.fontSize,
    color: selectedRun.color,
    bold: false,
  } : null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">PDF editor</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Open an invoice or upload a PDF, click text to pick up its font, then download a copy. The saved invoice is not changed.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_280px]">
        <section className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <div>
            <label htmlFor="pdf-invoice" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Invoice</label>
            <select id="pdf-invoice" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} className={inputClass}>
              <option value="">Choose an invoice</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {String(invoice.invoice_number).padStart(5, "0")} · {invoice.customer_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="pdf-type" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Type</label>
              <select id="pdf-type" value={doctype} onChange={(event) => setDoctype(event.target.value as PdfDoctype)} className={inputClass}>
                <option value="invoice">Invoice</option>
                <option value="quotation">Quotation</option>
              </select>
            </div>
            <div>
              <label htmlFor="pdf-theme" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Theme</label>
              <select id="pdf-theme" value={theme} onChange={(event) => setTheme(event.target.value as PdfTheme)} className={inputClass}>
                <option value="classic">Classic</option>
                <option value="modern">Modern</option>
                <option value="minimal">Minimal</option>
                <option value="elegant">Elegant</option>
                <option value="bold">Bold</option>
                <option value="professional">Professional</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadInvoice()}
            disabled={!invoiceId || loading}
            className="w-full rounded-lg bg-brand-primary px-3 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            Load invoice
          </button>
          <div>
            <label htmlFor="pdf-upload" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Upload a PDF</label>
            <input
              id="pdf-upload"
              aria-label="Upload a PDF"
              type="file"
              accept="application/pdf,.pdf"
              className="block w-full text-sm text-slate-600 dark:text-slate-300"
              onChange={(event) => void onUpload(event.target.files?.[0] ?? null)}
            />
          </div>
          {pages.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">Pages</h2>
              <ul className="mt-2 space-y-2">
                {pages.map((page, index) => (
                  <li key={page.id} className="flex flex-wrap items-center gap-1">
                    <button type="button" onClick={() => setPageIndex(index)} className={`rounded px-2 py-1 text-xs ${index === pageIndex ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800"}`}>
                      Page {index + 1}
                    </button>
                    <button type="button" aria-label={`Rotate page ${index + 1}`} onClick={() => changePages(rotatePage(pages, page.id))} className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs">Rotate</button>
                    <button type="button" aria-label={`Move page ${index + 1} up`} disabled={index === 0} onClick={() => changePages(movePage(pages, index, -1), index === pageIndex ? index - 1 : pageIndex === index - 1 ? index : pageIndex)} className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs disabled:opacity-40">Up</button>
                    <button type="button" aria-label={`Move page ${index + 1} down`} disabled={index === pages.length - 1} onClick={() => changePages(movePage(pages, index, 1), index === pageIndex ? index + 1 : pageIndex === index + 1 ? index : pageIndex)} className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs disabled:opacity-40">Down</button>
                    <button type="button" aria-label={`Delete page ${index + 1}`} disabled={pages.length <= 1} onClick={() => {
                      const next = deletePage(pages, page.id);
                      commit(editsRef.current.filter((edit) => edit.pageId !== page.id));
                      const nextIndex = index < pageIndex ? pageIndex - 1 : index === pageIndex ? Math.max(0, pageIndex - 1) : pageIndex;
                      changePages(next, nextIndex);
                    }} className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs disabled:opacity-40">Delete</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </section>

        <section className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setTool("select")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${tool === "select" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"}`}>Select text</button>
            <button type="button" onClick={() => setTool("text")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${tool === "text" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"}`}>Add text</button>
            <button type="button" onClick={() => setTool("whiteout")} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${tool === "whiteout" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"}`}>White rectangle</button>
            <button type="button" onClick={() => setSigning(true)} disabled={!currentPage} className="rounded-lg bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-50">Sign</button>
            <label className="rounded-lg bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
              Logo
              <input aria-label="Upload a logo" type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(event) => void onLogo(event.target.files?.[0] ?? null)} />
            </label>
            <button type="button" onClick={undo} disabled={history.length === 0} className="rounded-lg bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-50">Undo</button>
            <button type="button" onClick={redo} disabled={future.length === 0} className="rounded-lg bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-50">Redo</button>
            <button type="button" onClick={deleteSelected} disabled={!selectedRun && !selectedEdit} className="rounded-lg bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-50">Delete</button>
            <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              Find
              <input aria-label="Find text" value={findQuery} onChange={(event) => setFindQuery(event.target.value)} className="w-28 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1" />
            </label>
            <button type="button" aria-label="Previous match" onClick={() => {
              const current = matches.findIndex((match) => match.runId === selectedRunId && match.pageId === currentPage?.id);
              goToMatch(current < 0 ? matches.length - 1 : current - 1);
            }} disabled={matches.length === 0} className="rounded-lg bg-white dark:bg-slate-800 px-2 py-1.5 text-xs disabled:opacity-50">Previous</button>
            <button type="button" aria-label="Next match" onClick={() => {
              const current = matches.findIndex((match) => match.runId === selectedRunId && match.pageId === currentPage?.id);
              goToMatch(current < 0 ? 0 : current + 1);
            }} disabled={matches.length === 0} className="rounded-lg bg-white dark:bg-slate-800 px-2 py-1.5 text-xs disabled:opacity-50">Next</button>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" disabled={pageIndex <= 0} onClick={() => setPageIndex((page) => page - 1)} className="rounded-lg bg-white dark:bg-slate-800 px-2 py-1.5 text-xs disabled:opacity-50">Previous page</button>
              <span className="text-xs text-slate-500">{pages.length ? `Page ${pageIndex + 1} of ${pages.length}` : "No PDF"}</span>
              <button type="button" disabled={pageIndex >= pages.length - 1} onClick={() => setPageIndex((page) => page + 1)} className="rounded-lg bg-white dark:bg-slate-800 px-2 py-1.5 text-xs disabled:opacity-50">Next page</button>
            </div>
          </div>
          <div className="overflow-auto">
            {pages.length === 0 && (
              <p className="py-16 text-center text-sm text-slate-500">Open an invoice or upload a PDF to start editing.</p>
            )}
            <div className={`relative inline-block max-w-full ${pages.length === 0 ? "hidden" : ""}`}>
              <canvas ref={canvasRef} className="block max-w-full h-auto bg-white shadow" />
              <div
                className="absolute inset-0"
                onClick={onOverlayClick}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
              >
                {shownBoxes.map((box) => {
                  const run = runs.find((item) => item.id === box.key);
                  return (
                  <div
                    key={box.key}
                    role="button"
                    aria-label={run ? `Select ${run.text}` : box.key}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedRunId(box.key);
                      setSelectedEditId(null);
                    }}
                    className={`absolute border ${box.selected ? "border-emerald-500 bg-emerald-400/20" : box.replaced ? "border-transparent" : "border-transparent hover:border-slate-400/70"}`}
                    style={{
                      left: canvasSize.width ? `${(box.left / canvasSize.width) * 100}%` : 0,
                      top: canvasSize.height ? `${(box.top / canvasSize.height) * 100}%` : 0,
                      width: canvasSize.width ? `${(box.width / canvasSize.width) * 100}%` : 0,
                      height: canvasSize.height ? `${(box.height / canvasSize.height) * 100}%` : 0,
                    }}
                  />
                  );
                })}
                {viewport && pageEdits.map((edit) => {
                  const box = editBox(edit, viewport);
                  const isText = edit.kind === "text" || edit.kind === "replace";
                  return (
                    <div
                      key={edit.id}
                      onMouseDown={(event) => beginEditDrag(event, edit)}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (movedRef.current) return;
                        setSelectedEditId(edit.id);
                        setSelectedRunId(null);
                      }}
                      className={`absolute border cursor-move overflow-hidden whitespace-nowrap ${selectedEditId === edit.id ? "border-sky-500" : isText ? "border-amber-500" : "border-sky-300/60"} ${isText ? "bg-white" : selectedEditId === edit.id ? "bg-sky-300/20" : ""}`}
                      style={{
                        left: canvasSize.width ? `${(box.left / canvasSize.width) * 100}%` : 0,
                        top: canvasSize.height ? `${(box.top / canvasSize.height) * 100}%` : 0,
                        width: canvasSize.width ? `${(box.width / canvasSize.width) * 100}%` : 0,
                        height: canvasSize.height ? `${(box.height / canvasSize.height) * 100}%` : 0,
                        color: isText ? edit.color : undefined,
                        fontFamily: isText ? cssFamily(edit.embedFont) : undefined,
                        fontSize: isText ? `${edit.fontSize * viewport.scale}px` : undefined,
                        fontWeight: isText && edit.bold ? 700 : 400,
                        lineHeight: 1,
                      }}
                    >
                      {isText ? edit.text : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {loading && <p className="mt-2 text-xs text-slate-500">Loading PDF…</p>}
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Selected text</h2>
          {selectedRun && runStyle ? (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400">Detected font</p>
              <p className="text-sm text-slate-900 dark:text-slate-100">{selectedRun.fontFamily}</p>
              <label htmlFor="pdf-size" className="block text-xs text-slate-500">Size</label>
              <input id="pdf-size" aria-label="Font size" type="number" min={6} max={72} value={Math.round(runStyle.fontSize * 10) / 10} onChange={(event) => writeReplace({ fontSize: Number(event.target.value) || runStyle.fontSize })} className={inputClass} />
              <label htmlFor="pdf-color" className="block text-xs text-slate-500">Color</label>
              <input id="pdf-color" aria-label="Text color" type="color" value={runStyle.color} onChange={(event) => writeReplace({ color: event.target.value })} className="h-9 w-full" />
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input aria-label="Bold" type="checkbox" checked={runStyle.bold} onChange={(event) => writeReplace({ bold: event.target.checked })} />
                Bold
              </label>
              {downloadFontNote && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Download uses {downloadFontNote}. The embedded font file cannot be reused.</p>
              )}
              <label htmlFor="pdf-replacement" className="block text-xs font-medium text-slate-600 dark:text-slate-400">Replacement</label>
              <input id="pdf-replacement" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyReplacement(); }} className={inputClass} />
              <button type="button" onClick={applyReplacement} className="w-full rounded-lg bg-brand-primary px-3 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover">
                Apply replacement
              </button>
              {runReplace && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Showing “{runReplace.text}” on the page. Download PDF to keep it.</p>
              )}
            </>
          ) : selectedEdit && (selectedEdit.kind === "text" || selectedEdit.kind === "replace") ? (
            <>
              <label htmlFor="pdf-edit-size" className="block text-xs text-slate-500">Size</label>
              <input id="pdf-edit-size" aria-label="Font size" type="number" min={6} max={72} value={selectedEdit.fontSize} onChange={(event) => patchSelected({ fontSize: Number(event.target.value) || selectedEdit.fontSize })} className={inputClass} />
              <label htmlFor="pdf-edit-color" className="block text-xs text-slate-500">Color</label>
              <input id="pdf-edit-color" aria-label="Text color" type="color" value={selectedEdit.color} onChange={(event) => patchSelected({ color: event.target.value })} className="h-9 w-full" />
              <label className="flex items-center gap-2 text-sm">
                <input aria-label="Bold" type="checkbox" checked={selectedEdit.bold} onChange={(event) => patchSelected({ bold: event.target.checked })} />
                Bold
              </label>
              <input
                aria-label="New text"
                value={selectedEdit.text}
                onChange={(event) => {
                  const text = event.target.value;
                  const next = editsRef.current.map((edit) => edit.id === selectedEdit.id && (edit.kind === "text" || edit.kind === "replace") ? { ...edit, text } : edit);
                  editsRef.current = next;
                  setEdits(next);
                }}
                className={inputClass}
              />
            </>
          ) : selectedEdit?.kind === "image" ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">Drag the image to move it.</p>
              <label htmlFor="pdf-image-width" className="block text-xs text-slate-500">Width</label>
              <input id="pdf-image-width" aria-label="Image width" type="number" min={8} value={selectedEdit.width} onChange={(event) => patchSelected({ width: Number(event.target.value) || selectedEdit.width })} className={inputClass} />
              <label htmlFor="pdf-image-height" className="block text-xs text-slate-500">Height</label>
              <input id="pdf-image-height" aria-label="Image height" type="number" min={8} value={selectedEdit.height} onChange={(event) => patchSelected({ height: Number(event.target.value) || selectedEdit.height })} className={inputClass} />
            </>
          ) : selectedEdit?.kind === "whiteout" ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Drag the rectangle to move it.</p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Click a line of text to see its font, size, and color.</p>
          )}
          <button
            type="button"
            onClick={() => void download()}
            disabled={!pages.length}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-100 disabled:opacity-50"
          >
            Download PDF
          </button>
        </section>
      </div>
      {signing && (
        <SignaturePad
          onCancel={() => setSigning(false)}
          onSave={(png) => {
            placeImage(png, "image/png", 140, 48);
            setSigning(false);
          }}
        />
      )}
    </div>
  );
}

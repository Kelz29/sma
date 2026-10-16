import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/utils";
import { PdfEditorPage } from "./PdfEditorPage";
import { api } from "@/lib/axios";
import { openPdf, readPageRuns } from "../loadPdf";

vi.mock("@/lib/axios", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("../loadPdf", () => ({
  openPdf: vi.fn(),
  readPageRuns: vi.fn(async () => []),
}));

describe("PdfEditorPage", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (String(url).includes("/pdf")) return { data: new ArrayBuffer(8) };
      if (url === "/invoices/") {
        return { data: [{ id: 1, invoice_number: 270, customer_name: "TLH Transport" }] };
      }
      return { data: [] };
    });
    vi.mocked(openPdf).mockResolvedValue({
      numPages: 1,
      destroy: vi.fn(async () => undefined),
      getPage: vi.fn(async () => ({
        getViewport: ({ scale }: { scale: number }) => ({
          width: 100 * scale,
          height: 140 * scale,
          scale,
          convertToViewportPoint: (x: number, y: number) => [x, y],
          convertToPdfPoint: (x: number, y: number) => [x, y],
        }),
        getTextContent: async () => ({ items: [], styles: {} }),
        getOperatorList: async () => ({ fnArray: [], argsArray: [] }),
        render: () => ({ promise: Promise.resolve() }),
      })),
    });
    vi.mocked(readPageRuns).mockResolvedValue([]);
  });

  it("renders invoice and upload sources", async () => {
    render(<PdfEditorPage />);
    expect(screen.getByRole("button", { name: /load invoice/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/upload a pdf/i)).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: /TLH Transport/i })).toBeInTheDocument();
  });

  it("loads the selected invoice PDF", async () => {
    const user = userEvent.setup();
    render(<PdfEditorPage />);
    await screen.findByRole("option", { name: /TLH Transport/i });
    await user.selectOptions(screen.getByLabelText(/^invoice$/i), "1");
    await user.click(screen.getByRole("button", { name: /load invoice/i }));
    expect(api.get).toHaveBeenCalledWith(
      "/invoices/1/pdf",
      expect.objectContaining({
        params: { theme: "classic", doctype: "invoice" },
        responseType: "arraybuffer",
      }),
    );
    expect(openPdf).toHaveBeenCalled();
  });

  it("finds text on the next page", async () => {
    const user = userEvent.setup();
    vi.mocked(openPdf).mockResolvedValue({
      numPages: 2,
      destroy: vi.fn(async () => undefined),
      getPage: vi.fn(async () => ({
        getViewport: ({ scale }: { scale: number }) => ({
          width: 100 * scale,
          height: 140 * scale,
          scale,
          convertToViewportPoint: (x: number, y: number) => [x, y],
          convertToPdfPoint: (x: number, y: number) => [x, y],
        }),
        getTextContent: async () => ({ items: [], styles: {} }),
        getOperatorList: async () => ({ fnArray: [], argsArray: [] }),
        render: () => ({ promise: Promise.resolve() }),
      })),
    });
    let call = 0;
    vi.mocked(readPageRuns).mockImplementation(async () => {
      call += 1;
      const text = call % 2 === 1 ? "Alpha page" : "Beta page";
      return [{
        id: "run-0",
        text,
        x: 10,
        y: 20,
        width: 40,
        height: 12,
        fontSize: 12,
        fontFamily: "Helvetica",
        color: "#000000",
        embedFont: "Helvetica",
      }];
    });
    render(<PdfEditorPage />);
    await screen.findByRole("option", { name: /TLH Transport/i });
    await user.selectOptions(screen.getByLabelText(/^invoice$/i), "1");
    await user.click(screen.getByRole("button", { name: /load invoice/i }));
    expect(await screen.findByText(/Page 1 of 2/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/find text/i), "Beta");
    await user.click(screen.getByRole("button", { name: /next match/i }));
    expect(await screen.findByText(/Page 2 of 2/)).toBeInTheDocument();
  });
});

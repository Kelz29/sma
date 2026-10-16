export type EmbedFont = "Times" | "Helvetica" | "Courier";

export type TextRun = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  embedFont: EmbedFont;
};

export type FillOps = {
  setFillRGBColor: number;
  setFillGray: number;
  setFillCMYKColor: number;
  setFillColor: number;
  showText: number;
  showSpacedText: number;
  nextLineShowText: number;
  nextLineSetSpacingShowText: number;
};

type TextItemLike = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  fontName?: string;
};

type TextContentLike = {
  items: TextItemLike[];
  styles?: Record<string, { fontFamily?: string }>;
};

const SHOW_TEXT = (ops: FillOps) =>
  new Set([ops.showText, ops.showSpacedText, ops.nextLineShowText, ops.nextLineSetSpacingShowText]);

export function cleanFontFamily(name: string): string {
  const trimmed = name.trim().replace(/^\//, "");
  const plus = trimmed.lastIndexOf("+");
  const withoutSubset = plus >= 0 ? trimmed.slice(plus + 1) : trimmed;
  const family = withoutSubset.split(",")[0]?.trim() || "Helvetica";
  return family || "Helvetica";
}

export function embeddableFont(family: string): EmbedFont {
  const name = family.toLowerCase();
  if (/courier|consolas|mono|menlo|source code/.test(name)) return "Courier";
  if (/arial|helvetica|calibri|verdana|sans/.test(name)) return "Helvetica";
  if (/georgia|times|garamond|cambria|serif|palatino|liberation serif/.test(name)) return "Times";
  return "Helvetica";
}

export function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number) => {
    const scaled = value <= 1 ? value * 255 : value;
    return Math.max(0, Math.min(255, Math.round(scaled)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace("#", "").trim();
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = Number.parseInt(full || "000000", 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  };
}

function components(args: unknown): number[] {
  if (!args) return [];
  const list = Array.isArray(args) ? args : [];
  const first = list.length === 1 && Array.isArray(list[0]) ? list[0] : list;
  return first.map((value) => Number(value)).filter((value) => Number.isFinite(value));
}

export function colorsFromOperators(fnArray: number[], argsArray: unknown[], ops: FillOps): string[] {
  let current = "#000000";
  const colors: string[] = [];
  const show = SHOW_TEXT(ops);
  fnArray.forEach((fn, index) => {
    const parts = components(argsArray[index]);
    if (fn === ops.setFillRGBColor && parts.length >= 3) {
      current = rgbToHex(parts[0], parts[1], parts[2]);
    } else if (fn === ops.setFillGray && parts.length >= 1) {
      current = rgbToHex(parts[0], parts[0], parts[0]);
    } else if (fn === ops.setFillCMYKColor && parts.length >= 4) {
      const [c, m, y, k] = parts;
      current = rgbToHex(1 - Math.min(1, c + k), 1 - Math.min(1, m + k), 1 - Math.min(1, y + k));
    } else if (fn === ops.setFillColor && parts.length >= 3) {
      current = rgbToHex(parts[0], parts[1], parts[2]);
    } else if (fn === ops.setFillColor && parts.length === 1) {
      current = rgbToHex(parts[0], parts[0], parts[0]);
    } else if (show.has(fn)) {
      colors.push(current);
    }
  });
  return colors;
}

export function detectTextRuns(content: TextContentLike, colors: string[]): TextRun[] {
  const runs: TextRun[] = [];
  let colorIndex = 0;
  for (const item of content.items) {
    if (!item || typeof item.str !== "string" || item.str.length === 0) continue;
    const transform = item.transform ?? [];
    const fontSize = Math.hypot(transform[0] ?? 0, transform[1] ?? 0) || Math.abs(transform[3] ?? 0) || 12;
    const rawFamily = content.styles?.[item.fontName ?? ""]?.fontFamily || item.fontName || "Helvetica";
    const fontFamily = cleanFontFamily(rawFamily);
    const color = colors[colorIndex] ?? "#000000";
    colorIndex += 1;
    runs.push({
      id: `run-${runs.length}`,
      text: item.str,
      x: transform[4] ?? 0,
      y: transform[5] ?? 0,
      width: item.width && item.width > 0 ? item.width : fontSize * item.str.length * 0.5,
      height: fontSize,
      fontSize,
      fontFamily,
      color,
      embedFont: embeddableFont(fontFamily),
    });
  }
  return runs;
}

const GENERIC_FAMILY = /^(serif|sans-serif|monospace)$/i;

export function displayFamily(name: string): string {
  const cleaned = cleanFontFamily(name).replace(/[-_ ]?(semibold|semi-bold|bold|italic|regular|medium|light|black|oblique|roman)$/i, "");
  return cleaned.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim() || cleanFontFamily(name);
}

/** When pdf.js only reports serif/sans/mono, use the single embedded family that matches. */
export function preferEmbeddedFamily(run: TextRun, embeddedNames: string[]): TextRun {
  if (!GENERIC_FAMILY.test(run.fontFamily)) return run;
  const matches = [...new Set(embeddedNames.map(displayFamily).filter((name) => embeddableFont(name) === run.embedFont))];
  if (matches.length !== 1) return run;
  const fontFamily = matches[0];
  return { ...run, fontFamily, embedFont: embeddableFont(fontFamily) };
}

/** Keep the detected size, color, and font when the string changes. */
export function replaceRunText(run: TextRun, text: string): TextRun {
  return { ...run, text };
}

export function findTextMatches(
  pages: { id: string }[],
  runsByPage: Record<string, { id: string; text: string }[]>,
  query: string,
): { pageId: string; runId: string }[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const matches: { pageId: string; runId: string }[] = [];
  for (const page of pages) {
    for (const run of runsByPage[page.id] ?? []) {
      if (run.text.toLowerCase().includes(needle)) {
        matches.push({ pageId: page.id, runId: run.id });
      }
    }
  }
  return matches;
}

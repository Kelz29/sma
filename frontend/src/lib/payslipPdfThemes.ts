export const PAYSLIP_PDF_THEMES = [
  { value: "classic", label: "Classic" },
  { value: "modern", label: "Modern" },
  { value: "minimal", label: "Minimal" },
] as const;

export type PayslipPdfTheme = (typeof PAYSLIP_PDF_THEMES)[number]["value"];

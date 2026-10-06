export type PreviewRowTone = "blue" | "green";

export type PreviewSection = {
  id: string;
  title: string;
  headers: string[];
  rows: string[][];
  lastRowTone?: PreviewRowTone;
};

/** frontendV3.5 is-kanunu/model.ts — hesaplama için gerekli alanlar. */

export type ExtraItem = {
  id: string;
  name: string;
  value: string;
};

export type IsKanunuFormSnapshot = {
  iseGirisTarihi: string;
  istenCikisTarihi: string;
  ciplakBrut: string;
  prim: string;
  ikramiye: string;
  yol: string;
  yemek: string;
  extras: ExtraItem[];
  notes: string;
};

export type DurationParts = {
  years: number;
  months: number;
  days: number;
};

export type IsKanunuResult = {
  duration: DurationParts | null;
  durationLabel: string;
  giydirilmisAylik: number;
  tavan: number | null;
  tavanApplied: boolean;
  esasAylik: number;
  brutKidem: number;
  damgaVergisi: number;
  netKidem: number;
  shortTenureWarning: boolean;
};

export function createEmptyForm(): IsKanunuFormSnapshot {
  return {
    iseGirisTarihi: "",
    istenCikisTarihi: "",
    ciplakBrut: "",
    prim: "",
    ikramiye: "",
    yol: "",
    yemek: "",
    extras: [],
    notes: "",
  };
}

export function newLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ik-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

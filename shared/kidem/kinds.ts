export const KIDEM_KINDS = [
  "is-kanunu",
  "borclar",
  "gemi",
  "mevsimlik",
  "basin",
  "kismi",
  "belirli-sureli",
] as const;

export type KidemKind = (typeof KIDEM_KINDS)[number];

export const KIDEM_CALCULATION_TYPES = [
  "kidem-tazminati",
  "kidem-is-kanunu",
  "kidem-borclar",
  "kidem-gemi",
  "kidem-mevsimlik",
  "kidem-basin",
  "kidem-kismi",
  "kidem-belirli-sureli",
] as const;

export type KidemCalculationType = (typeof KIDEM_CALCULATION_TYPES)[number];

export const KIDEM_KIND_META: Record<
  KidemKind,
  {
    calculationType: Exclude<KidemCalculationType, "kidem-tazminati">;
    path: string;
    title: string;
    listLabel: string;
    description: string;
    informational: boolean;
  }
> = {
  "is-kanunu": {
    calculationType: "kidem-is-kanunu",
    path: "/kidem-tazminati/30isci",
    title: "İş Kanununa Göre",
    listLabel: "Kıdem – İş Kanununa Göre",
    description: "4857 / 1475 sayılı kanun çerçevesinde klasik kıdem tazminatı hesabı.",
    informational: false,
  },
  borclar: {
    calculationType: "kidem-borclar",
    path: "/kidem-tazminati/borclar",
    title: "Borçlar Kanunu İşçi Alacağı",
    listLabel: "Kıdem – Borçlar Kanunu İşçi Alacağı",
    description: "TBK kapsamında kıdem yerine haksız fesih tazminatı bilgilendirmesi.",
    informational: true,
  },
  gemi: {
    calculationType: "kidem-gemi",
    path: "/kidem-tazminati/gemi",
    title: "Gemi Adamları",
    listLabel: "Kıdem – Gemi Adamları",
    description: "Deniz iş ilişkilerinde kıdem; GVK 25/7 muafiyeti ve damga ile net.",
    informational: false,
  },
  mevsimlik: {
    calculationType: "kidem-mevsimlik",
    path: "/kidem-tazminati/mevsimlik",
    title: "Mevsimlik İşçi",
    listLabel: "Kıdem – Mevsimlik İşçi",
    description: "Birden fazla çalışma dönemi ve 360 günlük gün payı ile hesap.",
    informational: false,
  },
  basin: {
    calculationType: "kidem-basin",
    path: "/kidem-tazminati/basin",
    title: "Basın İş",
    listLabel: "Kıdem – Basın İş",
    description: "5953 sayılı Basın İş Kanunu; 5 yıl kuralı ve gelir vergisi.",
    informational: false,
  },
  kismi: {
    calculationType: "kidem-kismi",
    path: "/kidem-tazminati/kismi-sureli",
    title: "Kısmi Süreli / Part Time",
    listLabel: "Kıdem – Kısmi Süreli / Part Time",
    description: "SSK 360 gün sistemiyle kısmi süreli çalışma kıdemi.",
    informational: false,
  },
  "belirli-sureli": {
    calculationType: "kidem-belirli-sureli",
    path: "/kidem-tazminati/belirli-sureli",
    title: "Belirli Süreli İş Sözleşmesi",
    listLabel: "Kıdem – Belirli Süreli İş Sözleşmesi",
    description: "Belirli süreli sözleşmede kıdem hakkına ilişkin mevzuat özeti.",
    informational: true,
  },
};

export function isKidemKind(value: unknown): value is KidemKind {
  return typeof value === "string" && (KIDEM_KINDS as readonly string[]).includes(value);
}

export function kindFromCalculationType(type: string): KidemKind {
  if (type === "kidem-tazminati" || type === "kidem-is-kanunu") return "is-kanunu";
  const found = (Object.entries(KIDEM_KIND_META) as [KidemKind, (typeof KIDEM_KIND_META)[KidemKind]][]).find(
    ([, meta]) => meta.calculationType === type,
  );
  return found?.[0] ?? "is-kanunu";
}

export function recordOpenPath(type: string, recordId: string): string {
  const kind = kindFromCalculationType(type);
  return `${KIDEM_KIND_META[kind].path}?kayit=${encodeURIComponent(recordId)}`;
}

export function kidemListLabel(type: string): string {
  if (!(KIDEM_CALCULATION_TYPES as readonly string[]).includes(type) && type !== "kidem-tazminati") {
    return type;
  }
  return KIDEM_KIND_META[kindFromCalculationType(type)].listLabel;
}

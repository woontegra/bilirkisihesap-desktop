import type { LucideIcon } from "lucide-react";
import {
  Award,
  Banknote,
  Bell,
  Briefcase,
  Building2,
  Calculator,
  Calendar,
  CalendarDays,
  Clock,
  Flag,
  FolderOpen,
  Gavel,
  Hourglass,
  LayoutDashboard,
  Scale,
  Search,
  StickyNote,
  Tag,
  Wrench,
  Settings,
  Shield,
  ShieldAlert,
  UserX,
  Users,
  Wallet,
} from "lucide-react";

export type ToolAction = "add-note" | "add-tag" | "open-interest";

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  action?: ToolAction;
  badge?: string;
  phaseNote?: string;
};

export function dispatchToolAction(
  action: ToolAction,
  tools: { addNote: () => void; openTagModal: () => void; openInterestCalculator: () => void },
): void {
  if (action === "add-note") tools.addNote();
  if (action === "add-tag") tools.openTagModal();
  if (action === "open-interest") tools.openInterestCalculator();
}

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    label: "Genel",
    items: [
      {
        id: "home",
        label: "Yönetim Paneli",
        path: "/",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: "calculations",
    label: "Hesaplamalar",
    items: [
      { id: "kidem", label: "Kıdem Tazminatı", path: "/kidem-tazminati", icon: Briefcase },
      { id: "ihbar", label: "İhbar Tazminatı", path: "/ihbar-tazminati", icon: Bell },
      { id: "fazla-mesai", label: "Fazla Mesai Alacağı", path: "/fazla-mesai", icon: Clock },
      { id: "yillik-izin", label: "Yıllık Ücretli İzin Alacağı", path: "/yillik-izin", icon: Calendar },
      { id: "ubgt", label: "UBGT Alacağı", path: "/ubgt", icon: Flag },
      { id: "hafta-tatili", label: "Hafta Tatili Alacağı", path: "/hafta-tatili", icon: CalendarDays },
      { id: "ucret", label: "Ücret Alacağı", path: "/ucret-alacagi", icon: Banknote },
      { id: "is-arama", label: "İş Arama İzni Ücreti", path: "/is-arama-izni-ucreti", icon: Search },
      { id: "bakiye", label: "Bakiye Ücret Alacağı", path: "/bakiye-ucret-alacagi", icon: Wallet },
      { id: "prim", label: "Prim Alacağı", path: "/prim-alacagi", icon: Award },
      { id: "kotu-niyet", label: "Kötü Niyet Tazminatı", path: "/kotu-niyet-tazminati", icon: ShieldAlert },
      { id: "bosta", label: "Boşta Geçen Süre Ücreti", path: "/bosta-gecen-sure-ucreti", icon: Hourglass },
      { id: "ise-baslatmama", label: "İşe Başlatmama Tazminatı", path: "/ise-almama-tazminati", icon: UserX },
      { id: "ayrimcilik", label: "Ayrımcılık Tazminatı", path: "/ayrimcilik-tazminati", icon: Users },
      { id: "haksiz-fesih", label: "Haksız Fesih Tazminatı", path: "/haksiz-fesih-tazminati", icon: Gavel },
      {
        id: "icra",
        label: "İcra Takip Brütten Nete",
        path: "/icra-takip-brutten-nete",
        icon: Building2,
        badge: "YENİ",
      },
    ],
  },
  {
    id: "tools",
    label: "Araçlar",
    items: [
      { id: "davaci", label: "Davacı Ücreti", path: "/davaci-ucreti", icon: Scale },
      {
        id: "manuel-brut",
        label: "Manuel Brüt Ücret",
        path: "/araclar/manuel-brut-ucret",
        icon: Wrench,
      },
      { id: "hesaplama-notu", label: "Hesaplama Notu", action: "add-note", icon: StickyNote },
      { id: "kategori-etiketi", label: "Kategori Etiketi", action: "add-tag", icon: Tag },
      { id: "faiz-hesaplayici", label: "Faiz Hesaplayıcı", action: "open-interest", icon: Calculator },
    ],
  },
  {
    id: "data",
    label: "Veri",
    items: [
      {
        id: "saved",
        label: "Kayıtlı Hesaplamalar",
        path: "/kayitli-hesaplamalar",
        icon: FolderOpen,
      },
    ],
  },
  {
    id: "system",
    label: "Sistem",
    items: [
      {
        id: "settings",
        label: "Ayarlar",
        path: "/ayarlar",
        icon: Settings,
      },
      {
        id: "license",
        label: "Lisans Bilgileri",
        path: "/lisans",
        icon: Shield,
      },
    ],
  },
];

export const PAGE_TITLES: Record<string, string> = {
  "/": "Yönetim Paneli",
  "/davaci-ucreti": "Davacı Ücreti",
  "/kidem-tazminati": "Kıdem Tazminatı",
  "/kidem-tazminati/30isci": "Kıdem Tazminatı — İş Kanununa Göre",
  "/kidem-tazminati/is-kanunu": "Kıdem Tazminatı — İş Kanununa Göre",
  "/kidem-tazminati/borclar": "Kıdem Tazminatı — Borçlar Kanunu",
  "/kidem-tazminati/gemi": "Kıdem Tazminatı — Gemi Adamları",
  "/kidem-tazminati/mevsimlik": "Kıdem Tazminatı — Mevsimlik İşçi",
  "/kidem-tazminati/basin": "Kıdem Tazminatı — Basın İş",
  "/kidem-tazminati/kismi-sureli": "Kıdem Tazminatı — Kısmi Süreli / Part Time",
  "/kidem-tazminati/belirli-sureli": "Kıdem Tazminatı — Belirli Süreli",
  "/fazla-mesai": "Fazla Mesai Alacağı",
  "/ihbar-tazminati": "İhbar Tazminatı",
  "/yillik-izin": "Yıllık Ücretli İzin Alacağı",
  "/ubgt": "UBGT Alacağı",
  "/hafta-tatili": "Hafta Tatili Alacağı",
  "/ucret-alacagi": "Ücret Alacağı",
  "/is-arama-izni-ucreti": "İş Arama İzni Ücreti",
  "/bakiye-ucret-alacagi": "Bakiye Ücret Alacağı",
  "/prim-alacagi": "Prim Alacağı",
  "/kotu-niyet-tazminati": "Kötü Niyet Tazminatı",
  "/bosta-gecen-sure-ucreti": "Boşta Geçen Süre Ücreti",
  "/ise-almama-tazminati": "İşe Başlatmama Tazminatı",
  "/ayrimcilik-tazminati": "Ayrımcılık Tazminatı",
  "/haksiz-fesih-tazminati": "Haksız Fesih Tazminatı",
  "/icra-takip-brutten-nete": "İcra Takip Brütten Nete",
  "/kayitli-hesaplamalar": "Kayıtlı Hesaplamalar",
  "/ayarlar": "Ayarlar",
  "/lisans": "Lisans Bilgileri",
  "/araclar/manuel-brut-ucret": "Manuel Brüt Ücret Şablonları",
};

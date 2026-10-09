import {
  CheckSquare,
  Copy,
  Download,
  Edit,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Inbox,
  MoreHorizontal,
  Pencil,
  Search,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { exportBackup, importBackup } from "@/api/backups";
import {
  createSavedCase,
  createSavedCaseFolder,
  deleteSavedCase,
  deleteSavedCaseFolder,
  getSavedCase,
  listSavedCaseFolders,
  listSavedCases,
  moveSavedCasesToFolder,
  renameSavedCaseFolder,
  updateSavedCase,
  type SavedCaseFolder,
  type SavedCaseRecord,
} from "@/api/savedCases";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/context/ToastContext";
import { buildCaseOpenUrl, getCaseRouteInfo } from "../caseRoutes";
import { getCaseEndDate, getCaseStartDate } from "../savedCaseDates";
import {
  ALL_FOLDERS_VIEW,
  UNFILED_FOLDER_VIEW,
  countRowsByFolder,
  effectiveFolderId,
  filterRowsByFolder,
  normalizeFolderView,
  type FolderView,
} from "../savedCaseFolders";
import styles from "./profileTabShared.module.css";

type SavedCaseRow = {
  id: number;
  hesaplama_tipi: string;
  kayit_adi: string | null;
  ise_giris: string | null;
  isten_cikis: string | null;
  net_toplam: number | null;
  created_at: string | null;
  folderId: string | null;
};

function pickNet(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

const moneyFmt = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function mapItem(item: SavedCaseRecord): SavedCaseRow {
  let pd: Record<string, unknown> = {};
  if (item.data) {
    if (typeof item.data === "string") {
      try {
        pd = JSON.parse(item.data) as Record<string, unknown>;
      } catch {
        pd = {};
      }
    } else if (typeof item.data === "object") {
      pd = item.data as Record<string, unknown>;
    }
  }
  const inner =
    pd.data && typeof pd.data === "object" && !Array.isArray(pd.data)
      ? (pd.data as Record<string, unknown>)
      : pd;
  const results =
    inner.results && typeof inner.results === "object"
      ? (inner.results as Record<string, unknown>)
      : pd.results && typeof pd.results === "object"
        ? (pd.results as Record<string, unknown>)
        : null;

  const net =
    pickNet(
      results?.net,
      results?.netKidem,
      results?.netTutar,
      results?.netToplam,
      results?.net_total,
      pd.net_total,
      inner.net_total,
      item.net_total,
    );

  return {
    id: item.id,
    hesaplama_tipi: (item.type || item.hesaplama_tipi || "").toLowerCase(),
    kayit_adi: item.name || item.kayit_adi || null,
    ise_giris: getCaseStartDate(item),
    isten_cikis: getCaseEndDate(item),
    net_toplam: net,
    created_at: item.createdAt || item.created_at || null,
    folderId: item.folderId ?? null,
  };
}

function fmtDate(s?: string | null) {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

type ConfirmState =
  | { kind: "single"; id: number }
  | { kind: "selected" }
  | { kind: "all" }
  | null;

export default function SavedCalculationsTab() {
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<SavedCaseRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [savingNameId, setSavingNameId] = useState<number | null>(null);
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [unsupportedMsg, setUnsupportedMsg] = useState<string | null>(null);
  const [folders, setFolders] = useState<SavedCaseFolder[]>([]);
  const [folderView, setFolderView] = useState<FolderView>(ALL_FOLDERS_VIEW);
  const [newFolderName, setNewFolderName] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<SavedCaseFolder | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!folderMenuId) return;
    const onPointer = (e: MouseEvent) => {
      if (!folderMenuRef.current?.contains(e.target as Node)) setFolderMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFolderMenuId(null);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [folderMenuId]);

  const loadFolders = async () => {
    try {
      setFolders(await listSavedCaseFolders());
    } catch {
      toast.error("Klasörler yüklenemedi");
    }
  };

  const loadCases = async () => {
    try {
      setLoading(true);
      const [data] = await Promise.all([listSavedCases(), loadFolders()]);
      setCases(data.map(mapItem));
    } catch {
      toast.error("Hesaplamalar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCases();
  }, []);

  const folderIds = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);
  const folderNames = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders]);
  const folderCounts = useMemo(() => countRowsByFolder(cases, folderIds), [cases, folderIds]);
  const activeView = normalizeFolderView(folderView, folderIds);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeView]);

  const filteredCases = useMemo(() => {
    const inFolder = filterRowsByFolder(cases, activeView, folderIds);
    if (!searchQuery.trim()) return inFolder;
    const q = searchQuery.toLowerCase().trim();
    return inFolder.filter((c) => {
      const label = getCaseRouteInfo(c.hesaplama_tipi).label.toLowerCase();
      return (
        (c.kayit_adi || "").toLowerCase().includes(q) ||
        (c.hesaplama_tipi || "").includes(q) ||
        label.includes(q) ||
        fmtDate(c.created_at).includes(q) ||
        fmtDate(c.ise_giris).includes(q) ||
        fmtDate(c.isten_cikis).includes(q) ||
        (c.net_toplam?.toString() || "").includes(q) ||
        (c.net_toplam != null ? moneyFmt.format(Number(c.net_toplam)).toLowerCase() : "").includes(q)
      );
    });
  }, [cases, searchQuery, activeView, folderIds]);

  const handleCreateFolder = async () => {
    const name = (newFolderName ?? "").trim();
    if (!name) {
      setNewFolderName(null);
      return;
    }
    setFolderBusy(true);
    try {
      const created = await createSavedCaseFolder(name);
      await loadFolders();
      setFolderView(created.id);
      setNewFolderName(null);
      toast.success("Klasör oluşturuldu");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Klasör oluşturulamadı");
    } finally {
      setFolderBusy(false);
    }
  };

  const handleRenameFolder = async (id: string) => {
    const name = renameFolderValue.trim();
    const current = folderNames.get(id);
    if (!name || name === current) {
      setRenamingFolderId(null);
      return;
    }
    setFolderBusy(true);
    try {
      await renameSavedCaseFolder(id, name);
      await loadFolders();
      setRenamingFolderId(null);
      toast.success("Klasör adı güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Klasör adı güncellenemedi");
    } finally {
      setFolderBusy(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;
    setFolderBusy(true);
    try {
      const { releasedRecords } = await deleteSavedCaseFolder(folderToDelete.id);
      setCases((prev) => prev.map((c) => (c.folderId === folderToDelete.id ? { ...c, folderId: null } : c)));
      await loadFolders();
      setFolderView(ALL_FOLDERS_VIEW);
      toast.success(
        releasedRecords > 0
          ? `Klasör silindi. ${releasedRecords} hesaplama Klasörsüz bölümüne taşındı.`
          : "Klasör silindi",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Klasör silinemedi");
    } finally {
      setFolderBusy(false);
      setFolderToDelete(null);
    }
  };

  const handleMoveSelected = async (target: string) => {
    if (selectedIds.length === 0) return;
    const folderId = target === UNFILED_FOLDER_VIEW ? null : target;
    setIsMoving(true);
    try {
      const ids = [...selectedIds];
      const { moved } = await moveSavedCasesToFolder(ids, folderId);
      setCases((prev) => prev.map((c) => (ids.includes(c.id) ? { ...c, folderId } : c)));
      setSelectedIds([]);
      const label = folderId ? folderNames.get(folderId) ?? "klasör" : "Klasörsüz";
      toast.success(`${moved} hesaplama "${label}" bölümüne taşındı`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hesaplamalar taşınamadı");
    } finally {
      setIsMoving(false);
    }
  };

  const handleExportBackup = async () => {
    if (cases.length === 0) {
      toast.error("Yedeklenecek hesaplama bulunamadı");
      return;
    }
    try {
      setIsExporting(true);
      const result = await exportBackup();
      if (result.cancelled) return;
      toast.success("Yedek başarıyla oluşturuldu ve indirildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yedek oluşturulurken hata oluştu");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (file: File) => {
    if (!file.name.endsWith(".bhbackup")) {
      toast.error("Geçersiz dosya. Sadece .bhbackup dosyaları yüklenebilir.");
      return;
    }
    try {
      setIsImporting(true);
      const result = await importBackup(file);
      if (result.cancelled) return;
      toast.success(result.message || "Yedek başarıyla geri yüklendi");
      await loadCases();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Geri yüklenirken hata oluştu");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const runDelete = async () => {
    if (!confirm) return;
    setIsDeleting(true);
    try {
      if (confirm.kind === "single") {
        await deleteSavedCase(confirm.id);
        setCases((p) => p.filter((c) => c.id !== confirm.id));
        setSelectedIds((p) => p.filter((id) => id !== confirm.id));
        toast.success("Hesaplama silindi");
      } else if (confirm.kind === "selected") {
        let ok = 0;
        let fail = 0;
        for (const id of selectedIds) {
          try {
            await deleteSavedCase(id);
            ok++;
            setCases((p) => p.filter((c) => c.id !== id));
          } catch {
            fail++;
          }
        }
        setSelectedIds([]);
        if (ok > 0) toast.success(`${ok} hesaplama silindi`);
        if (fail > 0) toast.error(`${fail} hesaplama silinemedi`);
      } else {
        let ok = 0;
        let fail = 0;
        for (const c of filteredCases) {
          try {
            await deleteSavedCase(c.id);
            ok++;
            setCases((p) => p.filter((x) => x.id !== c.id));
          } catch {
            fail++;
          }
        }
        setSelectedIds([]);
        if (ok > 0) toast.success(`${ok} hesaplama silindi`);
        if (fail > 0) toast.error(`${fail} hesaplama silinemedi`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silme başarısız");
    } finally {
      setIsDeleting(false);
      setConfirm(null);
    }
  };

  const handleCopy = async (c: SavedCaseRow) => {
    setCopyingId(c.id);
    try {
      const item = await getSavedCase(c.id);
      const name = (item.name || c.kayit_adi || "Kopya").trim();
      const copyName = name.startsWith("Kopya") ? `${name} (2)` : `Kopya - ${name}`;
      const created = await createSavedCase({
        name: copyName,
        type: item.type || c.hesaplama_tipi,
        data: item.data,
      }, { promptFolder: false });
      const sourceFolder = effectiveFolderId(c, folderIds);
      if (sourceFolder) {
        await moveSavedCasesToFolder([created.id], sourceFolder).catch(() => undefined);
      }
      toast.success("Hesaplama kopyalandı");
      await loadCases();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kopyalama başarısız");
    } finally {
      setCopyingId(null);
    }
  };

  const handleSaveName = async (id: number, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setEditingNameId(null);
      return;
    }
    setSavingNameId(id);
    try {
      const item = await getSavedCase(id);
      await updateSavedCase(id, {
        name: trimmed,
        type: item.type || "",
        data: item.data,
      }, { rename: true });
      setCases((prev) => prev.map((c) => (c.id === id ? { ...c, kayit_adi: trimmed } : c)));
      toast.success("Kayıt adı güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt adı güncellenemedi");
    } finally {
      setSavingNameId(null);
      setEditingNameId(null);
    }
  };

  const handleOpen = (c: SavedCaseRow) => {
    const info = getCaseRouteInfo(c.hesaplama_tipi);
    if (!info.supported) {
      setUnsupportedMsg("Bu hesaplama türü henüz V3.5'e aktarılmadı");
      return;
    }
    navigate(buildCaseOpenUrl(c.hesaplama_tipi, c.id));
  };

  const toggleSelectId = (id: number) =>
    setSelectedIds((p) => (p.includes(id) ? p.filter((s) => s !== id) : [...p, id]));

  const toggleSelectAll = () =>
    setSelectedIds(
      selectedIds.length === filteredCases.length ? [] : filteredCases.map((c) => c.id),
    );

  if (loading) {
    return (
      <div className={styles.panel}>
        <p className={styles.muted}>Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <section className={`${styles.panel} ${styles.fmPanel}`}>
        <div className={styles.fmHeader}>
          <div className={styles.fmTitleBlock}>
            <h3 className={styles.panelTitle}>Kaydedilen Hesaplamalar</h3>
            <p className={styles.fmDesc}>
              Daha önce kaydettiğiniz hesaplamaları görüntüleyin, klasörlere ayırın ve yönetin.
            </p>
          </div>
          <div className={styles.fmHeaderActions}>
            <div className={`${styles.searchWrap} ${styles.fmSearch}`}>
              <Search size={15} className={styles.searchIcon} aria-hidden />
              <input
                placeholder="Kayıt adı, tip, tarih veya tutar ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery ? (
                <button
                  type="button"
                  className={styles.clearSearch}
                  aria-label="Aramayı temizle"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
            <Button variant="soft" size="sm" disabled={folderBusy} onClick={() => setNewFolderName("")}>
              <FolderPlus size={14} aria-hidden /> Yeni Klasör
            </Button>
            <Button
              variant="soft"
              size="sm"
              disabled={isExporting || cases.length === 0}
              onClick={() => void handleExportBackup()}
            >
              <Download size={14} aria-hidden />
              {isExporting ? "Yedekleniyor..." : "Yedekle"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".bhbackup"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportBackup(f);
              }}
            />
            <Button
              variant="soft"
              size="sm"
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} aria-hidden />
              {isImporting ? "Geri Yükleniyor..." : "Geri Yükle"}
            </Button>
          </div>
        </div>

        <p className={styles.fmNote}>
          <FileText size={12} aria-hidden />
          Yedek dosyaları yalnızca bu uygulama ile geri yüklenebilir. Kişiye özeldir, başka kullanıcılar
          tarafından kullanılamaz.
        </p>

        <div className={styles.fileManager}>
          <nav className={styles.folderPane} aria-label="Klasörler">
            <div className={styles.folderPaneTitle}>Klasörler</div>
            <ul className={styles.folderList}>
              <li>
                <button
                  type="button"
                  className={`${styles.folderItem} ${activeView === ALL_FOLDERS_VIEW ? styles.folderItemActive : ""}`}
                  aria-current={activeView === ALL_FOLDERS_VIEW ? "true" : undefined}
                  onClick={() => setFolderView(ALL_FOLDERS_VIEW)}
                >
                  <FileText size={14} aria-hidden />
                  <span className={styles.folderName}>Tüm Hesaplamalar</span>
                  <span className={styles.folderCount}>{folderCounts.all}</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`${styles.folderItem} ${activeView === UNFILED_FOLDER_VIEW ? styles.folderItemActive : ""}`}
                  aria-current={activeView === UNFILED_FOLDER_VIEW ? "true" : undefined}
                  onClick={() => setFolderView(UNFILED_FOLDER_VIEW)}
                >
                  <Inbox size={14} aria-hidden />
                  <span className={styles.folderName}>Klasörsüz</span>
                  <span className={styles.folderCount}>{folderCounts.unfiled}</span>
                </button>
              </li>
              {folders.length > 0 ? <li className={styles.folderDivider} aria-hidden /> : null}
              {folders.map((folder) => {
                const active = activeView === folder.id;
                return (
                  <li key={folder.id} className={styles.folderRow}>
                    {renamingFolderId === folder.id ? (
                      <input
                        className={styles.folderInput}
                        value={renameFolderValue}
                        maxLength={80}
                        aria-label="Klasör adı"
                        autoFocus
                        disabled={folderBusy}
                        onChange={(e) => setRenameFolderValue(e.target.value)}
                        onBlur={() => void handleRenameFolder(folder.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRenameFolder(folder.id);
                          if (e.key === "Escape") setRenamingFolderId(null);
                        }}
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`${styles.folderItem} ${active ? styles.folderItemActive : ""}`}
                          aria-current={active ? "true" : undefined}
                          title={folder.name}
                          onClick={() => setFolderView(folder.id)}
                        >
                          {active ? <FolderOpen size={14} aria-hidden /> : <Folder size={14} aria-hidden />}
                          <span className={styles.folderName}>{folder.name}</span>
                          <span className={styles.folderCount}>{folderCounts.byFolder.get(folder.id) ?? 0}</span>
                        </button>
                        {active ? (
                          <div className={styles.folderMenuWrap} ref={folderMenuId === folder.id ? folderMenuRef : undefined}>
                            <button
                              type="button"
                              className={styles.folderMenuButton}
                              aria-label="Klasör işlemleri"
                              aria-haspopup="menu"
                              aria-expanded={folderMenuId === folder.id}
                              disabled={folderBusy}
                              onClick={() => setFolderMenuId(folderMenuId === folder.id ? null : folder.id)}
                            >
                              <MoreHorizontal size={15} />
                            </button>
                            {folderMenuId === folder.id ? (
                              <div className={styles.folderMenu} role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setFolderMenuId(null);
                                    setRenamingFolderId(folder.id);
                                    setRenameFolderValue(folder.name);
                                  }}
                                >
                                  <Pencil size={13} aria-hidden /> Yeniden adlandır
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className={styles.folderMenuDanger}
                                  onClick={() => {
                                    setFolderMenuId(null);
                                    setFolderToDelete(folder);
                                  }}
                                >
                                  <Trash2 size={13} aria-hidden /> Klasörü sil
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    )}
                  </li>
                );
              })}
              {newFolderName != null ? (
                <li className={styles.folderRow}>
                  <input
                    className={styles.folderInput}
                    value={newFolderName}
                    maxLength={80}
                    placeholder="Klasör adı"
                    aria-label="Yeni klasör adı"
                    autoFocus
                    disabled={folderBusy}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onBlur={() => void handleCreateFolder()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleCreateFolder();
                      if (e.key === "Escape") setNewFolderName(null);
                    }}
                  />
                </li>
              ) : null}
            </ul>
          </nav>

          <div className={styles.casePane}>
            <div className={styles.casePaneHeader}>
              <div className={styles.casePaneTitle}>
                {activeView === ALL_FOLDERS_VIEW ? (
                  <FileText size={14} aria-hidden />
                ) : activeView === UNFILED_FOLDER_VIEW ? (
                  <Inbox size={14} aria-hidden />
                ) : (
                  <FolderOpen size={14} aria-hidden />
                )}
                <strong title={activeView !== ALL_FOLDERS_VIEW && activeView !== UNFILED_FOLDER_VIEW ? folderNames.get(activeView) : undefined}>
                  {activeView === ALL_FOLDERS_VIEW
                    ? "Tüm Hesaplamalar"
                    : activeView === UNFILED_FOLDER_VIEW
                      ? "Klasörsüz"
                      : folderNames.get(activeView)}
                </strong>
                <span className={styles.muted}>{filteredCases.length} kayıt</span>
              </div>
              <div className={styles.casePaneActions}>
                {selectedIds.length > 0 ? (
                  <label className={styles.moveSelect}>
                    <FolderInput size={14} aria-hidden />
                    <span className={styles.srOnly}>Seçilenleri klasöre taşı</span>
                    <select
                      value=""
                      disabled={isMoving}
                      onChange={(e) => {
                        if (e.target.value) void handleMoveSelected(e.target.value);
                      }}
                    >
                      <option value="">{isMoving ? "Taşınıyor..." : `Klasöre taşı (${selectedIds.length})`}</option>
                      <option value={UNFILED_FOLDER_VIEW}>Klasörsüz</option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {selectedIds.length > 0 ? (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={isDeleting}
                    onClick={() => setConfirm({ kind: "selected" })}
                  >
                    <Trash2 size={14} aria-hidden /> Seçilenleri Sil ({selectedIds.length})
                  </Button>
                ) : null}
                {filteredCases.length > 0 ? (
                  <Button
                    variant="soft"
                    size="sm"
                    disabled={isDeleting}
                    onClick={() => setConfirm({ kind: "all" })}
                  >
                    <Trash2 size={14} aria-hidden /> Tümünü Sil
                  </Button>
                ) : null}
              </div>
            </div>

            {unsupportedMsg ? (
              <p className={styles.warn} role="status">
                {unsupportedMsg}
                <button
                  type="button"
                  style={{ marginLeft: "0.5rem", border: 0, background: "transparent", cursor: "pointer" }}
                  onClick={() => setUnsupportedMsg(null)}
                >
                  Kapat
                </button>
              </p>
            ) : null}

            {filteredCases.length === 0 ? (
              <div className={styles.empty}>
                {searchQuery ? <Search size={28} aria-hidden /> : <FileText size={28} aria-hidden />}
                <strong>
                  {searchQuery
                    ? "Sonuç bulunamadı"
                    : activeView === ALL_FOLDERS_VIEW
                      ? "Henüz kayıtlı hesaplama yok"
                      : "Bu klasör boş"}
                </strong>
                {!searchQuery && activeView === ALL_FOLDERS_VIEW ? (
                  <span>Hesaplama yaptığınızda sonuçları burada saklayabilirsiniz</span>
                ) : null}
                {!searchQuery && activeView !== ALL_FOLDERS_VIEW ? (
                  <span>Bu bölümde hesaplama yok. Tüm Hesaplamalar görünümünden kayıt seçip taşıyabilirsiniz.</span>
                ) : null}
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          aria-label="Tümünü seç"
                          style={{ border: 0, background: "transparent", cursor: "pointer" }}
                        >
                          {selectedIds.length === filteredCases.length && filteredCases.length > 0 ? (
                            <CheckSquare size={16} />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </th>
                      <th>#</th>
                      <th>Kayıt Adı</th>
                      <th>Tür</th>
                      <th>Tarih</th>
                      <th>Başlangıç</th>
                      <th>Bitiş</th>
                      <th>Net Toplam</th>
                      <th>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.map((c, idx) => {
                      const isSelected = selectedIds.includes(c.id);
                      const routeInfo = getCaseRouteInfo(c.hesaplama_tipi);
                      return (
                        <tr key={c.id}>
                          <td>
                            <button
                              type="button"
                              onClick={() => toggleSelectId(c.id)}
                              aria-label="Seç"
                              style={{ border: 0, background: "transparent", cursor: "pointer" }}
                            >
                              {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                            </button>
                          </td>
                          <td>{idx + 1}</td>
                          <td>
                            {editingNameId === c.id ? (
                              <input
                                value={editingNameValue}
                                onChange={(e) => setEditingNameValue(e.target.value)}
                                onBlur={() => void handleSaveName(c.id, editingNameValue)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void handleSaveName(c.id, editingNameValue);
                                  if (e.key === "Escape") {
                                    setEditingNameId(null);
                                    setEditingNameValue("");
                                  }
                                }}
                                autoFocus
                                disabled={savingNameId === c.id}
                                style={{
                                  width: "100%",
                                  minHeight: "1.85rem",
                                  padding: "0.25rem 0.4rem",
                                  border: "1px solid var(--border)",
                                  borderRadius: "var(--radius-sm)",
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                style={{
                                  border: 0,
                                  background: "transparent",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  fontWeight: 550,
                                  color: "var(--text-strong)",
                                  maxWidth: "12rem",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                title={c.kayit_adi || undefined}
                                onClick={() => {
                                  setEditingNameId(c.id);
                                  setEditingNameValue((c.kayit_adi || "").trim());
                                }}
                              >
                                {savingNameId === c.id ? "Kaydediliyor..." : c.kayit_adi || "—"}
                              </button>
                            )}
                            {activeView === ALL_FOLDERS_VIEW && effectiveFolderId(c, folderIds) ? (
                              <span className={styles.folderMeta} title={folderNames.get(c.folderId ?? "")}>
                                <Folder size={11} aria-hidden />
                                <span>{folderNames.get(c.folderId ?? "")}</span>
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <span title={routeInfo.label}>
                              {routeInfo.label}
                              {!routeInfo.supported ? (
                                <span className={styles.unsupported}> (yakında)</span>
                              ) : null}
                            </span>
                          </td>
                          <td>{fmtDate(c.created_at)}</td>
                          <td>{fmtDate(c.ise_giris)}</td>
                          <td>{fmtDate(c.isten_cikis)}</td>
                          <td style={{ fontWeight: 600 }}>
                            {c.net_toplam != null ? moneyFmt.format(Number(c.net_toplam)) : "-"}
                          </td>
                          <td>
                            <div className={styles.iconActions}>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Aç"
                                aria-label="Aç"
                                onClick={() => handleOpen(c)}
                              >
                                <Edit size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Kopyala"
                                aria-label="Kopyala"
                                disabled={copyingId === c.id}
                                onClick={() => void handleCopy(c)}
                              >
                                <Copy size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Sil"
                                aria-label="Sil"
                                onClick={() => setConfirm({ kind: "single", id: c.id })}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirm != null}
        title="Hesaplamayı sil"
        description={
          confirm?.kind === "all"
            ? activeView === ALL_FOLDERS_VIEW && !searchQuery.trim()
              ? `Tüm hesaplamalar (${filteredCases.length} adet) silinecek. Bu işlem geri alınamaz!`
              : `Bu görünümdeki ${filteredCases.length} hesaplama silinecek. Bu işlem geri alınamaz!`
            : confirm?.kind === "selected"
              ? `${selectedIds.length} hesaplama silinecek. Emin misiniz?`
              : "Bu hesaplamayı silmek istediğinize emin misiniz?"
        }
        confirmLabel="Sil"
        danger
        loading={isDeleting}
        onConfirm={() => void runDelete()}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={folderToDelete != null}
        title="Klasörü sil"
        description={
          folderToDelete
            ? `"${folderToDelete.name}" klasörü silinecek. İçindeki ${
                folderCounts.byFolder.get(folderToDelete.id) ?? 0
              } hesaplama silinmez, Klasörsüz bölümüne taşınır.`
            : ""
        }
        confirmLabel="Klasörü Sil"
        danger
        loading={folderBusy}
        onConfirm={() => void handleDeleteFolder()}
        onCancel={() => setFolderToDelete(null)}
      />
    </div>
  );
}

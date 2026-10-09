export const ALL_FOLDERS_VIEW = "all";
export const UNFILED_FOLDER_VIEW = "none";

/** "all", "none" veya klasör kimliği. */
export type FolderView = string;

type FolderAware = { folderId: string | null };

/** Silinmiş veya bilinmeyen klasöre bağlı kayıt da klasörsüz sayılır; böylece hiçbir kayıt görünümden düşmez. */
export function effectiveFolderId(row: FolderAware, folderIds: ReadonlySet<string>): string | null {
  return row.folderId && folderIds.has(row.folderId) ? row.folderId : null;
}

export function filterRowsByFolder<T extends FolderAware>(
  rows: T[],
  view: FolderView,
  folderIds: ReadonlySet<string>,
): T[] {
  if (view === ALL_FOLDERS_VIEW) return rows;
  if (view === UNFILED_FOLDER_VIEW) return rows.filter((row) => effectiveFolderId(row, folderIds) === null);
  return rows.filter((row) => effectiveFolderId(row, folderIds) === view);
}

export function countRowsByFolder(
  rows: FolderAware[],
  folderIds: ReadonlySet<string>,
): { all: number; unfiled: number; byFolder: Map<string, number> } {
  const byFolder = new Map<string, number>();
  let unfiled = 0;
  for (const row of rows) {
    const id = effectiveFolderId(row, folderIds);
    if (id === null) unfiled += 1;
    else byFolder.set(id, (byFolder.get(id) ?? 0) + 1);
  }
  return { all: rows.length, unfiled, byFolder };
}

/** Seçili klasör silinirse veya bulunamazsa görünüm Tüm Hesaplamalar'a döner. */
export function normalizeFolderView(view: FolderView, folderIds: ReadonlySet<string>): FolderView {
  if (view === ALL_FOLDERS_VIEW || view === UNFILED_FOLDER_VIEW) return view;
  return folderIds.has(view) ? view : ALL_FOLDERS_VIEW;
}

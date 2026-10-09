import { describe, expect, it } from "vitest";
import {
  ALL_FOLDERS_VIEW,
  UNFILED_FOLDER_VIEW,
  countRowsByFolder,
  filterRowsByFolder,
  normalizeFolderView,
} from "./savedCaseFolders";

const rows = [
  { id: 1, folderId: null },
  { id: 2, folderId: "f1" },
  { id: 3, folderId: "f2" },
  { id: 4, folderId: "silinmis" },
];
const folderIds = new Set(["f1", "f2"]);

describe("kayıtlı hesaplama klasör görünümü", () => {
  it("Tüm Hesaplamalar her kaydı gösterir", () => {
    expect(filterRowsByFolder(rows, ALL_FOLDERS_VIEW, folderIds).map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });

  it("Klasörsüz görünümü bilinmeyen klasöre bağlı kaydı da gösterir", () => {
    expect(filterRowsByFolder(rows, UNFILED_FOLDER_VIEW, folderIds).map((r) => r.id)).toEqual([1, 4]);
  });

  it("klasör görünümü yalnız o klasörü gösterir", () => {
    expect(filterRowsByFolder(rows, "f1", folderIds).map((r) => r.id)).toEqual([2]);
  });

  it("sayılar toplamı tüm kayıtlara eşittir", () => {
    const counts = countRowsByFolder(rows, folderIds);
    expect(counts.all).toBe(4);
    expect(counts.unfiled).toBe(2);
    expect(counts.byFolder.get("f1")).toBe(1);
    expect(counts.unfiled + [...counts.byFolder.values()].reduce((a, b) => a + b, 0)).toBe(counts.all);
  });

  it("silinen klasör seçiliyse Tüm Hesaplamalar'a döner", () => {
    expect(normalizeFolderView("f1", folderIds)).toBe("f1");
    expect(normalizeFolderView("yok", folderIds)).toBe(ALL_FOLDERS_VIEW);
    expect(normalizeFolderView(UNFILED_FOLDER_VIEW, folderIds)).toBe(UNFILED_FOLDER_VIEW);
  });
});

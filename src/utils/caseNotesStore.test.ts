import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchToolAction, NAV_GROUPS } from "@/shell/nav";
import {
  CASE_NOTES_KEY_PREFIX,
  createDraftNote,
  readCaseNotes,
  sanitizeNotes,
  writeCaseNotes,
} from "@/utils/caseNotesStore";
import {
  clearCalculationBinding,
  draftIdFromPath,
  readDraftNotes,
  writeDraftNotes,
} from "@/utils/calculationCaseBinding";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

beforeEach(() => {
  const local = memoryStorage();
  const session = memoryStorage();
  vi.stubGlobal("window", { localStorage: local, sessionStorage: session });
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", session);
});

describe("Hesaplama Notu", () => {
  it("sidebar not eylemi yalnızca addNote çağırır", () => {
    const tools = NAV_GROUPS.find((group) => group.id === "tools");
    const note = tools?.items.find((item) => item.label === "Hesaplama Notu");
    const addNote = vi.fn();
    const openTagModal = vi.fn();
    const openInterestCalculator = vi.fn();
    dispatchToolAction(note!.action!, { addNote, openTagModal, openInterestCalculator });
    expect(addNote).toHaveBeenCalledTimes(1);
    expect(openTagModal).not.toHaveBeenCalled();
    expect(openInterestCalculator).not.toHaveBeenCalled();
  });

  it("her eklemede yeni not açar", () => {
    const first = createDraftNote("draft-kidem", 10);
    const second = createDraftNote("draft-kidem", 11);
    const notes = [first, second];
    expect(notes).toHaveLength(2);
    expect(first).toMatchObject({ x: 150, y: 150, text: "" });
    expect(second.id).not.toBe(first.id);
  });

  it("metin, konum ve silme kayıtta kalır", () => {
    const note = { ...createDraftNote("42", 1), text: "geçici not", x: 40, y: 80 };
    const kept = [note].filter((item) => item.id !== "yok");
    const removed = kept.filter((item) => item.id !== note.id);
    writeCaseNotes("42", kept);
    expect(readCaseNotes("42")).toEqual([note]);
    writeCaseNotes("42", removed);
    expect(readCaseNotes("42")).toEqual([]);
  });

  it("kaynak sürüklemesi koordinatı kırpmaz", () => {
    const note = { ...createDraftNote("draft-kidem", 3), x: -400, y: 4000 };
    writeDraftNotes("draft-kidem", [note]);
    expect(readDraftNotes("draft-kidem")[0]).toMatchObject({ x: -400, y: 4000 });
  });

  it("taslak not oturum deposunda kalır ve bozuk kayıt boş döner", () => {
    const draftId = draftIdFromPath("/kidem-tazminati");
    writeDraftNotes(draftId, [createDraftNote(draftId, 5)]);
    expect(sessionStorage.getItem(`v35:draft-notes:${draftId}`)).toBeTruthy();
    expect(localStorage.getItem(`v35:draft-notes:${draftId}`)).toBeNull();
    sessionStorage.setItem(`v35:draft-notes:${draftId}`, "{bozuk");
    expect(readDraftNotes(draftId)).toEqual([]);
    localStorage.setItem(`${CASE_NOTES_KEY_PREFIX}42`, "{bozuk");
    expect(readCaseNotes("42")).toEqual([]);
    expect(sanitizeNotes([{ id: 1 }, { id: "n", text: "a", x: 1, y: 2 }], "42")).toEqual([
      { id: "n", calculationId: "42", text: "a", x: 1, y: 2 },
    ]);
  });

  it("yeni hesaplama taslak notu siler, hesap sonucu nesnesine yazmaz", () => {
    const result = { net: 1250 };
    const draftId = draftIdFromPath("/ihbar-tazminati");
    writeDraftNotes(draftId, [{ ...createDraftNote(draftId, 8), text: "silinecek" }]);
    clearCalculationBinding("/ihbar-tazminati", draftId);
    expect(readDraftNotes(draftId)).toEqual([]);
    expect(result).toEqual({ net: 1250 });
    expect(Object.keys(result)).not.toContain("notes");
  });
});

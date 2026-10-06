import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TAG_COLOR, PRESET_COLORS } from "@/components/calculation-tools/AddTagModal";
import { dispatchToolAction, NAV_GROUPS } from "@/shell/nav";
import { createDraftTag, readCaseTags, sanitizeTags, writeCaseTags } from "@/utils/caseTagsStore";
import { draftIdFromPath, readDraftTags, writeDraftTags } from "@/utils/calculationCaseBinding";

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

describe("Kategori Etiketi", () => {
  it("Hesaplama Notunun altında openTagModal çağırır ve faiz hesaplayıcıyı açmaz", () => {
    const tools = NAV_GROUPS.find((group) => group.id === "tools");
    const tag = tools?.items[3];
    expect(tag?.label).toBe("Kategori Etiketi");
    expect(tag?.action).toBe("add-tag");
    expect(tools?.items[2]?.label).toBe("Hesaplama Notu");
    const addNote = vi.fn();
    const openTagModal = vi.fn();
    const openInterestCalculator = vi.fn();
    dispatchToolAction("add-tag", { addNote, openTagModal, openInterestCalculator });
    expect(openTagModal).toHaveBeenCalledTimes(1);
    expect(addNote).not.toHaveBeenCalled();
    expect(openInterestCalculator).not.toHaveBeenCalled();
  });

  it("boş ad eklenmez, varsayılan renk mavidir", () => {
    expect(DEFAULT_TAG_COLOR).toBe("#3b82f6");
    expect(PRESET_COLORS).toHaveLength(10);
    expect(createDraftTag("draft-kidem", DEFAULT_TAG_COLOR, "   ").label).toBe("");
    const tag = createDraftTag("draft-kidem", "#ef4444", "  Acil  ", 4);
    expect(tag).toMatchObject({ id: "draft-tag-4", color: "#ef4444", label: "Acil" });
  });

  it("kayıtlı hesap etiketini saklar, bozuk kaydı yutar ve sonucu değiştirmez", () => {
    const result = { net: 900 };
    const tag = createDraftTag("42", "#22c55e", "Revize", 7);
    writeCaseTags("42", [tag]);
    expect(readCaseTags("42")).toEqual([{ ...tag, color: "#22c55e" }]);
    writeCaseTags("42", []);
    expect(readCaseTags("42")).toEqual([]);
    localStorage.setItem("bilirkisi-desktop:case-tags:v1:42", "{bozuk");
    expect(readCaseTags("42")).toEqual([]);
    expect(sanitizeTags([{ id: "t", label: "  ", color: "#fff" }, { id: "ok", label: "Acil", color: "#EF4444" }], "42")).toEqual([
      { id: "ok", calculationId: "42", label: "Acil", color: "#ef4444" },
    ]);
    expect(result).toEqual({ net: 900 });
  });

  it("taslak etiket oturum deposunda kalır", () => {
    const draftId = draftIdFromPath("/kidem-tazminati");
    writeDraftTags(draftId, [createDraftTag(draftId, DEFAULT_TAG_COLOR, "Acil", 2)]);
    expect(sessionStorage.getItem(`v35:draft-tags:${draftId}`)).toContain("Acil");
    expect(localStorage.getItem(`v35:draft-tags:${draftId}`)).toBeNull();
    expect(readDraftTags(draftId)[0]?.label).toBe("Acil");
    sessionStorage.setItem(`v35:draft-tags:${draftId}`, "{bozuk");
    expect(readDraftTags(draftId)).toEqual([]);
  });
});

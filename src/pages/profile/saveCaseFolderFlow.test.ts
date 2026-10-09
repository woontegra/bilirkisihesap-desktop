import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalculationFolder, CalculationRecord } from "@shared/desktop-contract";
import { createSavedCase, getSavedCase, listSavedCases, updateSavedCase } from "@/api/savedCases";
import {
  isSaveCancelledMessage,
  registerSaveFolderPrompter,
  SAVE_CANCELLED_MESSAGE,
  SaveCancelledError,
  type SaveFolderChoice,
  type SaveFolderRequest,
} from "@/api/saveFolderPrompt";
import { createCalcBackendCrud } from "@/pages/hesaplamalar/shared/calcBackendCrud";

type Ok<T> = { ok: true; data: T };
const ok = <T,>(data: T): Ok<T> => ({ ok: true, data });
const fail = (message: string) => ({ ok: false as const, message });

function createFakeBridge() {
  const records = new Map<string, CalculationRecord>();
  const folders = new Map<string, CalculationFolder>();
  const settings = new Map<string, string>();
  let seq = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const failNextCreate = { value: false };
  const bridge = {
    getSetting: vi.fn(async (key: string) => ok(settings.has(key) ? { key, value: settings.get(key)! } : null)),
    setSetting: vi.fn(async (key: string, value: string) => {
      settings.set(key, value);
      return ok(null);
    }),
    listCalculationRecords: vi.fn(async () => ok([...records.values()])),
    getCalculationRecord: vi.fn(async (id: string) => {
      const record = records.get(id);
      return record ? ok({ ...record }) : fail("Kayıt bulunamadı");
    }),
    createCalculationRecord: vi.fn(async (input: Record<string, unknown>) => {
      if (failNextCreate.value) {
        failNextCreate.value = false;
        return fail("Disk dolu");
      }
      const now = new Date().toISOString();
      const record = {
        id: nextId(),
        calculationType: input.calculationType,
        title: input.title,
        notes: input.notes ?? null,
        inputJson: input.inputJson,
        resultJson: input.resultJson ?? null,
        createdAt: now,
        updatedAt: now,
        folderId: null,
      } as CalculationRecord;
      records.set(record.id, record);
      return ok({ ...record });
    }),
    updateCalculationRecord: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const record = records.get(id);
      if (!record) return fail("Kayıt bulunamadı");
      const next = { ...record, ...patch, updatedAt: new Date().toISOString() } as CalculationRecord;
      records.set(id, next);
      return ok({ ...next });
    }),
    listCalculationFolders: vi.fn(async () => ok([...folders.values()])),
    createCalculationFolder: vi.fn(async (name: string) => {
      const now = new Date().toISOString();
      const folder = { id: nextId(), name, createdAt: now, updatedAt: now };
      folders.set(folder.id, folder);
      return ok(folder);
    }),
    deleteCalculationFolder: vi.fn(async (id: string) => {
      folders.delete(id);
      return ok({ id, releasedRecords: 0 });
    }),
    moveCalculationRecordsToFolder: vi.fn(async (ids: string[], folderId: string | null) => {
      for (const id of ids) {
        const record = records.get(id);
        if (record) records.set(id, { ...record, folderId });
      }
      return ok({ moved: ids.length });
    }),
  };
  return { bridge, records, folders, settings, failNextCreate };
}

let fake: ReturnType<typeof createFakeBridge>;
let unregister: (() => void) | null = null;
let requests: SaveFolderRequest[];

function usePrompt(answer: (request: SaveFolderRequest) => SaveFolderChoice | null) {
  unregister?.();
  unregister = registerSaveFolderPrompter(async (request) => {
    requests.push(request);
    return answer(request);
  });
}

function addFolder(name: string): CalculationFolder {
  const now = new Date().toISOString();
  const folder = { id: `f0000000-0000-4000-8000-${String(fake.folders.size + 1).padStart(12, "0")}`, name, createdAt: now, updatedAt: now };
  fake.folders.set(folder.id, folder);
  return folder;
}

const payload = (name: string, brut = 1000) => ({
  name,
  type: "prim_alacagi",
  data: { form: { tutar: brut }, results: { brut, net: brut * 0.8 } },
});

beforeEach(() => {
  fake = createFakeBridge();
  requests = [];
  vi.stubGlobal("window", { bilirkisiDesktop: fake.bridge, location: { pathname: "/prim-alacagi" } });
  vi.stubGlobal("sessionStorage", { setItem: () => undefined, getItem: () => null, removeItem: () => undefined });
});

afterEach(() => {
  unregister?.();
  unregister = null;
  vi.unstubAllGlobals();
});

describe("Kaydet → klasör seçimi", () => {
  it("varsayılan Klasörsüz seçimiyle yeni kayıt klasörsüz oluşturulur", async () => {
    usePrompt((req) => ({ folderId: req.currentFolderId }));
    const saved = await createSavedCase(payload("Ahmet prim"));
    expect(requests).toEqual([{ mode: "create", suggestedName: "Ahmet prim", currentFolderId: null }]);
    expect(saved.folderId).toBeNull();
    expect(fake.bridge.moveCalculationRecordsToFolder).not.toHaveBeenCalled();
    expect(fake.folders.size).toBe(0);
  });

  it("yeni kayıt doğrudan seçilen mevcut klasöre kaydedilir", async () => {
    const folder = addFolder("Ahmet Y. Dosyası");
    usePrompt(() => ({ folderId: folder.id }));
    const saved = await createSavedCase(payload("Ahmet prim"));
    expect(saved.folderId).toBe(folder.id);
    const [stored] = [...fake.records.values()];
    expect(stored.folderId).toBe(folder.id);
    expect(stored.title).toBe("Ahmet prim");
  });

  it("aynı pencereden yazılan yeni klasör kayıt onaylanınca oluşturulur ve kayıt içine konur", async () => {
    usePrompt(() => ({ newFolderName: "2025/465 İstanbul 9. Ağır Ceza Mahkemesi" }));
    const saved = await createSavedCase(payload("Dosya hesabı"));
    const folders = [...fake.folders.values()];
    expect(folders.map((f) => f.name)).toEqual(["2025/465 İstanbul 9. Ağır Ceza Mahkemesi"]);
    expect(saved.folderId).toBe(folders[0].id);
  });

  it("yeni klasör adı mevcut klasörle aynıysa (Türkçe büyük/küçük harf) ikinci klasör açılmaz", async () => {
    const folder = addFolder("İzmir Dosyası");
    usePrompt(() => ({ newFolderName: "izmir dosyası" }));
    const saved = await createSavedCase(payload("Kayıt"));
    expect(fake.folders.size).toBe(1);
    expect(saved.folderId).toBe(folder.id);
  });

  it("tek pencerede düzenlenen kayıt adı kayda yazılır", async () => {
    usePrompt(() => ({ name: "  Dosya 2025/465 – düzeltilmiş  ", folderId: null }));
    const saved = await createSavedCase(payload("Prim Alacağı"));
    expect(saved.name).toBe("Dosya 2025/465 – düzeltilmiş");
    expect([...fake.records.values()][0].title).toBe("Dosya 2025/465 – düzeltilmiş");
  });

  it("sayfa ad önermezse pencereye boş öneri gider; pencere yoksa eski otomatik ad kullanılır", async () => {
    usePrompt(() => ({ name: "Elle yazılan ad", folderId: null }));
    const saved = await createSavedCase(payload(""));
    expect(requests[0].suggestedName).toBe("");
    expect(saved.name).toBe("Elle yazılan ad");
    unregister?.();
    unregister = null;
    const legacy = await createSavedCase(payload(""));
    expect(legacy.name).toMatch(/^prim_alacagi — /);
  });

  it("iptal mesajı bildirim katmanında sessizce yutulacak şekilde işaretlidir", () => {
    expect(new SaveCancelledError().message).toBe(SAVE_CANCELLED_MESSAGE);
    expect(isSaveCancelledMessage(SAVE_CANCELLED_MESSAGE)).toBe(true);
    expect(isSaveCancelledMessage("Kayıt yapılamadı")).toBe(false);
  });

  it("yeni kayıtta iptal edilirse hiçbir veri değişmez", async () => {
    addFolder("Mevcut");
    usePrompt(() => null);
    await expect(createSavedCase(payload("İptal"))).rejects.toBeInstanceOf(SaveCancelledError);
    expect(fake.records.size).toBe(0);
    expect(fake.folders.size).toBe(1);
    expect(fake.settings.size).toBe(0);
    expect(fake.bridge.createCalculationRecord).not.toHaveBeenCalled();
    expect(fake.bridge.createCalculationFolder).not.toHaveBeenCalled();
  });

  it("kayıt oluşturulamazsa pencereden açılan yeni klasör geri alınır", async () => {
    usePrompt(() => ({ newFolderName: "Yarım kalan" }));
    fake.failNextCreate.value = true;
    await expect(createSavedCase(payload("Hata"))).rejects.toThrow("Disk dolu");
    expect(fake.records.size).toBe(0);
    expect(fake.folders.size).toBe(0);
  });
});

describe("Güncelle → mevcut klasör korunur", () => {
  async function seedInFolder() {
    const folder = addFolder("Ayşe K. Dosyası");
    usePrompt(() => ({ folderId: folder.id }));
    const saved = await createSavedCase(payload("Ayşe prim", 500));
    requests = [];
    return { folder, saved };
  }

  it("pencere mevcut klasörü seçili getirir; onaylanınca klasör aynen kalır ve veriler güncellenir", async () => {
    const { folder, saved } = await seedInFolder();
    usePrompt((req) => ({ folderId: req.currentFolderId }));
    const updated = await updateSavedCase(saved.id, payload("Ayşe prim (düzeltilmiş)", 750));
    expect(requests).toEqual([{ mode: "update", suggestedName: "Ayşe prim (düzeltilmiş)", currentFolderId: folder.id }]);
    expect(updated.folderId).toBe(folder.id);
    const reopened = await getSavedCase(saved.id);
    expect(reopened.name).toBe("Ayşe prim (düzeltilmiş)");
    expect(reopened.folderId).toBe(folder.id);
    expect((reopened.data as { form: { tutar: number } }).form.tutar).toBe(750);
    expect(fake.bridge.moveCalculationRecordsToFolder).toHaveBeenCalledTimes(1);
  });

  it("güncellemede pencerede değiştirilen ad kayda yazılır, klasör korunur", async () => {
    const { folder, saved } = await seedInFolder();
    usePrompt((req) => ({ name: "Ayşe prim – yeni ad", folderId: req.currentFolderId }));
    const updated = await updateSavedCase(saved.id, payload("Ayşe prim"));
    expect(updated.name).toBe("Ayşe prim – yeni ad");
    expect(updated.folderId).toBe(folder.id);
  });

  it("güncellemede sayfa ad göndermezse kaydın mevcut adı önerilir", async () => {
    const { saved } = await seedInFolder();
    usePrompt((req) => ({ name: req.suggestedName, folderId: req.currentFolderId }));
    const updated = await updateSavedCase(saved.id, payload(""));
    expect(requests[0].suggestedName).toBe("Ayşe prim");
    expect(updated.name).toBe("Ayşe prim");
  });

  it("kullanıcı güncellerken klasörü değiştirebilir veya Klasörsüz'e alabilir", async () => {
    const { saved } = await seedInFolder();
    const other = addFolder("Diğer");
    usePrompt(() => ({ folderId: other.id }));
    expect((await updateSavedCase(saved.id, payload("Ayşe prim"))).folderId).toBe(other.id);
    usePrompt(() => ({ folderId: null }));
    expect((await updateSavedCase(saved.id, payload("Ayşe prim"))).folderId).toBeNull();
  });

  it("güncellemede iptal edilirse kayıt adı, verisi ve klasörü değişmez", async () => {
    const { folder, saved } = await seedInFolder();
    const before = { ...[...fake.records.values()][0] };
    usePrompt(() => null);
    await expect(updateSavedCase(saved.id, payload("Değişmemeli", 999))).rejects.toBeInstanceOf(SaveCancelledError);
    const after = [...fake.records.values()][0];
    expect(after).toEqual(before);
    expect(after.folderId).toBe(folder.id);
    expect(fake.bridge.updateCalculationRecord).not.toHaveBeenCalled();
  });

  it("promptFolder:false (yeniden adlandırma/kopya) pencere açmaz ve klasörü korur", async () => {
    const { folder, saved } = await seedInFolder();
    usePrompt(() => {
      throw new Error("açılmamalıydı");
    });
    const renamed = await updateSavedCase(saved.id, payload("Yeni ad"), { promptFolder: false });
    expect(requests).toHaveLength(0);
    expect(renamed.folderId).toBe(folder.id);
    const copy = await createSavedCase(payload("Kopya"), { promptFolder: false });
    expect(copy.folderId).toBeNull();
  });

  it("pencere kayıtlı değilse eski davranış sürer: yeni kayıt klasörsüz, güncelleme klasörü korur", async () => {
    const { folder, saved } = await seedInFolder();
    unregister?.();
    unregister = null;
    expect((await createSavedCase(payload("Eski akış"))).folderId).toBeNull();
    expect((await updateSavedCase(saved.id, payload("Ayşe prim"))).folderId).toBe(folder.id);
  });
});

describe("ortak hesaplama kayıt fabrikası", () => {
  const crud = createCalcBackendCrud<{ tutar: number }>({
    recordType: "prim_alacagi",
    isRecordType: (t) => t === "prim_alacagi",
    mapFormFromBackend: (data) => {
      const form = (data as { form?: { tutar?: number } }).form;
      return form && typeof form.tutar === "number" ? { tutar: form.tutar } : null;
    },
    buildSaveData: (form, result) => ({ form, formValues: form, results: result }),
  });

  it("Kaydet seçilen klasöre yazar, kayıt açılır ve Güncelle mevcut klasörü korur", async () => {
    const folder = addFolder("Ahmet Y. Dosyası");
    usePrompt(() => ({ folderId: folder.id }));
    const created = await crud.saveCase("Ahmet prim", { tutar: 100 }, { brut: 100, net: 80 });
    expect(created.folderId).toBe(folder.id);

    const { record, form } = await crud.loadCase(created.id);
    expect(form).toEqual({ tutar: 100 });
    expect(record.folderId).toBe(folder.id);

    usePrompt((req) => ({ folderId: req.currentFolderId }));
    const updated = await crud.saveCase("Ahmet prim", { tutar: 150 }, { brut: 150, net: 120 }, String(created.id));
    expect(updated.id).toBe(created.id);
    expect(updated.folderId).toBe(folder.id);
    expect(requests.at(-1)).toMatchObject({ mode: "update", currentFolderId: folder.id });

    const list = await listSavedCases();
    expect(list).toHaveLength(1);
    expect(list[0].folderId).toBe(folder.id);
  });
});

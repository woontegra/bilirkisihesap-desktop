export type SaveFolderRequest = {
  mode: "create" | "update";
  /** Sayfanın önerdiği kayıt adı; boş olabilir. */
  suggestedName: string;
  currentFolderId: string | null;
};

/**
 * name: kullanıcının pencerede onayladığı kayıt adı.
 * folderId (null = Klasörsüz) veya kayıt onaylanınca oluşturulacak yeni klasör adı.
 */
export type SaveFolderChoice = { name?: string } & ({ folderId: string | null } | { newFolderName: string });

export type SaveFolderPrompter = (request: SaveFolderRequest) => Promise<SaveFolderChoice | null>;

/** Sayfalar bu mesajı hata bildirimi olarak iletir; ToastContext bunu sessizce yutar. */
export const SAVE_CANCELLED_MESSAGE = "Kayıt iptal edildi; hiçbir değişiklik yapılmadı.";

export class SaveCancelledError extends Error {
  constructor() {
    super(SAVE_CANCELLED_MESSAGE);
    this.name = "SaveCancelledError";
  }
}

export function isSaveCancelledMessage(message: string): boolean {
  return message === SAVE_CANCELLED_MESSAGE;
}

let prompter: SaveFolderPrompter | null = null;
let warn: ((message: string) => void) | null = null;

export function registerSaveFolderPrompter(
  fn: SaveFolderPrompter,
  onWarning?: (message: string) => void,
): () => void {
  prompter = fn;
  warn = onWarning ?? null;
  return () => {
    if (prompter === fn) {
      prompter = null;
      warn = null;
    }
  };
}

/** Pencere kayıtlı değilse (test, arka plan) önceki davranış korunur: ad ve mevcut klasör aynen kalır. */
export async function requestSaveFolder(request: SaveFolderRequest): Promise<SaveFolderChoice | null> {
  if (!prompter) return { name: request.suggestedName, folderId: request.currentFolderId };
  return prompter(request);
}

export function reportSaveFolderWarning(message: string): void {
  warn?.(message);
}

export function folderNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

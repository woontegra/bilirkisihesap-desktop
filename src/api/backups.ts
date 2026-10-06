import { ApiError } from "./client";

function api() {
  const desktop = window.bilirkisiDesktop;
  if (!desktop) throw new ApiError("Masaüstü köprüsü yok.", 0);
  return desktop;
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new ApiError(result.message, 403);
  return result.data;
}

export async function exportBackup(): Promise<{ cancelled: boolean; filename?: string }> {
  return unwrap(await api().exportSavedCasesBackup());
}

export async function importBackup(file: File): Promise<{ cancelled: boolean; message?: string }> {
  const buffer = await file.arrayBuffer();
  return unwrap(await api().importSavedCasesBackup(buffer));
}

import type { Note } from "@/context/calculationToolsTypes";

const MAX_NOTES = 100;
const MAX_TEXT = 20_000;
const MAX_ID = 80;

export const CASE_NOTES_KEY_PREFIX = "bilirkisi-desktop:case-notes:v1:";

export function caseNotesKey(caseId: string): string {
  return `${CASE_NOTES_KEY_PREFIX}${caseId}`;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function sanitizeNotes(value: unknown, calculationId: string): Note[] {
  if (!Array.isArray(value)) return [];
  const notes: Note[] = [];
  for (const item of value) {
    if (notes.length >= MAX_NOTES) break;
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || row.id.length === 0 || row.id.length > MAX_ID) continue;
    if (typeof row.text !== "string") continue;
    if (typeof row.x !== "number" || typeof row.y !== "number") continue;
    if (!Number.isFinite(row.x) || !Number.isFinite(row.y)) continue;
    notes.push({
      id: row.id,
      calculationId,
      x: row.x,
      y: row.y,
      text: row.text.slice(0, MAX_TEXT),
    });
  }
  return notes;
}

export function readCaseNotes(caseId: string): Note[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(caseNotesKey(caseId));
    if (!raw) return [];
    return sanitizeNotes(JSON.parse(raw) as unknown, caseId);
  } catch {
    return [];
  }
}

export function writeCaseNotes(caseId: string, notes: Note[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(caseNotesKey(caseId), JSON.stringify(sanitizeNotes(notes, caseId)));
  } catch {
    /* ignore */
  }
}

export function createDraftNote(calculationId: string, now = Date.now()): Note {
  return {
    id: `draft-note-${now}`,
    calculationId,
    x: 150,
    y: 150,
    text: "",
  };
}

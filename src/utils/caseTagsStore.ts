import type { Tag } from "@/context/calculationToolsTypes";

const MAX_TAGS = 50;
const MAX_LABEL = 80;
const MAX_ID = 80;
const COLOR = /^#[0-9a-fA-F]{6}$/;

export const CASE_TAGS_KEY_PREFIX = "bilirkisi-desktop:case-tags:v1:";

export function caseTagsKey(caseId: string): string {
  return `${CASE_TAGS_KEY_PREFIX}${caseId}`;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function sanitizeTags(value: unknown, calculationId: string): Tag[] {
  if (!Array.isArray(value)) return [];
  const tags: Tag[] = [];
  for (const item of value) {
    if (tags.length >= MAX_TAGS) break;
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || row.id.length === 0 || row.id.length > MAX_ID) continue;
    if (typeof row.label !== "string") continue;
    const label = row.label.trim().slice(0, MAX_LABEL);
    if (!label) continue;
    if (typeof row.color !== "string" || !COLOR.test(row.color)) continue;
    tags.push({
      id: row.id,
      calculationId,
      color: row.color.toLowerCase(),
      label,
    });
  }
  return tags;
}

export function readCaseTags(caseId: string): Tag[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(caseTagsKey(caseId));
    if (!raw) return [];
    return sanitizeTags(JSON.parse(raw) as unknown, caseId);
  } catch {
    return [];
  }
}

export function writeCaseTags(caseId: string, tags: Tag[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(caseTagsKey(caseId), JSON.stringify(sanitizeTags(tags, caseId)));
  } catch {
    /* ignore */
  }
}

export function createDraftTag(calculationId: string, color: string, label: string, now = Date.now()): Tag {
  return {
    id: `draft-tag-${now}`,
    calculationId,
    color,
    label: label.trim(),
  };
}

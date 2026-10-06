import { createExtraSetsApi, type ExtraSetItem, type SavedExtraSet } from "@/api/localExtraSets";
import { newLocalId } from "./model";

export type { ExtraSetItem, SavedExtraSet };

export const {
  describeSetsError,
  listExtraSets,
  saveExtraSet,
  deleteExtraSet,
  upsertExtraSet,
  removeExtraSet,
} = createExtraSetsApi("extra-calculations-sets", newLocalId);

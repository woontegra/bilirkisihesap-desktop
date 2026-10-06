import { createExtraSetsApi } from "@/api/localExtraSets";
import { newLocalId } from "./model";

export const {
  describeSetsError,
  listExtraSets,
  saveExtraSet,
  deleteExtraSet,
  upsertExtraSet,
  removeExtraSet,
} = createExtraSetsApi("extra-calculations-sets", newLocalId);

export type UpdateUiState =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "error";

export type UpdateCheckSource = "auto" | "manual";

export type UpdateProgressInfo = {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
};

export type UpdateStatusSnapshot = {
  state: UpdateUiState;
  currentVersion: string;
  availableVersion: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  progress: UpdateProgressInfo | null;
  errorMessage: string | null;
  showPrompt: boolean;
  infoMessage: string | null;
  lastCheckSource: UpdateCheckSource | null;
  packaged: boolean;
};

export type UpdateActionResult = { ok: true } | { ok: false; error: string };

import { app } from "electron";

export function isDevelopmentRuntime(): boolean {
  if (app.isPackaged) {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}

/**
 * electron-builder 26.15.3 extractArchive does one fs.rename of
 * release/win-unpacked.tmp -> release/win-unpacked.
 * On Windows, MoveFileEx often returns EPERM/EBUSY right after the zip
 * extract even though both paths are valid. Upstream later retries that
 * rename and falls back to copy. This preload applies the same behavior
 * only to that unpack move, before electron-builder loads.
 */
const fs = require("fs/promises");

const RETRY_CODES = new Set(["ENOENT", "EPERM", "EBUSY", "EXDEV"]);
const MAX_ATTEMPTS = 5;

function isWinUnpackedMove(src, dest) {
  const from = String(src).replace(/\\/g, "/");
  const to = String(dest).replace(/\\/g, "/");
  return from.endsWith("/win-unpacked.tmp") && to.endsWith("/win-unpacked");
}

function installWinUnpackRenameRetry(fsPromises) {
  if (fsPromises.rename && fsPromises.rename.winUnpackRenameRetry) {
    return;
  }
  const original = fsPromises.rename.bind(fsPromises);
  async function winUnpackRename(src, dest) {
    if (!isWinUnpackedMove(src, dest)) {
      return original(src, dest);
    }
    let lastError = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
      try {
        return await original(src, dest);
      } catch (error) {
        lastError = error;
        if (!RETRY_CODES.has(error && error.code)) {
          throw error;
        }
      }
    }
    await fsPromises.cp(src, dest, { recursive: true, force: true });
    await fsPromises.rm(src, { recursive: true, force: true });
    return undefined;
  }
  winUnpackRename.winUnpackRenameRetry = true;
  fsPromises.rename = winUnpackRename;
}

installWinUnpackRenameRetry(fs);

module.exports = { installWinUnpackRenameRetry, isWinUnpackedMove };

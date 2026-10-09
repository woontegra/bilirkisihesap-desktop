import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Folder, FolderPlus, Inbox } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/context/ToastContext";
import { listSavedCaseFolders, type SavedCaseFolder } from "@/api/savedCases";
import {
  folderNameKey,
  registerSaveFolderPrompter,
  type SaveFolderChoice,
  type SaveFolderRequest,
} from "@/api/saveFolderPrompt";
import styles from "./SaveFolderPromptHost.module.css";

const UNFILED = "__unfiled__";
const NEW_FOLDER = "__new__";
const NAME_MAX = 80;

type Pending = {
  request: SaveFolderRequest;
  resolve: (choice: SaveFolderChoice | null) => void;
};

/** defaultName: sayfa ad önermezse kullanılacak ad (ör. üst çubuktaki sayfa başlığı). */
export function SaveFolderPromptHost({ defaultName = "" }: { defaultName?: string }) {
  const toast = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const [folders, setFolders] = useState<SavedCaseFolder[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string>(UNFILED);
  const [newName, setNewName] = useState<string | null>(null);
  const [newError, setNewError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const defaultNameRef = useRef(defaultName);
  defaultNameRef.current = defaultName;

  const finish = useCallback((choice: SaveFolderChoice | null) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(choice);
  }, []);

  useEffect(() => {
    return registerSaveFolderPrompter(
      (request) =>
        new Promise<SaveFolderChoice | null>((resolve) => {
          pendingRef.current?.resolve(null);
          const next = { request, resolve };
          pendingRef.current = next;
          setPending(next);
        }),
      (message) => toast.error(message),
    );
  }, [toast]);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setNewName(null);
    setNewError(null);
    setName(pending.request.suggestedName.trim() || defaultNameRef.current);
    setNameError(null);
    setSelected(pending.request.currentFolderId ?? UNFILED);
    listSavedCaseFolders()
      .then((rows) => {
        if (cancelled) return;
        setFolders(rows);
        const current = pending.request.currentFolderId;
        if (current && !rows.some((f) => f.id === current)) setSelected(UNFILED);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFolders([]);
        setSelected(UNFILED);
        setLoadError(error instanceof Error ? error.message : "Klasörler yüklenemedi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    const input = nameRef.current;
    if (input) {
      input.focus();
      input.select();
    } else {
      dialogRef.current?.focus();
    }
  }, [pending]);

  useEffect(() => {
    if (!pending || loading) return;
    dialogRef.current?.querySelector("[aria-selected='true']")?.scrollIntoView({ block: "nearest" });
  }, [pending, loading]);

  const cleanNewName = (newName ?? "").replace(/\s+/g, " ").trim();

  const validateNewName = (): string | null => {
    if (!cleanNewName) return "Klasör adı boş olamaz.";
    if (cleanNewName.length > NAME_MAX) return "Klasör adı en fazla 80 karakter olabilir.";
    return null;
  };

  const handleConfirm = () => {
    const cleanName = name.trim();
    if (!cleanName) {
      setNameError("Kayıt adı gerekli.");
      nameRef.current?.focus();
      return;
    }
    if (selected === NEW_FOLDER) {
      const problem = validateNewName();
      if (problem) {
        setNewError(problem);
        return;
      }
      const existing = folders.find((f) => folderNameKey(f.name) === folderNameKey(cleanNewName));
      finish(existing ? { name: cleanName, folderId: existing.id } : { name: cleanName, newFolderName: cleanNewName });
      return;
    }
    finish({ name: cleanName, folderId: selected === UNFILED ? null : selected });
  };

  if (!pending) return null;

  const { request } = pending;
  const isUpdate = request.mode === "update";

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={() => finish(null)}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-folder-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            finish(null);
          } else if (e.key === "Enter" && e.target === e.currentTarget && !loading) {
            e.preventDefault();
            handleConfirm();
          }
        }}
      >
        <h2 id="save-folder-title" className={styles.title}>
          {isUpdate ? "Kaydı güncelle" : "Hesaplamayı kaydet"}
        </h2>
        <label className={styles.fieldLabel} htmlFor="save-folder-name">
          Kayıt adı
        </label>
        <input
          id="save-folder-name"
          ref={nameRef}
          className={styles.nameInput}
          value={name}
          placeholder="Örn: Dosya 2025/123"
          aria-invalid={nameError ? true : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) {
              e.preventDefault();
              handleConfirm();
            }
          }}
        />
        {nameError ? <p className={styles.error}>{nameError}</p> : null}

        <div className={styles.sectionHead}>
          <span id="save-folder-label">Klasör</span>
          {newName == null ? (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                setNewName("");
                setNewError(null);
                setSelected(NEW_FOLDER);
              }}
            >
              <FolderPlus size={14} aria-hidden /> Yeni klasör
            </button>
          ) : null}
        </div>

        <ul className={styles.list} role="listbox" aria-labelledby="save-folder-label">
          <li>
            <button
              type="button"
              role="option"
              aria-selected={selected === UNFILED}
              className={`${styles.option} ${selected === UNFILED ? styles.optionActive : ""}`}
              onClick={() => setSelected(UNFILED)}
              onDoubleClick={handleConfirm}
            >
              <Inbox size={14} aria-hidden />
              <span className={styles.optionName}>Klasörsüz</span>
              {selected === UNFILED ? <Check size={14} aria-hidden className={styles.check} /> : null}
            </button>
          </li>
          {folders.map((folder) => {
            const active = selected === folder.id;
            return (
              <li key={folder.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`${styles.option} ${active ? styles.optionActive : ""}`}
                  title={folder.name}
                  onClick={() => setSelected(folder.id)}
                  onDoubleClick={handleConfirm}
                >
                  <Folder size={14} aria-hidden />
                  <span className={styles.optionName}>{folder.name}</span>
                  {folder.id === request.currentFolderId ? <span className={styles.badge}>mevcut</span> : null}
                  {active ? <Check size={14} aria-hidden className={styles.check} /> : null}
                </button>
              </li>
            );
          })}
          {newName != null ? (
            <li>
              <div className={`${styles.option} ${selected === NEW_FOLDER ? styles.optionActive : ""}`}>
                <FolderPlus size={14} aria-hidden />
                <input
                  className={styles.newInput}
                  value={newName}
                  maxLength={NAME_MAX}
                  placeholder="Yeni klasör adı"
                  aria-label="Yeni klasör adı"
                  autoFocus
                  onFocus={() => setSelected(NEW_FOLDER)}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setNewError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleConfirm();
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.inlineCancel}
                  onClick={() => {
                    setNewName(null);
                    setNewError(null);
                    setSelected(request.currentFolderId ?? UNFILED);
                  }}
                >
                  Vazgeç
                </button>
              </div>
            </li>
          ) : null}
        </ul>
        {loading ? <p className={styles.hint}>Klasörler yükleniyor…</p> : null}
        {loadError ? <p className={styles.error}>{loadError}</p> : null}
        {newError ? <p className={styles.error}>{newError}</p> : null}
        {newName != null && !newError ? (
          <p className={styles.hint}>Klasör, kayıt onaylandığında oluşturulur.</p>
        ) : null}

        <div className={styles.actions}>
          <Button type="button" variant="soft" size="sm" onClick={() => finish(null)}>
            Vazgeç
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={loading || !name.trim()} onClick={handleConfirm}>
            {isUpdate ? "Güncelle" : "Kaydet"}
          </Button>
        </div>
      </div>
    </div>
  );
}

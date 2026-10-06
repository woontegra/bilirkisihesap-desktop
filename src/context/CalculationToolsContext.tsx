import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { AddTagModal } from "@/components/calculation-tools/AddTagModal";
import { DraggableNote } from "@/components/calculation-tools/DraggableNote";
import { PressDailyInterestModal } from "@/components/calculation-tools/PressDailyInterestModal";
import toolStyles from "@/components/calculation-tools/calculationTools.module.css";
import type { CalculationToolsContextValue, Note, Tag } from "@/context/calculationToolsTypes";
import { createDraftNote, readCaseNotes, writeCaseNotes } from "@/utils/caseNotesStore";
import { createDraftTag, readCaseTags, writeCaseTags } from "@/utils/caseTagsStore";
import {
  clearCalculationBinding,
  draftIdFromPath,
  isPersistedCaseId,
  readDraftNotes,
  readDraftTags,
  resolveCalculationId,
  writeBoundCaseId,
  writeDraftNotes,
  writeDraftTags,
} from "@/utils/calculationCaseBinding";

const CalculationToolsContext = createContext<CalculationToolsContextValue | null>(null);

export function CalculationToolsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [registeredCaseId, setRegisteredCaseId] = useState<string | null>(null);
  const draftId = useMemo(() => draftIdFromPath(location.pathname), [location.pathname]);
  const calculationId = useMemo(() => {
    if (registeredCaseId && /^\d+$/.test(registeredCaseId)) return registeredCaseId;
    return resolveCalculationId(location.pathname, location.search);
  }, [location.pathname, location.search, registeredCaseId]);
  const persisted = isPersistedCaseId(calculationId);

  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showInterestModal, setShowInterestModal] = useState(false);
  const prevCalculationIdRef = useRef(calculationId);
  const skipWriteRef = useRef(true);
  const skipTagWriteRef = useRef(true);

  useEffect(() => {
    setRegisteredCaseId(null);
  }, [location.pathname]);

  useEffect(() => {
    const prev = prevCalculationIdRef.current;
    prevCalculationIdRef.current = calculationId;
    skipWriteRef.current = true;
    skipTagWriteRef.current = true;

    if (!isPersistedCaseId(prev) && isPersistedCaseId(calculationId) && prev !== calculationId) {
      const draftNotes = readDraftNotes(prev).map((note) => ({ ...note, calculationId }));
      const draftTags = readDraftTags(prev).map((tag) => ({ ...tag, calculationId }));
      const mergedNotes =
        draftNotes.length > 0 ? [...readCaseNotes(calculationId), ...draftNotes] : readCaseNotes(calculationId);
      const mergedTags = draftTags.length > 0 ? [...readCaseTags(calculationId), ...draftTags] : readCaseTags(calculationId);
      if (draftNotes.length > 0) writeCaseNotes(calculationId, mergedNotes);
      if (draftTags.length > 0) writeCaseTags(calculationId, mergedTags);
      if (draftNotes.length > 0 || draftTags.length > 0) {
        clearCalculationBinding(location.pathname, prev);
      }
      setNotes(mergedNotes);
      setTags(mergedTags);
      return;
    }

    if (persisted) {
      setNotes(readCaseNotes(calculationId));
      setTags(readCaseTags(calculationId));
      return;
    }

    setNotes(readDraftNotes(calculationId));
    setTags(readDraftTags(calculationId));
  }, [calculationId, location.pathname, persisted]);

  useEffect(() => {
    if (skipWriteRef.current) {
      skipWriteRef.current = false;
      return;
    }
    if (persisted) {
      writeCaseNotes(calculationId, notes);
      return;
    }
    writeDraftNotes(calculationId, notes);
  }, [calculationId, notes, persisted]);

  useEffect(() => {
    if (skipTagWriteRef.current) {
      skipTagWriteRef.current = false;
      return;
    }
    if (persisted) {
      writeCaseTags(calculationId, tags);
      return;
    }
    writeDraftTags(calculationId, tags);
  }, [calculationId, tags, persisted]);

  const registerCaseId = useCallback(
    (id: string | null | undefined) => {
      if (id && /^\d+$/.test(id)) {
        writeBoundCaseId(location.pathname, id);
        setRegisteredCaseId(id);
        return;
      }
      setRegisteredCaseId(null);
    },
    [location.pathname],
  );

  const beginNewCalculation = useCallback(() => {
    clearCalculationBinding(location.pathname, draftId);
    setRegisteredCaseId(null);
    setNotes([]);
    setTags([]);
  }, [draftId, location.pathname]);

  const addNote = useCallback(() => {
    setNotes((prev) => [...prev, createDraftNote(calculationId)]);
  }, [calculationId]);

  const handleNoteTextChange = useCallback((noteId: string, text: string) => {
    setNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, text } : note)));
  }, []);

  const handleNoteDragEnd = useCallback((noteId: string, x: number, y: number) => {
    setNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, x, y } : note)));
  }, []);

  const handleDeleteNote = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== noteId));
  }, []);

  const handleAddTag = useCallback(
    (color: string, label: string) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      setTags((prev) => [...prev, createDraftTag(calculationId, color, trimmed)]);
    },
    [calculationId],
  );

  const handleDeleteTag = useCallback((tagId: string) => {
    setTags((prev) => prev.filter((tag) => tag.id !== tagId));
  }, []);

  const value = useMemo(
    (): CalculationToolsContextValue => ({
      addNote,
      openTagModal: () => setShowTagModal(true),
      openInterestCalculator: () => setShowInterestModal(true),
      beginNewCalculation,
      registerCaseId,
    }),
    [addNote, beginNewCalculation, registerCaseId],
  );

  return (
    <CalculationToolsContext.Provider value={value}>
      {children}
      {tags.length > 0 ? (
        <div className={toolStyles.tagBar}>
          {tags.map((tag) => (
            <span key={tag.id} className={toolStyles.tagChip} style={{ backgroundColor: tag.color }}>
              {tag.label}
              <button
                type="button"
                className={toolStyles.tagDelete}
                onClick={() => handleDeleteTag(tag.id)}
                aria-label="Etiketi sil"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {notes.map((note) => (
        <DraggableNote
          key={note.id}
          id={note.id}
          x={note.x}
          y={note.y}
          text={note.text}
          onChange={handleNoteTextChange}
          onDragEnd={handleNoteDragEnd}
          onDelete={handleDeleteNote}
        />
      ))}
      <AddTagModal open={showTagModal} onClose={() => setShowTagModal(false)} onAdd={handleAddTag} />
      <PressDailyInterestModal open={showInterestModal} onClose={() => setShowInterestModal(false)} />
    </CalculationToolsContext.Provider>
  );
}

export function useCalculationTools(): CalculationToolsContextValue {
  const ctx = useContext(CalculationToolsContext);
  if (!ctx) {
    throw new Error("useCalculationTools CalculationToolsProvider içinde kullanılmalıdır.");
  }
  return ctx;
}

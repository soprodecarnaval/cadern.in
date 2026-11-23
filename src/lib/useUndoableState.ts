import { useCallback, useState } from "react";

/** How many past states undo can go back through. */
const LIMIT = 100;

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

/** useState with undo and redo. `set` records a step; `reset` replaces the
 *  value and forgets the history (e.g. when restoring a saved list). */
export function useUndoableState<T>(initial: T) {
  const [history, setHistory] = useState<History<T>>({ past: [], present: initial, future: [] });

  const set = useCallback((next: T | ((previous: T) => T)) => {
    setHistory((history) => {
      const { past, present } = history;
      const value = typeof next === "function" ? (next as (previous: T) => T)(present) : next;
      if (Object.is(value, present)) { return history; }
      return { past: [...past, present].slice(-LIMIT), present: value, future: [] };
    });
  }, []);

  const reset = useCallback((value: T) => {
    setHistory({ past: [], present: value, future: [] });
  }, []);

  const undo = useCallback(() => {
    setHistory((history) => {
      if (history.past.length === 0) { return history; }
      return {
        past: history.past.slice(0, -1),
        present: history.past[history.past.length - 1],
        future: [history.present, ...history.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((history) => {
      if (history.future.length === 0) { return history; }
      return {
        past: [...history.past, history.present],
        present: history.future[0],
        future: history.future.slice(1),
      };
    });
  }, []);

  return {
    value: history.present,
    set,
    reset,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

export function commitHistory<T>(history: T[], future: T[], current: T, next: T) {
  return {
    history: [...history, current].slice(-30),
    future: [] as T[],
    current: next,
  };
}

export function undoHistory<T>(history: T[], future: T[], current: T) {
  if (history.length === 0) return { history, future, current };
  const previous = history[history.length - 1];
  return {
    history: history.slice(0, -1),
    future: [...future, current],
    current: previous,
  };
}

export function redoHistory<T>(history: T[], future: T[], current: T) {
  if (future.length === 0) return { history, future, current };
  const next = future[future.length - 1];
  return {
    history: [...history, current].slice(-30),
    future: future.slice(0, -1),
    current: next,
  };
}

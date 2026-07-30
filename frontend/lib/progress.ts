// Learning progress (which functions the user has marked "understood") and the
// Learning/Expert mode preference. No backend/auth for this yet, so localStorage
// is the simplest thing that actually persists across the Workspace and Overview pages.

const DONE_KEY = (projectId: string) => `code-teacher:done:${projectId}`;
const MODE_KEY = "code-teacher:mode";
const READ_LINE_KEY = (fnId: string) => `code-teacher:read-line:${fnId}`;

export type TeacherMode = "learning" | "expert";

export function getDone(projectId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY(projectId)) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function markDone(projectId: string, fnId: string): Set<string> {
  const done = getDone(projectId);
  done.add(fnId);
  localStorage.setItem(DONE_KEY(projectId), JSON.stringify([...done]));
  return done;
}

export function getMode(): TeacherMode {
  if (typeof window === "undefined") return "learning";
  return (localStorage.getItem(MODE_KEY) as TeacherMode) ?? "learning";
}

export function setMode(mode: TeacherMode) {
  localStorage.setItem(MODE_KEY, mode);
}

// Furthest line the user has scrolled to within a function -- a rough "read up to
// here" marker so re-opening a long function shows where they left off, instead of
// them having to scroll and guess. Per-function, per-browser; never overwrites a
// deeper mark with a shallower one (scrolling back up shouldn't erase progress).
export function getReadLine(fnId: string): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(READ_LINE_KEY(fnId)) ?? 0);
}

export function markReadLine(fnId: string, line: number): number {
  const furthest = Math.max(getReadLine(fnId), line);
  localStorage.setItem(READ_LINE_KEY(fnId), String(furthest));
  return furthest;
}

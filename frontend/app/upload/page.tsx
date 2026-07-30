"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { track } from "@/lib/analytics";

type Rejected = { name: string; reason: string };

function pathOf(f: File): string {
  return (f as any).webkitRelativePath || f.name;
}

// Kept in sync with the backend's _safe_dest() allowlist (app/routers/projects.py):
// only .py reaches disk, so only .py is worth showing as "accepted" here.
function classify(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) return null; // handled separately, always accepted
  if (lower.endsWith(".py")) return null;
  return "지원하지 않는 형식 (.py만 허용)";
}

// Dropped folders arrive as FileSystemEntry trees, not a flat FileList like
// <input webkitdirectory> gives us -- walk them by hand to collect files.
async function readEntry(
  entry: FileSystemEntry,
  path: string,
  accepted: File[],
  rejected: Rejected[]
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve) => (entry as FileSystemFileEntry).file(resolve));
    const rel = path + file.name;
    const reason = classify(file.name);
    if (reason) {
      rejected.push({ name: rel, reason });
    } else {
      Object.defineProperty(file, "webkitRelativePath", { value: rel });
      accepted.push(file);
    }
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children: FileSystemEntry[] = [];
    let batch = await new Promise<FileSystemEntry[]>((resolve) => reader.readEntries(resolve));
    while (batch.length > 0) {
      children.push(...batch);
      batch = await new Promise<FileSystemEntry[]>((resolve) => reader.readEntries(resolve));
    }
    for (const child of children) {
      await readEntry(child, `${path}${entry.name}/`, accepted, rejected);
    }
  }
}

export default function UploadPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"upload" | "github">("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [entryPaths, setEntryPaths] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string> | null>(null); // null = everything included (no auto-select run yet)
  const [tracing, setTracing] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const folderInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function resetSelection(accepted: File[], rej: Rejected[]) {
    setFiles(accepted);
    setRejected(rej);
    setEntryPaths(new Set());
    setSelected(null);
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const accepted: File[] = [];
    const rej: Rejected[] = [];
    for (const f of Array.from(list)) {
      const rel = (f as any).webkitRelativePath || f.name;
      const reason = classify(f.name);
      if (reason) rej.push({ name: rel, reason });
      else accepted.push(f);
    }
    resetSelection(accepted, rej);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const items = e.dataTransfer.items;
    const entries = items && [...items].map((it) => it.webkitGetAsEntry?.()).filter((x): x is FileSystemEntry => !!x);
    if (entries && entries.length > 0) {
      const accepted: File[] = [];
      const rej: Rejected[] = [];
      for (const entry of entries) await readEntry(entry, "", accepted, rej);
      resetSelection(accepted, rej);
    } else {
      addFiles(e.dataTransfer.files);
    }
  }

  function toggleEntry(path: string) {
    setEntryPaths((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }

  function toggleSelected(path: string) {
    setSelected((prev) => {
      const base = prev ?? new Set(files.map(pathOf));
      const next = new Set(base);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }

  async function autoSelectRelated() {
    if (entryPaths.size === 0) return;
    setTracing(true);
    setError(null);
    try {
      const pyFiles = files.filter((f) => pathOf(f).toLowerCase().endsWith(".py"));
      const { files: traced } = await api.traceImports(pyFiles, Array.from(entryPaths));
      const nonPy = files.filter((f) => !pathOf(f).toLowerCase().endsWith(".py")).map(pathOf);
      setSelected(new Set([...traced, ...nonPy]));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "관련 파일을 찾지 못했습니다.");
    } finally {
      setTracing(false);
    }
  }

  const includedFiles = selected === null ? files : files.filter((f) => selected.has(pathOf(f)));

  async function submit() {
    if (includedFiles.length === 0) return;
    setBusy(true);
    setError(null);
    track("project_analysis_started", { props: { source: "upload" } });
    try {
      const { project_id } = await api.createProject(includedFiles);
      track("project_created", { projectId: project_id, props: { source: "upload", file_count: includedFiles.length } });
      track("project_analysis_completed", { projectId: project_id });
      router.push(`/projects/${project_id}/progress`);
    } catch (e) {
      track("project_analysis_failed", { props: { source: "upload" } });
      setError(e instanceof ApiError ? e.message : "업로드에 실패했습니다.");
      setBusy(false);
    }
  }

  async function submitGithub() {
    if (!githubUrl.trim()) return;
    setBusy(true);
    setError(null);
    track("project_analysis_started", { props: { source: "github" } });
    try {
      const { project_id } = await api.createProjectFromGithub(githubUrl.trim());
      track("project_created", { projectId: project_id, props: { source: "github" } });
      track("project_analysis_completed", { projectId: project_id });
      router.push(`/projects/${project_id}/progress`);
    } catch (e) {
      track("project_analysis_failed", { props: { source: "github" } });
      setError(e instanceof ApiError ? e.message : "저장소를 가져오지 못했습니다.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F2F2F7] px-6">
      <div className="w-[720px] rounded-[20px] bg-white p-8" style={{ boxShadow: "0 12px 48px rgba(0,0,0,.10)" }}>
        <h1 className="text-[22px] font-bold">새 프로젝트</h1>

        <div className="mt-4 flex h-8 w-fit rounded-[9px] p-0.5 text-[12.5px] font-semibold" style={{ background: "rgba(120,120,128,.12)" }}>
          {([
            ["upload", "파일 업로드 / ZIP"],
            ["github", "GitHub URL"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setTab(id); setError(null); }}
              className="rounded-[7px] px-4"
              style={tab === id ? { background: "white", boxShadow: "0 3px 8px rgba(0,0,0,.10)" } : { color: "rgba(60,60,67,.6)" }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "upload" ? (
        <>
        <p className="mt-4 text-[13px] text-[rgba(60,60,67,.6)]">
          .py 파일, 폴더, 또는 ZIP을 선택하세요. 최대 200개 파일 · 50MB · 암호화된 ZIP은 지원하지 않습니다.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-12"
          style={{
            border: "1.5px dashed rgba(0,122,255,.4)",
            background: dragOver ? "rgba(0,122,255,.08)" : "rgba(0,122,255,.04)",
          }}
        >
          <p className="text-[14px] text-[rgba(60,60,67,.6)]">
            폴더, .py 파일, 또는 ZIP을 이 영역에 끌어다 놓으세요. 업로드한 코드는 실행되지 않습니다.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => folderInput.current?.click()}
              className="h-9 rounded-full px-4 text-[13px] font-semibold text-white bg-[#007AFF]"
            >
              폴더 선택
            </button>
            <button
              onClick={() => fileInput.current?.click()}
              className="h-9 rounded-full px-4 text-[13px] font-semibold"
              style={{ background: "rgba(120,120,128,.12)" }}
            >
              파일 / ZIP 선택
            </button>
          </div>
          <input
            ref={folderInput}
            type="file"
            multiple
            // @ts-expect-error non-standard attribute for directory picking
            webkitdirectory=""
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".py,.zip"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {files.some((f) => pathOf(f).toLowerCase().endsWith(".py")) && (
          <div className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5" style={{ border: "0.5px solid rgba(84,84,86,.18)", background: "rgba(0,122,255,.04)" }}>
            <p className="flex-1 text-[12.5px] text-[rgba(60,60,67,.65)]">
              {entryPaths.size === 0
                ? "진입 파일(예: main.py) 옆의 ★을 눌러 표시하세요."
                : `진입 파일 ${entryPaths.size}개 선택됨 — 실제로 사용하는 파일만 자동으로 골라줍니다.`}
            </p>
            <button
              onClick={autoSelectRelated}
              disabled={entryPaths.size === 0 || tracing}
              className="h-8 shrink-0 rounded-full px-4 text-[12.5px] font-semibold text-white disabled:opacity-40"
              style={{ background: "#007AFF" }}
            >
              {tracing ? "분석 중…" : "관련 Python 파일 자동 선택"}
            </button>
          </div>
        )}

        {(files.length > 0 || rejected.length > 0) && (
          <div className="mt-4 rounded-xl" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
            <div className="px-4 py-2 text-[12.5px] font-semibold text-[rgba(60,60,67,.6)]">
              선택된 파일 {includedFiles.length}개 / {files.length}개
              {rejected.length > 0 && <span className="text-[#C93400]"> · {rejected.length}개 제외됨</span>}
            </div>
            <div className="max-h-40 overflow-y-auto">
              {files.map((f) => {
                const path = pathOf(f);
                const isPy = path.toLowerCase().endsWith(".py");
                const isIncluded = selected === null || selected.has(path);
                const isEntry = entryPaths.has(path);
                return (
                  <div
                    key={path}
                    className="flex items-center gap-2 px-4 py-1.5 font-mono text-[12.5px]"
                    style={{ borderTop: "0.5px solid rgba(84,84,86,.12)", opacity: isIncluded ? 1 : 0.4 }}
                  >
                    <input
                      type="checkbox"
                      checked={isIncluded}
                      onChange={() => toggleSelected(path)}
                      className="shrink-0"
                    />
                    {isPy && (
                      <button
                        onClick={() => toggleEntry(path)}
                        title="진입 파일로 표시"
                        className="shrink-0 text-[13px]"
                        style={{ color: isEntry ? "#FF9500" : "rgba(60,60,67,.25)" }}
                      >
                        ★
                      </button>
                    )}
                    <span className="truncate">{path}</span>
                  </div>
                );
              })}
              {rejected.map((r) => (
                <div
                  key={r.name}
                  className="flex items-center gap-2 px-4 py-1.5 font-mono text-[12.5px] text-[#C93400]"
                  style={{ borderTop: "0.5px solid rgba(84,84,86,.12)" }}
                >
                  <span>✕</span>
                  {r.name}
                  <span className="ml-auto rounded bg-[rgba(255,59,48,.1)] px-1.5 py-0.5 text-[10px]">
                    {r.reason}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-[13px] text-[#D70015]">{error}</p>}

        <button
          onClick={submit}
          disabled={includedFiles.length === 0 || busy}
          className="mt-6 h-11 w-full rounded-xl text-[15px] font-semibold text-white"
          style={{ background: includedFiles.length === 0 || busy ? "rgba(0,122,255,.4)" : "#007AFF" }}
        >
          {busy ? "분석 중…" : "분석 시작"}
        </button>
        </>
        ) : (
        <>
        <p className="mt-4 text-[13px] text-[rgba(60,60,67,.6)]">
          공개(public) GitHub 저장소 URL을 입력하세요. private 저장소는 지원하지 않습니다.
        </p>
        <input
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitGithub()}
          placeholder="https://github.com/owner/repo"
          className="mt-4 h-11 w-full rounded-xl px-4 font-mono text-[14px] outline-none focus:ring-2 focus:ring-[#007AFF]"
          style={{ border: "0.5px solid rgba(84,84,86,.24)" }}
        />
        {error && <p className="mt-3 text-[13px] text-[#D70015]">{error}</p>}
        <button
          onClick={submitGithub}
          disabled={!githubUrl.trim() || busy}
          className="mt-6 h-11 w-full rounded-xl text-[15px] font-semibold text-white"
          style={{ background: !githubUrl.trim() || busy ? "rgba(0,122,255,.4)" : "#007AFF" }}
        >
          {busy ? "가져오는 중…" : "가져오기"}
        </button>
        </>
        )}
      </div>
    </div>
  );
}

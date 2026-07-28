"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { track } from "@/lib/analytics";

// Kept in sync with the backend's classify_files() allowlist (app/analysis/ast_parser.py):
// .py is analyzed as source, the rest ride along unanalyzed for config/context (magic numbers etc).
const SOURCE_EXTS = [".py", ".yaml", ".yml", ".json", ".md", ".txt"];

type Rejected = { name: string; reason: string };

function classify(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) return null; // handled separately, always accepted
  if (SOURCE_EXTS.some((ext) => lower.endsWith(ext))) return null;
  return "지원하지 않는 형식";
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
  const [githubUrl, setGithubUrl] = useState("");
  const folderInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

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
    setFiles(accepted);
    setRejected(rej);
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
      setFiles(accepted);
      setRejected(rej);
    } else {
      addFiles(e.dataTransfer.files);
    }
  }

  async function submit() {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    track("project_analysis_started", { props: { source: "upload" } });
    try {
      const { project_id } = await api.createProject(files);
      track("project_created", { projectId: project_id, props: { source: "upload", file_count: files.length } });
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
            accept=".py,.yaml,.yml,.json,.md,.txt,.zip"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {(files.length > 0 || rejected.length > 0) && (
          <div className="mt-4 rounded-xl" style={{ border: "0.5px solid rgba(84,84,86,.18)" }}>
            <div className="px-4 py-2 text-[12.5px] font-semibold text-[rgba(60,60,67,.6)]">
              선택된 파일 {files.length}개
              {rejected.length > 0 && <span className="text-[#C93400]"> · {rejected.length}개 제외됨</span>}
            </div>
            <div className="max-h-40 overflow-y-auto">
              {files.map((f) => (
                <div
                  key={(f as any).webkitRelativePath || f.name}
                  className="flex items-center gap-2 px-4 py-1.5 font-mono text-[12.5px]"
                  style={{ borderTop: "0.5px solid rgba(84,84,86,.12)" }}
                >
                  <span className="text-[#34C759]">✓</span>
                  {(f as any).webkitRelativePath || f.name}
                </div>
              ))}
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
          disabled={files.length === 0 || busy}
          className="mt-6 h-11 w-full rounded-xl text-[15px] font-semibold text-white"
          style={{ background: files.length === 0 || busy ? "rgba(0,122,255,.4)" : "#007AFF" }}
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

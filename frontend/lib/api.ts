import type {
  ProjectSummary,
  ProjectTree,
  FunctionSource,
  FunctionAnalysis,
  ChatMessage,
  AskResponse,
  ProjectGraph,
  Issue,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json();
}

export const api = {
  listProjects: () => req<ProjectSummary[]>("/projects"),

  createDemoProject: () =>
    req<{ project_id: string }>("/projects/demo", { method: "POST" }),

  createProject: (files: File[]) => {
    const form = new FormData();
    for (const f of files) {
      form.append("files", f, (f as any).webkitRelativePath || f.name);
    }
    return req<{ project_id: string }>("/projects", { method: "POST", body: form });
  },

  createProjectFromGithub: (githubUrl: string) =>
    req<{ project_id: string }>("/projects/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ github_url: githubUrl }),
    }),

  getProject: (id: string) => req<ProjectSummary>(`/projects/${id}`),

  getTree: (id: string) => req<ProjectTree>(`/projects/${id}/tree`),

  getGraph: (id: string, filter: string) =>
    req<ProjectGraph>(`/projects/${id}/graph?filter=${encodeURIComponent(filter)}`),

  getIssues: (id: string, kind: string) =>
    req<Issue[]>(`/projects/${id}/issues?kind=${encodeURIComponent(kind)}`),

  getStatus: (id: string) =>
    req<{ status: string; file_count: number; analyzed_file_count: number; class_count: number; function_count: number }>(
      `/projects/${id}/status`
    ),

  getFunctionSource: (fnId: string) => req<FunctionSource>(`/functions/${fnId}`),

  getFunctionAnalysis: (fnId: string) =>
    req<FunctionAnalysis>(`/functions/${fnId}/analysis`),

  retryAnalysis: (fnId: string) =>
    req<FunctionAnalysis>(`/functions/${fnId}/retry`, { method: "POST" }),

  askFunction: (fnId: string, question: string, history: ChatMessage[]) =>
    req<AskResponse>(`/functions/${fnId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history }),
    }),

  deleteProject: (id: string) => req<{ ok: boolean }>(`/projects/${id}`, { method: "DELETE" }),
};

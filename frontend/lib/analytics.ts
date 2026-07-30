// Fire-and-forget product analytics (README.md section 26). Never pass source code
// or docstrings in `props` -- only ids, names, and counts.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type EventName =
  | "project_created"
  | "project_analysis_started"
  | "project_analysis_completed"
  | "project_analysis_failed"
  | "learning_path_started"
  | "learning_step_completed"
  | "function_selected"
  | "equation_viewed"
  | "shape_viewed"
  | "data_flow_viewed"
  | "review_opened"
  | "review_issue_opened"
  | "question_submitted"
  | "suggested_question_clicked"
  | "code_selection_asked"
  | "explanation_feedback_submitted"
  | "project_deleted";

export function track(
  event: EventName,
  opts: { projectId?: string; functionId?: string; props?: Record<string, string | number | boolean | null> } = {}
) {
  fetch(`${BASE}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      project_id: opts.projectId ?? null,
      function_id: opts.functionId ?? null,
      props: opts.props ?? {},
    }),
    keepalive: true,
  }).catch(() => {});
}

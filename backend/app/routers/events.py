"""Product analytics events (README.md section 26). Append-only JSONL -- there's no
warehouse to ship these to yet, but the event names and shapes are locked in so
wiring one up later is a sink swap, not a redesign.

Never accepts free-form code/source text: props values are restricted to short
primitives, and the raw uploaded code is never part of any event payload.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, field_validator

router = APIRouter(tags=["events"])
EVENTS_LOG = Path(__file__).resolve().parent.parent.parent / "events.log"

EventName = Literal[
    "project_created", "project_analysis_started", "project_analysis_completed",
    "project_analysis_failed", "learning_path_started", "learning_step_completed",
    "function_selected", "equation_viewed", "shape_viewed", "data_flow_viewed",
    "review_opened", "review_issue_opened", "question_submitted",
    "suggested_question_clicked", "code_selection_asked",
    "explanation_feedback_submitted", "project_deleted",
]

PropValue = str | int | float | bool | None


class EventRequest(BaseModel):
    event: EventName
    project_id: str | None = None
    function_id: str | None = None
    props: dict[str, PropValue] = {}

    @field_validator("props")
    @classmethod
    def _cap_string_length(cls, props: dict[str, PropValue]) -> dict[str, PropValue]:
        return {k: (v[:200] if isinstance(v, str) else v) for k, v in props.items()}


@router.post("/events")
def log_event(body: EventRequest):
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": body.event,
        "project_id": body.project_id,
        "function_id": body.function_id,
        "props": body.props,
    }
    with EVENTS_LOG.open("a") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return {"ok": True}

"""Best-effort secret detection so an upload never silently ships a leaked credential
into an LLM prompt. Flags, never blocks -- false positives are cheap, false negatives aren't.
"""
import re
from pathlib import Path

_PATTERNS = [
    ("AWS Access Key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("Private Key", re.compile(r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("OpenAI/Anthropic-style API Key", re.compile(r"\b(sk|sk-ant)-[A-Za-z0-9_-]{20,}")),
    ("Generic secret assignment", re.compile(
        r"(?i)\b(api[_-]?key|secret|token|password)\b\s*=\s*[\"'][A-Za-z0-9_\-/+=]{12,}[\"']")),
]


def scan_secrets(root: Path, files: list[str]) -> list[str]:
    warnings = []
    for rel in files:
        try:
            text = (root / rel).read_text(errors="ignore")
        except OSError:
            continue
        for line_no, line in enumerate(text.splitlines(), start=1):
            for label, pattern in _PATTERNS:
                if pattern.search(line):
                    warnings.append(f"{rel}:{line_no} — {label}로 보이는 문자열이 발견되었습니다.")
                    break
    return warnings

# Handoff: Code to Math AI Teacher

## Overview

**Code to Math AI Teacher** is a desktop web app that helps a user *understand* Python research code
(PyTorch / RL / MPC / robot control) rather than review or fix it. It converts a function into:
role → inputs/outputs → tensor shapes → math → data flow → problems, in that order.

Slogan: **"Don't read the code. Learn the code." / "코드를 읽지 말고, 코드를 배우세요."**

Product principles the UI must preserve:

1. **Learning first, review second.** The review step is the last of six; it is never the entry point.
2. **Progressive disclosure.** Learning Mode shows one card at a time; Expert Mode shows all six.
3. **Code → Math → Intuition.** Every formula ships with symbol↔variable mapping, an intuition
   paragraph, and an optional numeric example.
4. **Whole before parts.** Project Overview (with global data flow) precedes the workspace.
5. **Interactive learning.** Question chips keep the current function as context.
6. **Evidence-based AI.** Every claim carries a certainty level and evidence code location.

## About the Design Files

`Code to Math AI Teacher.dc.html` in this bundle is a **design reference created in HTML** — a
prototype showing intended look and behavior. It is **not production code to copy**. The task is to
**recreate these designs in the target codebase** using its own framework and patterns. The user's
own spec proposes Next.js + TypeScript + Tailwind + shadcn/ui + Monaco Editor + React Flow + KaTeX
on the frontend and FastAPI + Pydantic + SQLAlchemy on the backend; that stack is a good fit, but
the HTML is the visual/behavioral source of truth, not the implementation.

To open the prototype: it is a self-contained HTML file; open it in a browser. Bottom-center pill
("화면 목록") switches between all nine screens.

## Fidelity

**High-fidelity.** Colors, type sizes, spacing, radii, and interaction states are final and should be
matched. Two deliberate substitutions:

- **Math rendering** is hand-built with styled spans (Georgia italic) so each symbol can carry its
  own hover target. In production use **KaTeX/MathJax with per-symbol `\htmlData{}` or wrapped
  `<span>` nodes** so symbol↔code hover linking still works. Do not lose the linking.
- **Code editor** is a static tokenized renderer. In production use **Monaco Editor** with line
  decorations for highlight/evidence bands.

## Design language

iOS 18 / Apple HIG visual language applied to a desktop developer tool: hairline separators,
translucent blurred bars, soft low shadows, system blue tint, grouped-background surfaces.
Korean UI copy with English technical terms retained (`shape`, `tensor`, `Critical`, `Correctness`).

---

## Screens / Views

Nine screens. Canvas is **1680 px wide** (`min-width: 1680px`), desktop-only.

### 1. Landing

- **Purpose:** explain the value in one screen, push to upload or demo.
- **Layout:** sticky 52px translucent nav bar → centered hero (max-width 1080, padding 96/40/40)
  → 1160px-wide browser-chrome card showing a split CODE | MATH preview → 4-up feature grid
  (max-width 1160, `repeat(4, 1fr)`, gap 14).
- **Key components:**
  - Nav: 22×22 rounded-6 blue tile with `∑`, product name 15/600, two pill buttons
    (`데모 프로젝트` gray fill `rgba(120,120,128,.12)`, `새 프로젝트` blue `#007AFF`), height 32, radius 999.
  - Eyebrow pill: 28px tall, `rgba(0,122,255,.1)` bg, `#007AFF` text, 12/600.
  - H1: 56px / line-height 1.08 / letter-spacing −1.6px / weight 700. Second line has
    `배우세요` in `#007AFF`.
  - Sub: 19px / 1.5 / `rgba(60,60,67,.6)`, max-width 620.
  - CTAs: 44px tall, radius 12 — primary blue, secondary white with `0.5px solid rgba(84,84,86,.24)`.
  - Privacy line: 12px `rgba(60,60,67,.45)` — "업로드한 코드는 실행되지 않으며 모델 학습에 사용되지 않습니다."
  - Preview card: radius 20, shadow `0 12px 48px rgba(0,0,0,.10)`, 36px title bar with three
    10px traffic lights (`#FF5F57`, `#FEBC2E`, `#28C840`). Left half = code (JetBrains Mono 12.5/2)
    with two highlighted lines (yellow `rgba(255,204,0,.22)`, blue `rgba(0,122,255,.10)`);
    right half = the matching two formulas with the same two highlight colors. This one static frame
    is the product's core promise — keep it.

### 2. Dashboard

- Sticky bar + `최근 프로젝트` title (28/700/−0.6px) + subtitle.
- Project list: single white card radius 14, rows 16/18 padding, hairline separators,
  hover `rgba(120,120,128,.06)`. Row = 36px rounded-10 initial tile (tinted per project) ·
  name 15/600 · meta 12.5 secondary · status pill · chevron.
- Status pills: 분석 완료 (green `rgba(52,199,89,.14)` / `#248A3D`), AI 분석 중 (blue),
  일부 실패 (orange `rgba(255,149,0,.16)` / `#C93400`).
- Rows navigate: 완료→Overview, 분석 중→Progress, 일부 실패→Errors.

### 3. Upload / New project

- Centered 720px card, radius 20.
- Segmented tabs `파일 업로드 | ZIP | GitHub URL` (32px, radius 9, active = `rgba(0,122,255,.12)` + 600).
- File tab: dashed dropzone `1.5px dashed rgba(0,122,255,.4)` on `rgba(0,122,255,.04)`, radius 14,
  copy "…최대 200개 파일 · 50MB · 암호화된 ZIP은 지원하지 않습니다".
- GitHub tab: read-only URL field (mono) + 확인 button + private-repo note.
- After picking: file manifest panel with per-file ✓ / ✕ rows; excluded file shown in `#C93400`
  with reason ("지원하지 않는 형식"). Header shows "선택된 파일 14개" and "1개 제외됨".
- Primary button `분석 시작` is disabled-looking (`rgba(0,122,255,.4)`) until files exist.

### 4. Analysis progress

- Centered 560px column. Six steps in one white card (radius 16):
  파일 검증 → Python 구조 분석 → 함수와 클래스 추출 → 호출 관계 생성 → 데이터 흐름 분석 → AI 설명 생성.
- Step row: 20px dot (done = green `#34C759` with ✓; current = blue, `animation: pulseDot 1s ease-in-out infinite`;
  pending = `rgba(120,120,128,.18)`), label, right-aligned mono detail ("14개 파일", "AST", "63 / 8",
  "112 edges", 진행 중, 대기).
- 4px blue progress bar below, `transition: width .5s ease`.
- Escape hatch button: `완료된 부분 먼저 보기` → Overview (partial results must be browsable).
- Prototype auto-advances every 780 ms then navigates to Overview. In production drive this from
  real job status (poll or SSE).

### 5. Project Overview

- Status line `✓ 분석 완료 · 확실성 높음` in `#248A3D`, then a **one-sentence project summary**
  as an H1 (30/700/−0.7px) — not a generic title.
- Stats strip: 5 cards `repeat(5, 1fr)` — 분석된 파일 13 · 클래스 8 · 함수 63 · 진입점 후보 main.py (blue) ·
  분석 확실성 높음 (green). Numbers in JetBrains Mono 26/700.
- Two-column body `1.35fr 1fr`:
  - **추천 학습 순서** card: six numbered rows, each = 24px circle · mono function name ·
    "왜 먼저 봐야 하나" reason · estimated time. Completed steps turn green
    (bg `rgba(52,199,89,.06)`, border `rgba(52,199,89,.3)`, filled green numeral). Click → workspace.
  - **진입점 후보** card (green row = `__main__` confirmed, gray row = CLI entry),
    **전체 데이터 흐름** card (5 dot-and-line nodes with shapes),
    **분석 주의사항** card (orange) naming the excluded file and the runtime-only `B` dimension.

### 6. Code Workspace — the core screen

Fixed `height: 100vh`, three columns, no page scroll; each column scrolls internally.

**Top bar (48px, translucent + `backdrop-filter: saturate(180%) blur(20px)`)**
`∑` tile · project name (blue, → Overview) · `/` · current file (mono) · flex spacer ·
**view tabs** `프로젝트 지도 | 코드 이해 | 수식 보기 | 데이터 흐름 | 코드 리뷰` (segmented, active = white
pill + `0 3px 8px rgba(0,0,0,.10)`) · **mode toggle** `Learning | Expert`.
Tabs 코드 이해/수식 보기/데이터 흐름 jump the right panel to step 0 / 2 / 4; 지도 and 리뷰 navigate away.

**Left panel — 264px, `#FAFAFC`**
- 30px search field (visual only in the prototype).
- Sub-tabs `파일 | 함수 | 추천 순서` (26px, radius 7).
  - 파일: folder rows + `ƒ` function rows (purple `#AF52DE` glyph), plus a disabled
    `legacy_controller.py` row with red `!` and a `Syntax` badge.
  - 함수: `CLASSES` / `FUNCTIONS` section headers, `C` blue class rows, all functions.
  - 추천 순서: numbered function rows in learning order (default tab).
- Selected row: `rgba(0,122,255,.12)` bg, `#0062CC` text, weight 700. Understood functions get a
  green ✓ badge.
- Pinned footer card: `학습 진행률` label, 5px green bar, "n / 6 함수 이해 완료".

**Center — Monaco Editor area, white**
- 36px sub-bar: qualified function name (mono 12/600), line range, and — when a cross-highlight is
  active — a blue badge naming what is highlighted (e.g. `reshape → 코드`, `observation 근거`).
- Code rows: 30px right-aligned gutter (mono 11.5, `rgba(60,60,67,.32)`), code (mono 12.5 / line-height 21,
  `white-space: pre`), and a 120px right-hand **annotation rail** (mono 10.5) that labels lines with
  their math symbol (`W₁, b₁`, `reshape`, `Δw`, `Hu = −g`).
- Highlight state: row bg `rgba(255,204,0,.20)` + 2px left bar `#FFCC00`; the annotation turns `#C93400`.
- Hovering a code row highlights it and updates the badge (code → math direction).
- Syntax colors (Xcode-light derived): keyword `#9B2393`, string `#C7361B`, number `#1C6FD9`,
  call/def name `#0B7285`, module (`torch`, `nn`, `self`, `cfg`) `#5C2699`, comment/docstring
  `#5D6C79` italic, default `#1D1D1F`.

**Right panel — 678px, `#F2F2F7`**
- Header (white): `AI TEACHER` 11/700 blue label, step counter, and a 6-segment step rail —
  each segment = 3px bar (done green / current blue / pending gray) + label
  `개요 · 입출력 · 수식 · Shape · 흐름 · 리뷰`. Segments are clickable.
- Body: **Learning Mode renders one card; Expert Mode renders all six stacked.** Cards are white,
  radius 16, `0.5px` border, `animation: fadeUp .22s ease`.
- Every card header has a kicker (`① 이 함수는 무엇을 하는가` … `⑥ 이제 문제를 본다`) and a
  **certainty pill** on the right; hovering the pill opens an inline explanation panel.
- Footer (white, pinned): question chips row, text input ("이 함수에 대해 질문하기 — 현재 문맥이 자동
  첨부됩니다") + 34px blue send button, and — in Learning Mode only — a full-width green
  `이해했어요 — 다음 단계` button (last step: `이 함수 학습 완료`, which marks the function done and
  advances to the next function).

**The six cards**

| # | Card | Contents |
|---|------|----------|
| ① | 개요 | one-line role (17/700), 시스템 안에서의 위치 box, mini chain of 4 pills with the current function tinted blue |
| ② | 입출력 | INPUT (green label) / OUTPUT (orange label) cards: name (mono 14/700), type, shape pill (blue for input, orange for output), meaning, origin/usage location (clickable, jumps highlight), certainty dot+label (hover → explanation), and a 2-column meta grid — **dtype · 단위 · 값 범위 · 기본값** (rendered only when data exists). Below: **부작용 (SIDE EFFECTS)** purple block |
| ③ | 수식 | **표현 방식** badge (LaTeX 수식 / 텐서 구성식 / Piecewise + 상태 다이어그램 / 행렬식 / 실행 순서 설명), the formula (Georgia 21, per-symbol hover → highlights code lines, active symbol bg `rgba(255,204,0,.42)`), optional **piecewise** block, optional **상태 전이** diagram, **기호 ↔ 코드 변수** 2-column mapping grid (hover both ways), blue **직관** box, and a **숫자 예시** toggle revealing a mono worked example. When a function is not math-expressible (`run()`), the whole card becomes an orange "수식으로 표현하지 않습니다" notice + a numbered 실행 순서 list |
| ④ | Shape | vertical chain: rows of `name · shape (mono 14/700) · certainty chip`, separated by an operation caption (`↓ Linear(24 → 128) + tanh`). Estimated/runtime shapes render in `#C93400`, confirmed in `#0062CC`. Hovering a row highlights its code lines. Below: **각 차원의 의미** (B / 6 / 5 …) |
| ⑤ | 흐름 | list-and-flow hybrid: node cards (이전 / 현재 / 다음), current node tinted blue, connected by vertical rules labelled with the transported data + shape. Nodes with a `link` are clickable and switch function |
| ⑥ | 리뷰 | intro line, yellow **주의점** list (shape 오류 · 단위 · gradient · numerical stability), then issue rows: severity chip + title, expandable to 근거 (mono blue location), 수학적 영향, and a `수정 전후 비교 보기` button → Review screen |

### 7. Project Map

- 48px bar with back link + filter pills `전체 | 함수 호출 | 데이터 흐름 | Import 관계` (active = solid blue).
- Left: 760px column of node cards connected by labelled vertical edges (the edge label is the
  **data** that flows, with its shape — not just a call arrow). Node card = colored dot · mono name ·
  file · role tag (진입점 green / 핵심 blue / 학습 purple / 보정 gray) · one-line description.
  Core nodes get `0 4px 16px rgba(0,0,0,.06)`; the currently selected function is tinted blue.
- Right 320px rail: **the same graph as a plain text list** (accessibility requirement — graphs must
  be readable as text), plus a red 순환 호출 card (`ppo.update() ⇄ rollout.collect()`).

### 8. Code Review + Diff

- Two columns `320px 1fr`.
- Left: category filter pills `전체 | Correctness | Mathematical | Design`, an issue count, and issue
  cards (severity chip + category chip + file:line + title). **Changing the filter also moves the
  detail pane to the first matching issue** — the two panes must never disagree.
- Right detail card follows the fixed report format:
  severity chip · `<Kind> Review` chip · file:line · title (22/700) · sections
  **문제 / 근거 / 현재 동작 / 수학적 영향 / 예상 효과** · **수정 전후** unified diff
  (added `rgba(52,199,89,.10)` with green `+`, removed `rgba(255,59,48,.08)` with red `−`, context plain)
  · buttons `수정 코드 복사` (label flips to `복사했습니다`) and `코드 위치로 이동` · orange **Trade-off**
  box · footnote "MVP는 코드 파일을 자동으로 변경하지 않습니다. 복사만 제공합니다."
- Six seeded issues across the three categories, including two Critical
  (singular Hessian; discontinuous phase weight jump).

### 9. Exception / failure states

Gallery of six cards, each = colored dot + title + plain-language body + mono detail block + one
recovery action button:
지원하지 않는 파일 형식 · 암호화된 ZIP · Python 문법 오류(부분 성공) · 시작점 탐색 실패 ·
Shape 추론 실패 · AI 응답 실패. Rule: **static analysis results survive an AI failure**; only the AI
step is retried, never the whole upload.

---

## Interactions & Behavior

**Cross-highlighting (the signature interaction).** A single `highlight` value —
`{ lines: number[], label: string }` — is shared by the editor, the math card, the IO cards, and the
shape chain.
- Hover a **math symbol** → its `lines` highlight in the editor, editor badge shows `<symbol> → 코드`.
- Hover a **code line** → that line highlights, and every math token / mapping row / IO card / shape
  row whose `lines` include it lights up (`rgba(255,204,0,.42)` for math tokens,
  blue border + tint for IO cards and shape rows).
- Hover a **mapping row**, **IO card**, or **shape row** → same mechanism.
- `mouseleave` clears it. Production may prefer click-to-pin plus hover-to-preview.

**Navigation**
- Landing → Upload → Progress (auto) → Overview → Workspace.
- Overview learning-path row / left-panel row / flow node / map node → select function, reset to
  step 0, clear chat.
- Workspace top tabs → step 0 / 2 / 4, or Map / Review screens.
- Prototype-only: bottom-center floating pill lists all nine screens. **Remove in production.**

**Learning progression**
- `이해했어요 — 다음 단계` advances the step; on the last step it marks the function complete
  (green ✓ in the sidebar, progress bar, green styling in the Overview path) and jumps to the next
  function. Completion also triggers on visiting all six steps.

**Question chips** (11): 왜 필요한가? · 없으면 어떻게 되는가? · 더 쉽게 설명 · 숫자 예시 · 수식 유도 ·
shape가 왜? · 입력이 커지면? · 물리적 의미 · 앞 함수 보기 · 다음 함수 보기 · 문제점 확인.
The last three are navigation, not chat. Chat answers append as bubbles below the card
(user = blue right-aligned, AI = white left-aligned, `white-space: pre-wrap`). Answers always follow
직접 답변 → 근거 코드 → 수학적 이유 → 직관적 예시 → 주의점.

**Certainty display** — subtle by default, detail on hover. Four levels:

| Level | Dot | Text | Chip bg | Meaning |
|---|---|---|---|---|
| 직접 확인 | `#34C759` | `#248A3D` | `rgba(52,199,89,.12)` | present verbatim in the code |
| 정적 분석 | `#007AFF` | `#0062CC` | `rgba(0,122,255,.12)` | from AST / call graph / usage |
| 문맥 추론 | `#FF9500` | `#C93400` | `rgba(255,149,0,.14)` | inferred from names, comments, usage |
| 실행 필요 | `#AF52DE` | `#6B21A8` | `rgba(175,82,222,.12)` | needs runtime to confirm |

Never encode certainty by color alone — the label text is always present.

**Motion** — `fadeUp .22s ease` on card change; `pulseDot 1s infinite` on the active analysis step;
width transitions `.3s`–`.5s` on progress bars; segmented/hover transitions ~`.12s`–`.2s`.

**Empty/loading** — partial analysis must be browsable; per-file results appear as they finish.

## State Management

```
screen        'landing'|'dashboard'|'upload'|'progress'|'overview'|'workspace'|'map'|'review'|'errors'
fnId          currently selected function id
step          0..5  (right-panel card index)
mode          'learning' | 'expert'
highlight     { lines: number[], label: string } | null      // cross-highlight bus
tip           string | null                                   // which certainty tooltip is open
showExample   boolean                                         // numeric example toggle
openIssue     number | null                                   // expanded issue in card ⑥
done          Record<fnId, true>                              // learning progress
chat          { role: 'user'|'ai', text: string }[]           // per function, cleared on switch
draft         string
navTab        'files' | 'fns' | 'path'
mapFilter     '전체' | '함수 호출' | '데이터 흐름' | 'Import 관계'
reviewKind    '전체' | 'Correctness' | 'Mathematical' | 'Design'
reviewSel     index into issues  (must be re-derived when reviewKind changes)
progress      0..6  (analysis step index)
```

Data fetching: project analysis is a background job. The frontend needs
`GET /projects/:id` (status + counts + entry points + learning path),
`GET /projects/:id/functions`, `GET /functions/:id/analysis` (the six-card payload),
`POST /functions/:id/ask` (context-preserving Q&A), `GET /projects/:id/issues`.
See `DATA_MODEL.md`.

## Design Tokens

Derived from the iOS 18 design system (light mode only in this design).

**Color**
```
tint / blue        #007AFF      pressed/dark text  #0062CC
green              #34C759      green text         #248A3D
orange             #FF9500      orange text        #C93400
red                #FF3B30      red text           #D70015
purple             #AF52DE      purple text        #6B21A8
yellow (highlight) #FFCC00

label primary      #000000
label secondary    rgba(60,60,67,.6)
label tertiary     rgba(60,60,67,.3)
label quaternary   rgba(60,60,67,.18)

bg primary         #FFFFFF
bg grouped         #F2F2F7
bg subtle          #FAFAFC / #FCFCFD
separator          rgba(84,84,86,.18)   hairlines drawn at 0.5px
fill               rgba(120,120,128,.08 / .10 / .12 / .16)

code text          #1D1D1F
highlight row      rgba(255,204,0,.20)   bar #FFCC00
highlight symbol   rgba(255,204,0,.42)
link/selection     rgba(0,122,255,.06 / .10 / .12)
diff add           rgba(52,199,89,.10)   diff del  rgba(255,59,48,.08)
```

**Type**
- UI: `-apple-system, "SF Pro Text", "Pretendard Variable", Pretendard, system-ui, sans-serif`
- Code + numerals: `"JetBrains Mono", monospace`
- Math: `Georgia, "Times New Roman", serif`, italic for variables
- Scale used: 56/700/−1.6 · 30/700/−0.7 · 28/700/−0.6 · 22/700/−0.4 · 19/500 · 17/700 (card lead) ·
  15/600 · 14/600 · 13.5 · 13 · 12.5 (body/mono default) · 12 · 11.5 · 11/700 (section kickers,
  letter-spacing .3–.4px) · 10.5/10 (chips)

**Spacing / geometry**
- Grid gaps 6 / 8 / 12 / 14 / 16 / 20; card padding 16–26; screen padding 24–40.
- Radii: 5–7 (chips) · 9–12 (buttons, small cards) · 14 (list containers) · 16 (panel cards) ·
  20 (large cards, sheets) · 999 (pills).
- Heights: top bar 48 · landing nav 52 · editor sub-bar 36 · list row 44 · buttons 26/30/34/38/44 ·
  search 30–36 · left panel 264 · right panel 678 · canvas min-width 1680.
- Shadows: card `0 1px 3px rgba(0,0,0,.08)` · elevated `0 4px 16px rgba(0,0,0,.06)` ·
  floating `0 10px 40px rgba(0,0,0,.18)` · hero `0 12px 48px rgba(0,0,0,.10)` ·
  segmented knob `0 3px 8px rgba(0,0,0,.10)`.

## Assets

None. No images, no icon set, no logo. Glyphs used are text characters
(`∑ ⌕ ⬆ › ‹ ⌄ ✓ ✕ ↑ → ↓ ⇄ ƒ ⑦…`) and can be replaced by an icon library in production.
Fonts: Pretendard (jsDelivr CDN) and JetBrains Mono (Google Fonts). SF Pro resolves natively on
Apple platforms via `-apple-system`.

## Files

- `Code to Math AI Teacher.dc.html` — the full prototype (all nine screens, all interactions).
- `support.js` — runtime required by the prototype file; not part of the product.
- `DATA_MODEL.md` — Pydantic/TypeScript models and the API surface the UI expects.
- `PHASE_1_SLICE.md` — the first vertical slice, its acceptance criteria, and the demo project.
- `COMPONENT_MAP.md` — prototype region → suggested React component tree.

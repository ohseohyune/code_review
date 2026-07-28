# Phase 1 — first vertical slice

Build this end-to-end before anything else. It is the whole product in miniature: upload → understand
one function → see its math → see one grounded problem.

## Scope

```
1. 사용자가 .py 파일을 업로드한다
2. 서버가 AST로 함수와 클래스를 추출한다
3. 사용자가 함수 하나를 선택한다
4. Monaco Editor에 원본 코드가 표시된다
5. 우측 패널이 ① 역할 ② 입력·출력을 보여준다
6. ③ 수식 카드가 코드를 LaTeX로 변환하고 기호↔변수를 연결한다
7. ④ Shape 체인이 차원 변화를 보여준다
8. ⑤ 호출자/호출 대상을 보여준다
9. ⑥ 근거가 있는 문제를 최소 1건 보여준다
```

Screens needed: Upload, Progress (can be a simple determinate bar), Overview (stats + learning path),
Workspace. Map / Review / Dashboard / Errors come later — but **the certainty model and evidence
links ship in Phase 1**; they are not polish.

## Build order

1. **Backend static analysis.** `ast` parse → functions, classes, signatures, imports, call edges,
   `if __name__ == "__main__"` detection. Persist as the structured JSON in `DATA_MODEL.md`.
   Test: given the demo project, assert function count, entry point, and one known call edge.
2. **Workspace shell.** Three columns, Monaco in the middle, function list on the left, empty right
   panel. No AI yet — render `summary` as a placeholder.
3. **Card ① + ②** from static data only (signature, type hints, docstring). Every field carries a
   certainty. This alone is useful.
4. **Cross-highlight bus.** Editor decorations ↔ IO cards. Prove the mechanism before math lands.
5. **Card ③ math.** LLM call returning `EquationInfo`. Render with KaTeX **plus** per-symbol wrappers
   so `mapping[].code_lines` can drive highlighting both ways.
6. **Card ④ shapes.** Symbolic propagation for `nn.Linear`, `view/reshape`, `cat`, elementwise ops;
   anything else → `runtime` certainty. Never fabricate a concrete `B`.
7. **Card ⑤ flow**, then **card ⑥** with one validated issue.
8. **Learning Mode stepper** last — it is a wrapper over the six cards.

## Acceptance criteria

- A `.py` upload produces a function list within a few seconds for a single file.
- Selecting a function shows real source in Monaco with correct line numbers.
- Inputs and outputs render as structured cards, each with type, shape, meaning, origin, certainty.
- At least these conversions work: arithmetic → LaTeX; quadratic cost → `‖·‖²` form; `for` accumulation
  → `Σ`; `if` → piecewise or state transition; `torch.linalg.solve` → `Hu = −g`.
- Hovering a math symbol highlights the right code lines, and vice versa.
- Shapes that cannot be confirmed statically are labelled 추정 or 실행 필요 — never shown as fact.
- At least one issue is produced with a file:line evidence reference and a before/after diff.
- An AI failure leaves the static analysis intact and offers a retry of the AI step only.
- Uploaded code is never executed.

## Demo project (ship it in the repo)

The prototype uses `quadruped-rl-mpc`, a fictional but realistic PyTorch RL + MPC project.
Recreate it as runnable-looking source so the pipeline has something honest to chew on. It must contain:

| File | Contents | Why it is in the demo |
|---|---|---|
| `main.py` | `run()` — config load, env/actor/mpc/trainer construction, control loop, periodic update | entry-point detection; the "not math-expressible → 실행 순서" case |
| `envs/observation.py` | `build_observation()` — slices, `torch.cat`, normalization, NaN guard | tensor construction formula; a real slicing bug (`q[:, :8]`, `dq[:, :9]`) |
| `models/actor.py` | `AdaptiveCostActor(nn.Module)` with `fc1`/`fc2`, `forward()` returning `[B, 6, 5]` | affine + nonlinearity → LaTeX; `view()` shape chain; double-tanh saturation warning |
| `control/mpc.py` | `PHASE_PRIOR` dict, `apply_phase_prior()`, `MPCSolver.solve()` with `torch.linalg.solve` and `clamp` | piecewise + state machine; matrix solve → `Hu = −g`; singular-Hessian Critical; discontinuous weight jump Critical |
| `train/ppo.py` | `PPOTrainer.update()` — ratio, clip, loss, backward | expectation + clip formula; missing advantage normalization warning |
| `legacy_controller.py` | deliberately contains a `SyntaxError` around line 143 | partial-success path: 13 of 14 files analyzed |
| `configs/default.yaml` | `obs_dim: 24`, `horizon: 6`, `n_cost: 5`, `u_max`, `update_every` | shows where the magic numbers come from |

Seeded facts the demo must reproduce (they appear verbatim in the prototype and make good tests):
`observation [B, 24]` → `h [B, 128]` → `raw [B, 30]` → `residual [B, 6, 5]`, with
`B` = batch (runtime), `6` = horizon, `5` = cost terms; and the phase weight jump
`1.5 → 55.0` on `PRE_CONTACT → CONTACT`.

## Out of scope for Phase 1

Runtime execution or hooks, GPU, gradient tracing, private repos, PR analysis, paper mapping,
quizzes, multi-language support, mobile layout, auto-applying fixes.

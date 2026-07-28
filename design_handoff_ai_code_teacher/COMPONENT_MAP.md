# Component map

Prototype region → suggested React component. Names are suggestions; the split is the point.

```
<AppShell>                        screen router
├── <LandingPage>
├── <DashboardPage>
│   └── <ProjectRow status meta onOpen>
├── <UploadPage>
│   ├── <SourceTabs value onChange>            파일 / ZIP / GitHub
│   ├── <Dropzone onFiles>
│   └── <FileManifest files>                   ✓ / ✕ rows with reasons
├── <AnalysisProgressPage>
│   └── <PipelineStep label detail state>      done | current | pending
├── <ProjectOverviewPage>
│   ├── <StatStrip stats>
│   ├── <LearningPathCard steps onSelect>
│   │   └── <LearningStepRow num name why time done>
│   ├── <EntryPointCard candidates>
│   ├── <GlobalFlowCard nodes>
│   └── <CaveatCard items>
├── <WorkspacePage>                            owns HighlightContext + selection
│   ├── <WorkspaceTopBar>
│   │   ├── <Breadcrumb project file>
│   │   ├── <ViewTabs>                         지도/코드 이해/수식/데이터 흐름/리뷰
│   │   └── <ModeToggle value="learning|expert">
│   ├── <ExplorerPanel>            264px
│   │   ├── <SearchField>
│   │   ├── <ExplorerTabs>                     파일 / 함수 / 추천 순서
│   │   ├── <TreeRow icon label badge selected onClick>
│   │   └── <ProgressFooter done total>
│   ├── <CodePanel>                flex
│   │   ├── <EditorSubBar name range highlightLabel>
│   │   └── <MonacoEditor decorations onLineHover>
│   │       └── annotation rail = Monaco content widgets or a sibling column
│   └── <TeacherPanel>             678px
│       ├── <StepRail steps current onJump>
│       ├── <CardStack mode>                   1 card or all 6
│       │   ├── <CardShell kicker certainty>   shared chrome + certainty tooltip
│       │   ├── <OverviewCard summary systemRole chain>
│       │   ├── <IOCard inputs outputs sideEffects>
│       │   │   └── <VariableCard variant="in|out" meta certainty onHover onJump>
│       │   ├── <MathCard equation>
│       │   │   ├── <ReprBadge kind>
│       │   │   ├── <FormulaView tokens onSymbolHover>   KaTeX + per-symbol spans
│       │   │   ├── <PiecewiseList branches>
│       │   │   ├── <StateDiagram transitions>
│       │   │   ├── <SymbolMappingGrid mapping onHover>
│       │   │   ├── <IntuitionBox text>
│       │   │   ├── <NumericExample text expanded onToggle>
│       │   │   └── <NoMathNotice reason sequence>       fallback branch
│       │   ├── <ShapeCard steps dims onHover>
│       │   ├── <FlowCard nodes onSelectFunction>
│       │   └── <ReviewCard warnings issues onOpenDetail>
│       └── <TeacherComposer chips draft onAsk onNext>
├── <ProjectMapPage>
│   ├── <GraphFilters value onChange>
│   ├── <MapNodeCard>  (or React Flow custom node)
│   └── <GraphTextList nodes>                  accessibility twin of the graph
├── <ReviewPage>
│   ├── <IssueFilters value onChange>          전체/Correctness/Mathematical/Design
│   ├── <IssueListItem severity kind file title selected>
│   └── <IssueDetail sections diff tradeoff onCopy onJumpToCode>
│       └── <UnifiedDiff lines>
└── <ErrorStatesPage>
    └── <FailureCard title body detail action>
```

## Shared primitives

- `<CertaintyPill level>` — dot + label + hover explanation. Used in card headers, variable cards,
  and shape rows. Four levels, always with text.
- `<ShapePill value tone>` — mono, blue for confirmed, orange for estimated.
- `<SeverityChip level>` and `<KindChip kind>`.
- `<CodeRefLink file line>` — mono blue, jumps the editor and sets the highlight.
- `<SegmentedControl>` — iOS-style: track `rgba(120,120,128,.12)`, active knob white with
  `0 3px 8px rgba(0,0,0,.10)`, radius 9 outer / 7 inner.

## Highlight context

One provider at `<WorkspacePage>`:

```ts
type Highlight = { lines: number[]; label: string } | null;
const HighlightContext = createContext<{
  highlight: Highlight;
  set(lines: number[], label: string): void;
  clear(): void;
}>(…);
```

Consumers: Monaco decorations, `<FormulaView>`, `<SymbolMappingGrid>`, `<VariableCard>`,
`<ShapeCard>`, and `<EditorSubBar>` (badge). Every element that can participate carries
`code_lines: number[]` from the API — the linking is data, not hardcoded.

Consider a pinned mode (click to lock, hover to preview) — with six cards and a long function,
hover-only linking gets twitchy on real content.

## Notes for implementation

- The right panel is the only place with long text; keep everything else to one line and truncate.
- Learning vs Expert is a rendering choice over the same card components — no duplicated markup.
- `chat` resets when the selected function changes; the composer stays mounted.
- Review filter and review selection must be derived together (the first version of this prototype
  had them diverge — filter changed the list but not the detail pane).
- Progress and analysis status should stream; do not block the Overview on the AI step.

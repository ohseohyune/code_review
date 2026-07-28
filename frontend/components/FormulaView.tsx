"use client";
import katex from "katex";
import type { MathToken } from "@/lib/types";
import { useHighlight } from "@/lib/highlight-context";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// \text{...} is the model's usual way to embed a code identifier (e.g. \text{self.n_cost})
// -- KaTeX treats a bare "_" inside \text{} as a real parse error, unlike real LaTeX, and
// the model doesn't reliably escape it even when told to. Fix it mechanically instead of
// relying on prompt compliance.
function escapeTextUnderscores(text: string): string {
  return text.replace(/\\text\{([^}]*)\}/g, (_m, inner: string) => `\\text{${inner.replace(/(?<!\\)_/g, "\\_")}}`);
}

// A de-LaTeX'd plain-text version, used only when KaTeX still can't parse a token even
// after the fixups above -- strips backslash-commands and braces so a stray broken
// fragment reads as text instead of visible LaTeX source with a red error box.
function stripLatexSyntax(text: string): string {
  return text.replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "");
}

function renderTex(text: string): string {
  const fixed = escapeTextUnderscores(text);
  try {
    const html = katex.renderToString(fixed, { throwOnError: false, output: "html" });
    if (html.includes("katex-error")) return escapeHtml(stripLatexSyntax(text));
    return html;
  } catch {
    // Malformed LaTeX from the model (e.g. raw code text) -- show it as plain,
    // escaped text instead of throwing or injecting unescaped HTML.
    return escapeHtml(stripLatexSyntax(text));
  }
}

export default function FormulaView({ tokens, ariaLabel }: { tokens: MathToken[]; ariaLabel?: string }) {
  const { highlight, set, clear } = useHighlight();

  if (tokens.length === 0) return null;

  // A LaTeX environment (\begin{bmatrix}...\end{bmatrix}) only parses as one unit --
  // KaTeX renders each token independently, so if the model ever splits one across
  // tokens (each fragment then fails on its own), fall back to one combined render
  // of every token's text joined together instead of showing the broken pieces.
  const hasSplitEnvironment = tokens.some((t) => /\\begin\{|\\end\{/.test(t.text));
  if (hasSplitEnvironment) {
    return (
      <div
        role="img"
        aria-label={ariaLabel ?? tokens.map((t) => t.text).join(" ")}
        className="rounded-xl bg-[#FAFAFC] px-4 py-4 text-[21px]"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        dangerouslySetInnerHTML={{ __html: renderTex(tokens.map((t) => t.text).join(" ")) }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? tokens.map((t) => t.text).join(" ")}
      className="flex flex-wrap items-center gap-1 rounded-xl bg-[#FAFAFC] px-4 py-4 text-[21px]"
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      {tokens.map((tok, i) => {
        const active = tok.code_lines.length > 0 &&
          highlight?.lines.some((l) => tok.code_lines.includes(l));
        return (
          <span
            key={i}
            className="rounded px-0.5"
            style={{
              background: active ? "rgba(255,204,0,.42)" : "transparent",
              cursor: tok.code_lines.length > 0 ? "pointer" : "default",
            }}
            onMouseEnter={() => tok.code_lines.length > 0 && set(tok.code_lines, `${tok.text} → 코드`)}
            onMouseLeave={clear}
            dangerouslySetInnerHTML={{ __html: renderTex(tok.text) }}
          />
        );
      })}
    </div>
  );
}

"use client";
import type { MathToken } from "@/lib/types";
import { useHighlight } from "@/lib/highlight-context";
import { renderTex } from "@/lib/katex-render";

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

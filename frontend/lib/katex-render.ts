import katex from "katex";

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

export function renderTex(text: string): string {
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

// For fields that are meant to be a bare symbol (e.g. equation.mapping[].symbol), not a
// full LaTeX expression -- the model sometimes wraps them in \text{...} or other markup
// anyway. Strip LaTeX syntax outright and show plain text; never run these through KaTeX,
// since a bare symbol rendered as "math" just looks like an italic letter for no reason.
export function plainSymbol(text: string): string {
  return text.replace(/\\text\{([^}]*)\}/g, "$1").replace(/\\[a-zA-Z]+/g, "").replace(/[{}\\]/g, "");
}

const PROSE_MACROS: Record<string, string> = {
  epsilon: "ε", varepsilon: "ε", alpha: "α", beta: "β", gamma: "γ", delta: "δ",
  Delta: "Δ", theta: "θ", lambda: "λ", mu: "μ", pi: "π", sigma: "σ", Sigma: "Σ",
  phi: "φ", omega: "ω", Omega: "Ω", tau: "τ", eta: "η", rho: "ρ",
  times: "×", cdot: "·", leq: "≤", geq: "≥", neq: "≠", approx: "≈",
  in: "∈", subset: "⊂", cup: "∪", cap: "∩", varnothing: "∅", infty: "∞",
  sum: "∑", prod: "∏", max: "max", min: "min", log: "log", exp: "exp",
};

// explanation/intuition fields are prose rendered as plain text, but the model still
// slips a LaTeX macro in now and then -- which would otherwise show up on screen as a
// literal backslash. Swap the common ones for their real glyph and drop the leftover
// markup, so the sentence reads correctly no matter how well the model behaved.
export function proseText(text: string): string {
  return text
    .replace(/\\text(?:tt|bf|rm)?\{([^}]*)\}/g, "$1")
    .replace(/\\([a-zA-Z]+)/g, (m, name: string) => PROSE_MACROS[name] ?? "")
    .replace(/[{}$]/g, "")
    .replace(/[ \t]{2,}/g, " ");
}

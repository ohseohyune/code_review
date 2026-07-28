"use client";
import { useState } from "react";
import { CERTAINTY } from "@/lib/certainty";
import type { Certainty } from "@/lib/types";

export default function CertaintyPill({ level }: { level: Certainty }) {
  const [open, setOpen] = useState(false);
  const c = CERTAINTY[level];
  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold cursor-default"
      style={{ backgroundColor: c.chipBg, color: c.text }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
      {c.label}
      {open && (
        <span
          className="absolute right-0 top-full mt-1.5 w-56 rounded-xl bg-white p-3 text-[12px] font-normal leading-snug text-black shadow-[0_10px_40px_rgba(0,0,0,.18)] z-50"
          style={{ border: "0.5px solid rgba(84,84,86,.18)" }}
        >
          {c.desc}
        </span>
      )}
    </span>
  );
}

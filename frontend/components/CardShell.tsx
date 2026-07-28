import type { ReactNode } from "react";
import type { Certainty } from "@/lib/types";
import CertaintyPill from "./CertaintyPill";

export default function CardShell({
  kicker,
  certainty,
  children,
}: {
  kicker: string;
  certainty?: Certainty;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl bg-white p-5 animate-[fadeUp_.22s_ease]"
      style={{ border: "0.5px solid rgba(84,84,86,.18)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-black/70">{kicker}</span>
        {certainty && <CertaintyPill level={certainty} />}
      </div>
      {children}
    </div>
  );
}

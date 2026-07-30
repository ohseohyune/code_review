"use client";
import { usePathname, useRouter } from "next/navigation";

// Landing page (/) already has its own full nav bar (logo, 대시보드, 새 프로젝트) --
// this bar is for every other page, which previously had no consistent way back.
export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/") return null;

  return (
    <nav
      className="sticky top-0 z-30 flex h-11 items-center gap-1 px-4 backdrop-blur-md bg-white/80"
      style={{ borderBottom: "0.5px solid rgba(84,84,86,.18)" }}
    >
      <button
        onClick={() => router.back()}
        aria-label="뒤로"
        className="flex h-7 w-7 items-center justify-center rounded-full text-[15px]"
        style={{ color: "rgba(60,60,67,.7)" }}
      >
        ←
      </button>
      <button
        onClick={() => router.forward()}
        aria-label="앞으로"
        className="flex h-7 w-7 items-center justify-center rounded-full text-[15px]"
        style={{ color: "rgba(60,60,67,.7)" }}
      >
        →
      </button>
      <a
        href="/"
        className="ml-1 flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold"
        style={{ color: "rgba(60,60,67,.7)" }}
      >
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] font-mono text-[10px] text-white" style={{ background: "#0B0D12" }}>
          M
        </span>
        홈
      </a>
      <a
        href="/dashboard"
        className="flex h-7 items-center rounded-full px-2.5 text-[12.5px] font-semibold"
        style={{ color: "rgba(60,60,67,.7)" }}
      >
        대시보드
      </a>
    </nav>
  );
}

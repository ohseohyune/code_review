"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";

export default function DeleteProjectButton({
  projectId,
  onDeleted,
}: {
  projectId: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        if (!confirm("이 프로젝트를 삭제할까요? 업로드된 코드가 서버에서 함께 삭제됩니다.")) return;
        await api.deleteProject(projectId);
        track("project_deleted", { projectId });
        if (onDeleted) onDeleted();
        else router.push("/");
      }}
      className="text-[12.5px] font-semibold text-[#D70015]"
    >
      프로젝트 삭제
    </button>
  );
}

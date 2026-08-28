"use client";

import { useEnLigne } from "@/lib/use-online";

const MESSAGE_HORS_LIGNE = "Hors ligne · consultation seule";

export function OfflineBanner() {
  const enLigne = useEnLigne();

  if (enLigne) {
    return null;
  }

  return (
    <div
      role="status"
      className="bg-surface border-divider border-b px-[18px] py-[7px] text-center text-[11px] text-neutral-400"
    >
      {MESSAGE_HORS_LIGNE}
    </div>
  );
}

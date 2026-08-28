"use client";

import { useSyncExternalStore } from "react";

function souscrire(surChangement: () => void): () => void {
  window.addEventListener("online", surChangement);
  window.addEventListener("offline", surChangement);
  return () => {
    window.removeEventListener("online", surChangement);
    window.removeEventListener("offline", surChangement);
  };
}

export function useEnLigne(): boolean {
  return useSyncExternalStore(
    souscrire,
    () => navigator.onLine,
    () => true,
  );
}

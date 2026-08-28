"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-[14px] px-[18px] text-center">
      <p className="text-[13px] text-neutral-400">La collection n’a pas pu être chargée.</p>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 rounded-md border border-accent px-[14px] text-[13px] font-medium text-accent transition-colors hover:bg-accent/12"
      >
        Réessayer
      </button>
    </div>
  );
}

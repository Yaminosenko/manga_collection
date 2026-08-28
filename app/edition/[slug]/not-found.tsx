import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-[14px] px-[18px] text-center">
      <p className="text-[13px] text-neutral-400">Cette édition n’existe pas.</p>
      <Link
        href="/"
        className="flex min-h-11 items-center rounded-md border border-accent px-[14px] text-[13px] font-medium text-accent transition-colors hover:bg-accent/12"
      >
        Retour à la collection
      </Link>
    </div>
  );
}

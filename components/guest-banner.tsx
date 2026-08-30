import { quitterInvite } from "@/lib/auth-actions";
import { LIBELLE_MODE_INVITE, LIBELLE_QUITTER_INVITE } from "@/lib/constants";

export function GuestBanner() {
  return (
    <div
      role="status"
      className="bg-surface border-divider flex items-center justify-between gap-[12px] border-b px-[18px] py-[7px] text-[11px] text-neutral-400"
    >
      <span>{LIBELLE_MODE_INVITE}</span>
      <form action={quitterInvite}>
        <button type="submit" className="text-accent min-h-11 font-medium">
          {LIBELLE_QUITTER_INVITE}
        </button>
      </form>
    </div>
  );
}

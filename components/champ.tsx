export const CLASSE_CHAMP =
  "bg-surface text-text min-h-11 w-full rounded-md border border-neutral-800 px-[14px] text-[14px] placeholder:text-neutral-600 focus:border-accent focus:outline-none";

export const CLASSE_BOUTON =
  "border-accent text-accent flex min-h-11 w-full items-center justify-center rounded-md border text-[14px] font-medium tracking-[0.06em] uppercase transition-colors hover:bg-accent/12 active:bg-accent/22 disabled:opacity-50";

export const CLASSE_BOUTON_DISCRET =
  "min-h-11 w-full text-[12.5px] text-neutral-500 transition-colors hover:text-neutral-300";

export const CLASSE_MENTION = "text-[11px]/[1.5] text-neutral-600";

type ChampProps = {
  nom: string;
  libelle: string;
  type?: string;
  autoComplete?: string;
  valeurInitiale?: string;
  autoFocus?: boolean;
  mention?: string;
  facultatif?: boolean;
};

export function Champ({
  nom,
  libelle,
  type = "text",
  autoComplete,
  valeurInitiale,
  autoFocus,
  mention,
  facultatif,
}: ChampProps) {
  return (
    <label className="flex flex-col gap-[5px]">
      <span className="text-[11px] font-medium tracking-[0.08em] text-neutral-500 uppercase">
        {libelle}
      </span>
      <input
        name={nom}
        type={type}
        autoComplete={autoComplete}
        defaultValue={valeurInitiale}
        autoFocus={autoFocus}
        required={!facultatif}
        className={CLASSE_CHAMP}
      />
      {mention ? <span className={CLASSE_MENTION}>{mention}</span> : null}
    </label>
  );
}

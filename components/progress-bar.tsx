type ProgressBarProps = {
  possedes: number;
  tomesParus: number;
  aParaitre: boolean;
  desature?: boolean;
  hauteurClassName?: string;
  largeurAParaitreClassName?: string;
};

export function ProgressBar({
  possedes,
  tomesParus,
  aParaitre,
  desature = false,
  hauteurClassName = "h-[5px]",
  largeurAParaitreClassName = "w-[20px]",
}: ProgressBarProps) {
  const manquants = Math.max(tomesParus - possedes, 0);

  return (
    <div className={`flex flex-1 gap-[3px] ${hauteurClassName}`}>
      {possedes > 0 ? (
        <div
          style={{ flexGrow: possedes }}
          className={`rounded-[3px] ${desature ? "bg-accent-700" : "bg-accent"}`}
        />
      ) : null}
      {manquants > 0 ? (
        <div style={{ flexGrow: manquants }} className="rounded-[3px] bg-neutral-800" />
      ) : null}
      {aParaitre ? (
        <div className={`zone-a-paraitre flex-none rounded-[3px] ${largeurAParaitreClassName}`} />
      ) : null}
    </div>
  );
}

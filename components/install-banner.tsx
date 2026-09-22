"use client";

import { CLASSE_BOUTON_COMPACT, CLASSE_MENTION } from "@/components/champ";
import { DotsThreeVertical, Export } from "@/components/icons";
import {
  LIBELLE_INSTALLATION_PLUS_TARD,
  LIBELLE_INSTALLER,
  MENTION_INSTALLATION_INVITE,
  MENTION_INSTALLATION_IOS_AUTRE,
  MENTION_INSTALLATION_MENU_CHROME,
  MENTION_INSTALLATION_SAFARI,
  MENTION_INSTALLATION_WEBVIEW,
  TITRE_INSTALLATION,
} from "@/lib/constants";
import { useInviteInstallation, type FormeInvite } from "@/lib/use-installation";

const MENTIONS: Record<Exclude<FormeInvite, "aucune">, string> = {
  invite: MENTION_INSTALLATION_INVITE,
  "menu-chrome": MENTION_INSTALLATION_MENU_CHROME,
  "geste-safari": MENTION_INSTALLATION_SAFARI,
  "geste-ios-autre": MENTION_INSTALLATION_IOS_AUTRE,
  webview: MENTION_INSTALLATION_WEBVIEW,
};

function Glyphe({ forme }: { forme: FormeInvite }) {
  if (forme === "geste-safari") {
    return <Export className="size-[14px] flex-none text-neutral-400" />;
  }
  if (forme === "menu-chrome") {
    return <DotsThreeVertical className="size-[14px] flex-none text-neutral-400" />;
  }
  return null;
}

export function InstallBanner() {
  const { forme, installer, reporter } = useInviteInstallation();

  if (forme === "aucune") {
    return null;
  }

  return (
    <aside className="bg-header border-divider flex flex-none items-center gap-[8px] border-b px-[18px] py-[9px]">
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="text-text text-[13px] font-medium">{TITRE_INSTALLATION}</span>
        <span className={`${CLASSE_MENTION} flex items-start gap-[5px]`}>
          <Glyphe forme={forme} />
          <span>{MENTIONS[forme]}</span>
        </span>
      </div>
      {forme === "invite" ? (
        <button type="button" onClick={installer} className={CLASSE_BOUTON_COMPACT}>
          {LIBELLE_INSTALLER}
        </button>
      ) : null}
      <button
        type="button"
        onClick={reporter}
        className="min-h-11 flex-none px-[2px] text-[12px] text-neutral-500 transition-colors hover:text-neutral-300"
      >
        {LIBELLE_INSTALLATION_PLUS_TARD}
      </button>
    </aside>
  );
}

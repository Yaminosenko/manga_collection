"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, MagnifyingGlass, WarningCircle } from "@/components/icons";
import { basculerTome, resoudreIsbn } from "@/lib/actions";
import {
  LIBELLE_ISBN,
  LIBELLE_SCAN_HORS_COLLECTION,
  LIBELLE_SCAN_INCONNU,
  LIBELLE_SCAN_INDISPONIBLE,
  LIBELLE_SCAN_INVITE,
  LIBELLE_SCAN_ISBN_INVALIDE,
} from "@/lib/constants";
import { formaterMoisSortie } from "@/lib/format";
import { isbnValide, type ResultatScan } from "@/lib/domain";

const CHAMP =
  "bg-surface w-full rounded-md px-[12px] py-[9px] text-[13px] text-text outline-none placeholder:text-neutral-600";
const BOUTON =
  "flex min-h-11 items-center justify-center rounded-md border border-accent px-[14px] text-[13px] font-medium text-accent transition-colors hover:bg-accent/12";

type Detecteur = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

export function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const flux = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<"inconnue" | "active" | "indisponible">("inconnue");
  const [saisie, setSaisie] = useState("");
  const [resultat, setResultat] = useState<ResultatScan | null>(null);
  const [invalide, setInvalide] = useState(false);
  const [enCours, demarrer] = useTransition();

  const resoudre = useCallback((isbn: string) => {
    setInvalide(false);
    demarrer(async () => {
      const trouve = await resoudreIsbn(isbn);
      if (trouve === null) {
        setInvalide(true);
        setResultat(null);
        return;
      }
      setResultat(trouve);
    });
  }, []);

  const arreterCamera = useCallback(() => {
    flux.current?.getTracks().forEach((piste) => piste.stop());
    flux.current = null;
  }, []);

  useEffect(() => {
    let vivant = true;
    let minuteur: ReturnType<typeof setInterval> | null = null;

    async function demarrerCamera() {
      const Detecteur = (window as unknown as { BarcodeDetector?: new (o: object) => Detecteur })
        .BarcodeDetector;
      if (!Detecteur || !navigator.mediaDevices?.getUserMedia) {
        setCamera("indisponible");
        return;
      }
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!vivant) {
          media.getTracks().forEach((piste) => piste.stop());
          return;
        }
        flux.current = media;
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }
        setCamera("active");

        const detecteur = new Detecteur({ formats: ["ean_13"] });
        minuteur = setInterval(async () => {
          if (!video.current) return;
          try {
            const codes = await detecteur.detect(video.current);
            const code = codes.find((c) => isbnValide(c.rawValue));
            if (code) {
              if (minuteur) clearInterval(minuteur);
              arreterCamera();
              setCamera("inconnue");
              setSaisie(code.rawValue);
              resoudre(code.rawValue);
            }
          } catch {
            /* une image illisible n'est pas une erreur */
          }
        }, 400);
      } catch {
        setCamera("indisponible");
      }
    }

    demarrerCamera();
    return () => {
      vivant = false;
      if (minuteur) clearInterval(minuteur);
      arreterCamera();
    };
  }, [arreterCamera, resoudre]);

  return (
    <div className="flex flex-1 flex-col gap-[16px] px-[18px] pb-[18px]">
      {camera === "active" ? (
        <div className="relative overflow-hidden rounded-md bg-black">
          <video ref={video} muted playsInline className="h-[240px] w-full object-cover" />
          <span className="absolute inset-x-[14%] top-1/2 h-[2px] -translate-y-1/2 bg-accent/70" />
        </div>
      ) : null}

      <p className="text-[11.5px]/[1.6] text-neutral-600">
        {camera === "indisponible" ? LIBELLE_SCAN_INDISPONIBLE : LIBELLE_SCAN_INVITE}
      </p>

      <form
        onSubmit={(evenement) => {
          evenement.preventDefault();
          resoudre(saisie);
        }}
        className="flex gap-[8px]"
      >
        <input
          value={saisie}
          onChange={(evenement) => setSaisie(evenement.target.value)}
          inputMode="numeric"
          placeholder={LIBELLE_ISBN}
          aria-label={LIBELLE_ISBN}
          className={CHAMP}
        />
        <button type="submit" disabled={enCours} className={`${BOUTON} flex-none`}>
          <MagnifyingGlass className="size-[15px]" />
        </button>
      </form>

      {invalide ? (
        <p className="flex items-center gap-[6px] text-[12px] text-neutral-400">
          <WarningCircle className="size-[13px] flex-none" />
          {LIBELLE_SCAN_ISBN_INVALIDE}
        </p>
      ) : null}

      {resultat ? <Resultat resultat={resultat} /> : null}
    </div>
  );
}

function Resultat({ resultat }: { resultat: ResultatScan }) {
  const [possede, setPossede] = useState(resultat.type === "tome" ? resultat.possede : false);
  const [enCours, demarrer] = useTransition();

  if (resultat.type === "tome") {
    return (
      <article className="bg-surface flex flex-col gap-[10px] rounded-md p-[14px]">
        <span className="text-text text-[15px] font-medium">
          {resultat.titre} · tome {resultat.numero}
        </span>
        <span className="text-[12px] text-neutral-500">{resultat.nom}</span>
        <div className="flex gap-[8px]">
          <button
            type="button"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                const cible = !possede;
                setPossede(cible);
                await basculerTome(resultat.slug, resultat.numero, cible);
              })
            }
            className={`${BOUTON} flex-1 gap-[6px]`}
          >
            {possede ? <Check className="size-[13px]" /> : null}
            {possede ? "Possédé" : "Marquer possédé"}
          </button>
          <Link href={`/edition/${resultat.slug}`} className={`${BOUTON} flex-none`}>
            Ouvrir
          </Link>
        </div>
      </article>
    );
  }

  if (resultat.type === "annonce") {
    return (
      <article className="bg-surface flex flex-col gap-[8px] rounded-md p-[14px]">
        <span className="text-text text-[15px] font-medium">
          {resultat.titre} · tome {resultat.numero}
        </span>
        <span className="text-accent text-[12.5px] font-medium">
          À paraître · {formaterMoisSortie(resultat.date)}
        </span>
        <Link href={`/edition/${resultat.slug}`} className={`${BOUTON} mt-[4px]`}>
          Ouvrir l’édition
        </Link>
      </article>
    );
  }

  if (resultat.type === "notice") {
    return (
      <article className="bg-surface flex flex-col gap-[8px] rounded-md p-[14px]">
        <span className="text-text text-[15px] font-medium">{resultat.titreNotice}</span>
        <span className="text-[12px] text-neutral-500">
          {[resultat.editeur, resultat.annee].filter(Boolean).join(" · ")}
        </span>
        <span className="text-[11px] text-neutral-600">
          {LIBELLE_ISBN} {resultat.isbn}
        </span>
        {resultat.slugProbable ? (
          <Link href={`/edition/${resultat.slugProbable}`} className={`${BOUTON} mt-[4px]`}>
            Ouvrir {resultat.titreProbable}
          </Link>
        ) : (
          <span className="text-[12px] text-neutral-500">{LIBELLE_SCAN_HORS_COLLECTION}</span>
        )}
      </article>
    );
  }

  return (
    <article className="bg-surface flex flex-col gap-[6px] rounded-md p-[14px]">
      <span className="text-[13px] text-neutral-400">{LIBELLE_SCAN_INCONNU}</span>
      <span className="text-[11px] text-neutral-600">
        {LIBELLE_ISBN} {resultat.isbn}
      </span>
    </article>
  );
}

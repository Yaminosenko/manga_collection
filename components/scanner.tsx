"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, MagnifyingGlass, WarningCircle } from "@/components/icons";
import { ajouterCandidatDirect, basculerTome, resoudreIsbn } from "@/lib/actions";
import {
  CANDIDATS_SCAN_MAX,
  CLE_STOCKAGE_CAMERA,
  LIBELLE_CAMERA,
  LIBELLE_ISBN,
  LIBELLE_REFAIRE_MISE_AU_POINT,
  LIBELLE_AJOUT_EN_COURS,
  LIBELLE_SCAN_AJOUTER_ET_COCHER,
  LIBELLE_SCAN_CANDIDATS_TITRE,
  LIBELLE_SCAN_HORS_COLLECTION,
  LIBELLE_SCAN_INCONNU,
  LIBELLE_SCAN_INDISPONIBLE,
  LIBELLE_SCAN_INVITE,
  LIBELLE_SCAN_ISBN_INVALIDE,
  LIBELLE_SCAN_OUVRIR_EDITION,
  MENTION_NOTICE_SANS_CATALOGUE,
  MENTION_CHOIX_CAMERA,
  ZOOM_RAPPROCHE,
} from "@/lib/constants";
import { formaterMoisSortie } from "@/lib/format";
import { isbnValide, type ResultatScan } from "@/lib/domain";

const CHAMP =
  "bg-surface w-full rounded-md px-[12px] py-[9px] text-[13px] text-text outline-none placeholder:text-neutral-600";
const BOUTON =
  "flex min-h-11 items-center justify-center rounded-md border border-accent px-[14px] text-[13px] font-medium text-accent transition-colors hover:bg-accent/12";
const INTERVALLE_DETECTION_MS = 400;
const LARGEUR_IDEALE = 1920;
const HAUTEUR_IDEALE = 1080;

type Intervalle = { min: number; max: number; step?: number };
type CapacitesEtendues = MediaTrackCapabilities & {
  focusMode?: string[];
  zoom?: Intervalle;
};
type ContraintesEtendues = MediaTrackConstraintSet & {
  focusMode?: string;
  zoom?: number;
};

function capacitesDe(flux: MediaStream): CapacitesEtendues | null {
  const piste = flux.getVideoTracks()[0];
  if (!piste?.getCapabilities) {
    return null;
  }
  return (piste.getCapabilities() as CapacitesEtendues) ?? null;
}

async function appliquer(flux: MediaStream, contraintes: ContraintesEtendues[]): Promise<void> {
  const piste = flux.getVideoTracks()[0];
  if (!piste?.applyConstraints || contraintes.length === 0) {
    return;
  }
  try {
    await piste.applyConstraints({ advanced: contraintes as MediaTrackConstraintSet[] });
  } catch {
    /* l'appareil refuse : on garde ses reglages par defaut */
  }
}

function zoomUtile(capacites: CapacitesEtendues | null): number | null {
  const plage = capacites?.zoom;
  if (!plage || typeof plage.max !== "number" || plage.max <= 1) {
    return null;
  }
  return Math.min(plage.max, ZOOM_RAPPROCHE);
}

async function reglerMiseAuPoint(flux: MediaStream): Promise<void> {
  const capacites = capacitesDe(flux);
  const modes = capacites?.focusMode ?? [];
  const contraintes: ContraintesEtendues[] = [];

  if (modes.includes("continuous")) {
    contraintes.push({ focusMode: "continuous" });
  }
  const zoom = zoomUtile(capacites);
  if (zoom !== null) {
    contraintes.push({ zoom });
  }

  await appliquer(flux, contraintes);
}

async function refaireLaMiseAuPoint(flux: MediaStream): Promise<void> {
  const modes = capacitesDe(flux)?.focusMode ?? [];
  if (modes.includes("single-shot")) {
    await appliquer(flux, [{ focusMode: "single-shot" }]);
    return;
  }
  await reglerMiseAuPoint(flux);
}

function lireCameraMemorisee(): string | null {
  try {
    return window.localStorage.getItem(CLE_STOCKAGE_CAMERA);
  } catch {
    return null;
  }
}

function memoriserCamera(identifiant: string): void {
  try {
    window.localStorage.setItem(CLE_STOCKAGE_CAMERA, identifiant);
  } catch {
    /* le navigateur refuse le stockage : le choix ne survivra pas a la session */
  }
}

async function camerasDisponibles(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  try {
    const appareils = await navigator.mediaDevices.enumerateDevices();
    return appareils.filter((appareil) => appareil.kind === "videoinput");
  } catch {
    return [];
  }
}

function nomDeCamera(appareil: MediaDeviceInfo, rang: number): string {
  const brut = appareil.label.trim();
  if (brut === "") {
    return `${LIBELLE_CAMERA} ${rang + 1}`;
  }
  return brut.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, "");
}

type Detecteur = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

export function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const [flux, setFlux] = useState<MediaStream | null>(null);
  const [camera, setCamera] = useState<"inconnue" | "active" | "indisponible">("inconnue");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [choixCamera, setChoixCamera] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<string | null>(null);
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

  useEffect(() => {
    let vivant = true;
    let obtenu: MediaStream | null = null;

    async function ouvrirCamera() {
      const Detecteur = (window as unknown as { BarcodeDetector?: new (o: object) => Detecteur })
        .BarcodeDetector;
      if (!Detecteur || !navigator.mediaDevices?.getUserMedia) {
        setCamera("indisponible");
        return;
      }

      const memorisee = choixCamera ?? lireCameraMemorisee();
      const resolution = {
        width: { ideal: LARGEUR_IDEALE },
        height: { ideal: HAUTEUR_IDEALE },
      };

      try {
        obtenu = await navigator.mediaDevices.getUserMedia({
          video: memorisee
            ? { deviceId: { exact: memorisee }, ...resolution }
            : { facingMode: "environment", ...resolution },
        });
      } catch {
        try {
          obtenu = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", ...resolution },
          });
        } catch {
          setCamera("indisponible");
          return;
        }
      }

      if (!vivant) {
        obtenu.getTracks().forEach((piste) => piste.stop());
        return;
      }

      await reglerMiseAuPoint(obtenu);
      const trouvees = await camerasDisponibles();
      const utilisee = obtenu.getVideoTracks()[0]?.getSettings().deviceId ?? null;

      if (!vivant) {
        obtenu.getTracks().forEach((piste) => piste.stop());
        return;
      }

      setCameras(trouvees);
      setCameraActive(utilisee);
      setCamera("active");
      setFlux(obtenu);
    }

    ouvrirCamera();
    return () => {
      vivant = false;
      obtenu?.getTracks().forEach((piste) => piste.stop());
    };
  }, [choixCamera]);

  useEffect(() => {
    if (!flux || !video.current) {
      return;
    }
    const element = video.current;
    element.srcObject = flux;
    element
      .play()
      .then(() => reglerMiseAuPoint(flux))
      .catch(() => setCamera("indisponible"));

    const Detecteur = (window as unknown as { BarcodeDetector?: new (o: object) => Detecteur })
      .BarcodeDetector;
    if (!Detecteur) {
      return;
    }
    const detecteur = new Detecteur({ formats: ["ean_13"] });

    const minuteur = setInterval(async () => {
      try {
        const codes = await detecteur.detect(element);
        const code = codes.find((c) => isbnValide(c.rawValue));
        if (code) {
          flux.getTracks().forEach((piste) => piste.stop());
          setFlux(null);
          setCamera("inconnue");
          setSaisie(code.rawValue);
          resoudre(code.rawValue);
        }
      } catch {
        /* une image illisible n'est pas une erreur */
      }
    }, INTERVALLE_DETECTION_MS);

    return () => {
      clearInterval(minuteur);
      element.srcObject = null;
    };
  }, [flux, resoudre]);

  return (
    <div className="flex flex-1 flex-col gap-[16px] px-[18px] pb-[18px]">
      <button
        type="button"
        hidden={camera !== "active"}
        onClick={() => {
          if (flux) refaireLaMiseAuPoint(flux);
        }}
        aria-label={LIBELLE_REFAIRE_MISE_AU_POINT}
        className="relative block overflow-hidden rounded-md bg-black"
      >
        <video
          ref={video}
          muted
          autoPlay
          playsInline
          className="aspect-[4/3] w-full object-cover"
        />
        <span className="bg-accent/70 pointer-events-none absolute inset-x-[14%] top-1/2 h-[2px] -translate-y-1/2" />
      </button>

      {camera === "active" && cameras.length > 1 ? (
        <div className="flex flex-wrap gap-[6px]">
          {cameras.map((appareil, rang) => {
            const actif = cameraActive === appareil.deviceId;
            return (
              <button
                key={appareil.deviceId}
                type="button"
                aria-pressed={actif}
                onClick={() => {
                  memoriserCamera(appareil.deviceId);
                  flux?.getTracks().forEach((piste) => piste.stop());
                  setFlux(null);
                  setCamera("inconnue");
                  setChoixCamera(appareil.deviceId);
                }}
                className={`min-h-11 max-w-full truncate rounded-md border px-[10px] text-[11.5px] font-medium transition-colors ${
                  actif
                    ? "border-accent text-accent bg-accent/12"
                    : "border-neutral-800 text-neutral-400 hover:border-neutral-700"
                }`}
              >
                {nomDeCamera(appareil, rang)}
              </button>
            );
          })}
        </div>
      ) : null}

      <p className="text-[11.5px]/[1.6] text-neutral-600">
        {camera === "indisponible"
          ? LIBELLE_SCAN_INDISPONIBLE
          : camera === "active"
            ? `${LIBELLE_SCAN_INVITE} ${LIBELLE_REFAIRE_MISE_AU_POINT}${cameras.length > 1 ? ` ${MENTION_CHOIX_CAMERA}` : ""}`
            : LIBELLE_SCAN_INVITE}
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

      {resultat ? <Resultat key={resultat.isbn} resultat={resultat} /> : null}
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

  if (resultat.type === "catalogue") {
    const { candidat, tomesAvecEan } = resultat.prepare;
    return (
      <article className="bg-surface flex flex-col gap-[8px] rounded-md p-[14px]">
        <span className="titre-serie text-text text-[15px] font-medium">{candidat.titre}</span>
        <span className="text-[12px] text-neutral-500">
          {[candidat.nom, resultat.prepare.editeur].filter(Boolean).join(" · ")}
        </span>
        <span className="text-[11.5px] text-neutral-500">
          {candidat.tomesParus} tomes parus · {tomesAvecEan} avec ISBN
        </span>
        {candidat.slugEnCollection ? (
          <Link
            href={`/edition/${candidat.slugEnCollection}`}
            className={`${BOUTON} mt-[4px]`}
          >
            {LIBELLE_SCAN_OUVRIR_EDITION}
          </Link>
        ) : (
          <>
            <span className="text-[11.5px]/[1.5] text-neutral-600">
              {LIBELLE_SCAN_HORS_COLLECTION}
            </span>
            <button
              type="button"
              disabled={enCours}
              onClick={() =>
                demarrer(async () => {
                  await ajouterCandidatDirect(
                    candidat.serieNormalise,
                    candidat.marqueurNormalise,
                    resultat.isbn,
                  );
                })
              }
              className={`${BOUTON} mt-[4px] disabled:opacity-50`}
            >
              {enCours ? LIBELLE_AJOUT_EN_COURS : LIBELLE_SCAN_AJOUTER_ET_COCHER}
            </button>
          </>
        )}
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
        {resultat.candidats.length > 0 ? (
          <>
            <span className="text-[11.5px]/[1.5] text-neutral-600">
              {LIBELLE_SCAN_CANDIDATS_TITRE}
            </span>
            {resultat.candidats.slice(0, CANDIDATS_SCAN_MAX).map((candidat) => (
              <span
                key={`${candidat.serieNormalise}-${candidat.marqueurNormalise ?? ""}`}
                className="text-[12px] text-neutral-400"
              >
                {candidat.titre} · {candidat.nom} · {candidat.tomesParus} tomes
              </span>
            ))}
            <span className="text-[11.5px]/[1.5] text-neutral-600">
              {MENTION_NOTICE_SANS_CATALOGUE}
            </span>
          </>
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

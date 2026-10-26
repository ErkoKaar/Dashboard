"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import type { NbaRecapClip } from "@/lib/queries/useNba";

// Motion Stationi recap mängib dashboardi sees, mitte uuel vahelehel. Üks aken kogu NBA vaate kohta:
// mängude nimekiri ja parimad sooritused avavad selle useRecapPlayer() kaudu.

type OpenRecap = (clip: NbaRecapClip) => void;

const RecapPlayerContext = createContext<OpenRecap | null>(null);

export function useRecapPlayer(): OpenRecap {
  const open = useContext(RecapPlayerContext);
  if (!open) throw new Error("useRecapPlayer vajab RecapPlayerProvider'it");
  return open;
}

export function RecapPlayerProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // clip jääb alles ka pärast sulgemist (väljumisanimatsiooni ajaks); playing eemaldab iframe'i,
  // nii et video peatub kohe, kui aken sulgub.
  const [clip, setClip] = useState<NbaRecapClip | null>(null);
  const [playing, setPlaying] = useState(false);
  const titleId = useId();

  const open = useCallback((next: NbaRecapClip) => {
    setClip(next);
    setPlaying(true);
  }, []);

  // showModal pärast renderdust, et uus sisu oleks juba dialoogis. Sulgemisel taastab brauser
  // fookuse elemendile, millelt aken avati (pisipilt või tulemusrida).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (playing && dialog && !dialog.open) dialog.showModal();
  }, [playing, clip]);

  function close() {
    dialogRef.current?.close();
  }

  return (
    <RecapPlayerContext.Provider value={open}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => setPlaying(false)}
        // Sisu täidab akna, seega dialoog ise saab klõpsu ainult taustalt.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="recap-dialog glass w-[min(56rem,calc(100vw-2rem))] max-w-none rounded-2xl border-0 p-0 text-foreground"
      >
        {clip && (
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="font-display text-xl font-semibold leading-tight tracking-[-0.02em] [font-stretch:85%] sm:text-2xl"
                >
                  {clip.title}
                </h2>
                {clip.headline && <p className="mt-1 text-sm text-muted">{clip.headline}</p>}
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Sulge video"
                className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-white/[0.06] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[rgb(5_9_12)] ring-1 ring-white/10">
              {playing && (
                <iframe
                  // nocookie: YouTube ei pane küpsiseid enne, kui video käima läheb. autoplay on lubatud,
                  // sest aken avati klõpsuga. Referrer on YouTube'i embed'ile kohustuslik.
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(clip.videoId)}?autoplay=1&rel=0&playsinline=1`}
                  title={`Video: ${clip.title}`}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="absolute inset-0 h-full w-full"
                />
              )}
            </div>

            <a
              href={`https://www.youtube.com/watch?v=${encodeURIComponent(clip.videoId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 self-start rounded text-xs text-muted transition-colors duration-200 hover:text-accent-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Ava YouTube&apos;is
            </a>
          </div>
        )}
      </dialog>
    </RecapPlayerContext.Provider>
  );
}

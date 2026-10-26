"use client";

import { ReactNode, useState } from "react";
import { Lock, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { Basketball } from "@/components/ui/icons/Basketball";
import {
  DELFI_BASKETBALL_URL,
  DelfiArticle,
  delfiImageUrl,
  useDelfiBasketball,
} from "@/lib/queries/useDelfiBasketball";

const TALLINN = "Europe/Tallinn";

// Tulevikuaeg (kella nihe) loetakse samuti "äsja".
function formatAge(iso: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60000);
  if (minutes < 1) return "äsja";
  if (minutes < 60) return `${minutes} min tagasi`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h tagasi`;
  return new Date(iso).toLocaleDateString("et-EE", { day: "numeric", month: "short", timeZone: TALLINN });
}

function formatFullTime(iso: string): string {
  return new Date(iso).toLocaleString("et-EE", { dateStyle: "long", timeStyle: "short", timeZone: TALLINN });
}

function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("et-EE", { hour: "2-digit", minute: "2-digit" });
}

function ArticleAge({ iso, now, className = "" }: { iso: string; now: number; className?: string }) {
  return (
    <time dateTime={iso} title={formatFullTime(iso)} className={`tabular-nums text-muted ${className}`}>
      {formatAge(iso, now)}
    </time>
  );
}

function ArticleMeta({ article }: { article: DelfiArticle }) {
  if (!article.tag && !article.category && !article.paywall) return null;

  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
      {article.tag && (
        <span className="rounded-full border border-white/15 px-2 py-px text-[11px] font-medium text-foreground/80">
          {article.tag}
        </span>
      )}
      {article.category && <span className="text-accent-bright">{article.category}</span>}
      {article.paywall && (
        <span className="inline-flex items-center text-warning" title="Tasuline lugu">
          <Lock className="h-3 w-3" aria-hidden />
          <span className="sr-only">Tasuline lugu</span>
        </span>
      )}
    </span>
  );
}

function LeadStory({ article, now }: { article: DelfiArticle; now: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageId = imageFailed ? null : article.imageId;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/lead flex flex-col gap-4 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-bright"
    >
      {imageId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={delfiImageUrl(imageId, 768)}
          srcSet={`${delfiImageUrl(imageId, 768)} 768w, ${delfiImageUrl(imageId, 1536)} 1536w`}
          sizes="(min-width: 768px) 40vw, 100vw"
          alt=""
          onError={() => setImageFailed(true)}
          className="aspect-video w-full rounded-xl bg-white/[0.04] object-cover ring-1 ring-white/10"
        />
      )}
      <span className="flex flex-col gap-3">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ArticleAge iso={article.publishedAt} now={now} className="text-xs" />
          <ArticleMeta article={article} />
        </span>
        <span className="text-balance font-display text-2xl font-semibold leading-[1.05] tracking-[-0.025em] text-foreground transition-colors duration-200 [font-stretch:92%] group-hover/lead:text-accent-bright sm:text-3xl">
          {article.title}
        </span>
      </span>
    </a>
  );
}

const THUMBNAIL_SIZE = "aspect-video w-24 shrink-0 rounded-lg sm:w-28";

// Pildita või katkise pildiga uudis saab sama suure varuploki, et read jääksid joondatuks.
function Thumbnail({ imageId }: { imageId: string | null }) {
  const [failed, setFailed] = useState(false);

  if (!imageId || failed) {
    return (
      <span
        className={`${THUMBNAIL_SIZE} flex items-center justify-center bg-white/[0.04] text-muted/50 ring-1 ring-white/10`}
        aria-hidden
      >
        <Basketball className="h-5 w-5" />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={delfiImageUrl(imageId, 224)}
      srcSet={`${delfiImageUrl(imageId, 224)} 224w, ${delfiImageUrl(imageId, 448)} 448w`}
      sizes="(min-width: 640px) 112px, 96px"
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${THUMBNAIL_SIZE} bg-white/[0.04] object-cover ring-1 ring-white/10`}
    />
  );
}

function ArticleRow({ article, now }: { article: DelfiArticle; now: number }) {
  return (
    <li className="border-t border-white/[0.06] first:border-t-0">
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group/row flex items-start gap-4 rounded-lg py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
      >
        <Thumbnail imageId={article.imageId} />
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[15px] leading-snug text-foreground/90 transition-colors duration-200 group-hover/row:text-accent-bright">
            {article.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <ArticleAge iso={article.publishedAt} now={now} />
            <ArticleMeta article={article} />
          </span>
        </span>
      </a>
    </li>
  );
}

function DelfiSkeleton() {
  return (
    <div className="grid flex-1 gap-6 md:grid-cols-12 md:gap-8" aria-hidden>
      <div className="flex flex-col gap-4 md:col-span-5">
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-2/3" />
      </div>
      <div className="flex flex-col gap-5 md:col-span-7 md:pl-8">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-start gap-4">
            <Skeleton className={`${THUMBNAIL_SIZE} rounded-lg`} />
            <div className="flex flex-1 flex-col gap-2 pt-0.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DelfiBasketballWidget() {
  const { data, isPending, isError, isFetching, refetch, dataUpdatedAt } = useDelfiBasketball();
  const now = Date.now();

  let body: ReactNode;
  if (data && data.length > 0) {
    const [lead, ...rest] = data;
    body = (
      <div className="grid flex-1 gap-6 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-5">
          {/* key: uus pealuugu alustab puhtalt, ka siis kui eelmise pilt ei laadinud. */}
          <LeadStory key={lead.id} article={lead} now={now} />
        </div>
        {rest.length > 0 && (
          <ol className="md:col-span-7 md:border-l md:border-white/[0.06] md:pl-8">
            {rest.map((article) => (
              <ArticleRow key={article.id} article={article} now={now} />
            ))}
          </ol>
        )}
      </div>
    );
  } else if (data) {
    body = <p className="flex flex-1 items-center text-sm text-muted">Korvpalli rubriigis pole praegu uudiseid.</p>;
  } else if (isPending) {
    body = <DelfiSkeleton />;
  } else {
    body = (
      <div className="flex flex-1 flex-col items-start justify-center gap-4">
        <div>
          <p className="text-sm text-foreground">Uudiseid ei saanud laadida.</p>
          <p className="mt-1 text-xs text-muted">Delfi liides võis muutuda või on ajutiselt maas.</p>
        </div>
        <Button variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RotateCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
          Proovi uuesti
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <WidgetTitle icon={Basketball} href={DELFI_BASKETBALL_URL}>
          Delfi korvpall
        </WidgetTitle>
        {data && dataUpdatedAt > 0 && (
          // Taustal värskendamise viga: vanad uudised jäävad näha, aga seis on kirjas.
          <p className={`text-xs ${isError ? "text-warning" : "text-muted"}`}>
            {isError ? "Uuendamine ebaõnnestus, seis kell" : "Uuendatud"} {formatClock(dataUpdatedAt)}
          </p>
        )}
      </div>
      {body}
    </Card>
  );
}

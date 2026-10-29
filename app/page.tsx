"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { FolderTree, ListChecks, LogOut, StickyNote, User } from "lucide-react";
import { ClockWidget } from "@/components/widgets/ClockWidget";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";
import { LoginForm } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/Button";
import { SideMenu, SideMenuItem } from "@/components/ui/SideMenu";
import { useAuth } from "@/providers/AuthProvider";
import { useCalendarEvents } from "@/lib/queries/useCalendarEvents";
import { DashboardContext, WIDGET_REGISTRY } from "@/lib/widgets";
import { getGreeting } from "@/lib/date";
import { IS_DEMO } from "@/lib/demo/mode";
import profilePhoto from "@/app/images/CVpilt.jpeg";

const CONTEXTS: SideMenuItem<DashboardContext>[] = [
  { id: "personal", label: "Personal", icon: User },
  { id: "taskmanager", label: "Taskmanager", icon: ListChecks },
  { id: "notes", label: "Quick Notes", icon: StickyNote },
  { id: "files", label: "File system", icon: FolderTree },
  { id: "delfi", label: "Delfi korvpall", logo: "/leagues/delfi-sport.png" },
  { id: "nba", label: "NBA", logo: "/leagues/nba.png" },
  { id: "euroleague", label: "EuroLeague", logo: "/leagues/euroleague.png" },
  { id: "estlat", label: "Est-Lat Liiga", logo: "/leagues/estlat.png" },
  { id: "europecup", label: "Europe Cup", logo: "/leagues/europecup.png" },
];

// Sõnad ilmuvad hägust teravaks. splitText kirjutab h1 sisu ümber, seega kutsuja annab
// key={greeting}: uus tervitus on uus element ja React ei pea ümberkirjutatud sisu uuendama.
// anime.js tuleb eraldi chunk'ina: kuni see saabub, on pealkiri peidus; laadimisvea korral kohe nähtav.
// animate=false: Personal vaatesse tagasi tulles on tervitus kohe paigas, sissetulek käib ainult esimesel avamisel.
function GreetingTitle({ text, animate }: { text: string; animate: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !animate) return;
    const mountedAt = performance.now();
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    el.style.opacity = "0";

    import("animejs")
      .then(({ animate, cubicBezier, splitText, stagger, utils }) => {
        if (cancelled) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const split = splitText(el, { words: true });
        utils.set(split.words, { opacity: 0 });
        el.style.opacity = "";
        // Algus 250 ms pärast mounti nagu muul päisel; kui moodul jõudis hiljem, alusta kohe.
        const start = Math.max(0, 250 - (performance.now() - mountedAt));
        const animation = reduced
          ? animate(split.words, { opacity: 1, duration: 200 })
          : animate(split.words, {
              opacity: [0, 1],
              filter: ["blur(12px)", "blur(0px)"],
              y: [12, 0],
              duration: 700,
              delay: stagger(60, { start }),
              ease: cubicBezier(0.23, 1, 0.32, 1),
            });
        cleanup = () => {
          animation.revert();
          split.revert();
        };
      })
      .catch(() => {
        if (!cancelled) el.style.opacity = "";
      });

    return () => {
      cancelled = true;
      cleanup?.();
      el.style.opacity = "";
    };
  }, [animate]);

  return (
    <h1
      ref={ref}
      className="text-balance font-display text-5xl font-semibold leading-[0.95] tracking-[-0.035em] text-foreground [font-stretch:92%] sm:text-7xl lg:text-8xl"
    >
      {text}
    </h1>
  );
}

function formatCountdown(target: Date, now: Date): string {
  const totalMinutes = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function DashboardPage() {
  const { taskSession, financeSession, loading, signOut } = useAuth();
  const { data: calendarEvents } = useCalendarEvents();

  const [dashboardContext, setDashboardContext] = useState<DashboardContext>("personal");
  // Tervitus on ainult Personal vaates. Pärast esimest vaatevahetust on sissetulek nähtud:
  // tagasi tulles ilmub see kohe, mitte uuesti hägust (vaateid vahetatakse sageli).
  const [introSeen, setIntroSeen] = useState(false);

  function selectContext(id: DashboardContext) {
    setIntroSeen(true);
    setDashboardContext(id);
  }

  // Laadi anime.js sisselogimise ajal ette, et tervitus ei peaks seda ootama.
  // Viga pole siin oluline: GreetingTitle näitab teksti ka ilma animatsioonita.
  useEffect(() => {
    import("animejs").catch(() => {});
  }, []);

  const visibleWidgets = WIDGET_REGISTRY.filter((w) => w.context === dashboardContext);

  if (loading) return null;
  if (!taskSession || !financeSession) return <LoginForm />;

  const greeting = getGreeting();
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const now = new Date();
  const nextEvent = (calendarEvents ?? [])
    .filter((e) => !e.allDay && e.time)
    .map((e) => ({ event: e, start: new Date(`${e.date}T${e.time}`) }))
    .filter((e) => e.start.getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  const eventSummary = nextEvent ? `${nextEvent.event.title} in ${formatCountdown(nextEvent.start, now)}.` : null;

  return (
    <main className="mx-auto max-w-[1600px] px-4 pb-16 pt-4 md:px-8 md:pt-8">
      <header className="mb-10 sm:mb-14">
        {/* Mobiilis: menüü + väljalogimine esimesel real, aeg/ilm teisel. */}
        <div className="flex flex-wrap items-center gap-3">
          <SideMenu items={CONTEXTS} active={dashboardContext} onSelect={selectContext} />

          {/* Lapsed on relative, et jääda .liquid-glass hägu-pseudoelemendi kohale. */}
          <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto">
            <div className="liquid-glass inline-flex h-10 items-center divide-x divide-white/15 rounded-full px-1 text-sm [&>*]:relative [&>*]:px-3">
              <ClockWidget />
              <p className="text-muted">{today}</p>
              <WeatherWidget />
            </div>
          </div>

          {IS_DEMO ? (
            // Demos väljalogimist pole; nupu kohal on viide koodile.
            <a
              href="https://github.com/ErkoKaar/Dashboard"
              className="ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-muted transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:ml-0"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              Demo · GitHub
            </a>
          ) : (
            <Button variant="ghost" onClick={() => signOut()} className="ml-auto h-10 shrink-0 !rounded-full sm:ml-0">
              <LogOut className="h-4 w-4" aria-hidden />
              Logi välja
            </Button>
          )}
        </div>

        {/* Pilt tervituse rea keskel; subtiiter teises veerus, et algaks tervitusega samast servast. */}
        {dashboardContext === "personal" && (
          <div className="mt-10 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 sm:mt-16 sm:gap-x-5">
            <Image
              src={profilePhoto}
              alt="Erko Kaar"
              width={112}
              height={112}
              priority
              className={`${introSeen ? "" : "animate-reveal "}h-14 w-14 rounded-full object-cover object-top shadow-[0_16px_32px_-16px_rgb(0_5_8/0.8)] ring-1 ring-white/15 sm:h-16 sm:w-16 lg:h-20 lg:w-20`}
            />
            <GreetingTitle key={greeting} text={`${greeting}, Erko.`} animate={!introSeen} />
            {eventSummary && (
              <p
                className={`${introSeen ? "" : "animate-reveal "}col-start-2 mt-4 max-w-[60ch] text-base text-foreground/75 sm:text-lg`}
                style={introSeen ? undefined : { animationDelay: "450ms" }}
              >
                {eventSummary}
              </p>
            )}
          </div>
        )}
      </header>

      {visibleWidgets.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center gap-1.5 rounded-2xl py-24 text-center">
          <p className="text-sm text-muted">Töövaade on veel tühi.</p>
          <p className="text-xs text-muted/60">Lisa siia oma töövidinad, kui need valmis on.</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {visibleWidgets.map(({ id, Component, colSpan }, i) => (
            <div
              key={id}
              className={`animate-rise-in ${colSpan}`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Component />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

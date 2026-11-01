"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileX } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Skeleton } from "@/components/ui/Skeleton";
import { FsNode, FsSaveStatus, useAutosaveFsFile, useFsNodes } from "@/lib/queries/useFileSystem";
import { useAuth } from "@/providers/AuthProvider";

// Faili dokumendivaade (File system -> "Ava dokument"): üks fail oma aadressil, lehekülje kujul nagu
// tekstitöötluses. Sisselogimine on sama mis dashboardil, sest failid on TaskManageri Supabase'is.
export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const { taskSession, financeSession, loading } = useAuth();

  if (loading) return null;
  if (!taskSession || !financeSession) return <LoginForm />;
  return <DocumentView id={id} />;
}

function DocumentView({ id }: { id: string }) {
  const { data: nodes, isLoading, error } = useFsNodes();
  const file = nodes?.find((node) => node.id === id && node.type === "file");

  if (file) return <DocumentEditor file={file} />;

  if (isLoading) {
    return (
      <DocumentShell title={null} status="idle">
        <div className="mx-auto w-full max-w-[816px]" aria-hidden>
          <Skeleton className="mb-4 h-10 w-full sm:mb-6" />
          <Skeleton className="h-[70vh] w-full rounded-sm" />
        </div>
      </DocumentShell>
    );
  }

  return (
    <DocumentShell title={null} status="idle">
      <div className="mx-auto flex max-w-[816px] flex-col items-start gap-4 pt-16">
        <FileX className="h-8 w-8 text-muted" aria-hidden />
        <div>
          <p className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground">
            {error ? "Faili ei saanud laadida" : "Faili ei leitud"}
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
            {error
              ? "Ühendus andmebaasiga katkes või aegus. Värskenda lehte."
              : "Fail võib olla kustutatud. Ava see uuesti dashboardi File systemist."}
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-foreground transition-colors duration-200 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
        >
          Ava dashboard
        </Link>
      </div>
    </DocumentShell>
  );
}

function DocumentEditor({ file }: { file: FsNode }) {
  const { status, error, scheduleSave, editorKey } = useAutosaveFsFile(file);

  // Brauseri tabi pealkiri on faili nimi, et mitu avatud dokumenti oleksid eristatavad.
  useEffect(() => {
    const previous = document.title;
    document.title = file.name;
    return () => {
      document.title = previous;
    };
  }, [file.name]);

  return (
    <DocumentShell title={file.name} status={status} saveFailed={Boolean(error)}>
      <RichTextEditor
        key={editorKey}
        variant="page"
        content={file.content}
        onChange={scheduleSave}
        placeholder="Kirjuta siia..."
      />
    </DocumentShell>
  );
}

const STATUS_TEXT: Record<FsSaveStatus, string> = { idle: "", saving: "Salvestamine...", saved: "Salvestatud" };

function DocumentShell({
  title,
  status,
  saveFailed = false,
  children,
}: {
  title: string | null;
  status: FsSaveStatus;
  saveFailed?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-3 px-4 sm:px-6">
          <Link
            href="/"
            aria-label="Tagasi dashboardile"
            className="-ml-2 flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-sm text-muted transition-colors duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <span className="h-5 w-px shrink-0 bg-white/10" aria-hidden />
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
            {title}
          </h1>
          <p
            role="status"
            className={`shrink-0 text-xs ${saveFailed && status !== "saving" ? "text-destructive" : "text-muted"}`}
          >
            {saveFailed && status !== "saving" ? "Salvestamine ebaõnnestus" : STATUS_TEXT[status]}
          </p>
        </div>
      </header>
      <main className="px-4 pb-24 pt-4 sm:px-6 sm:pt-6">{children}</main>
    </div>
  );
}

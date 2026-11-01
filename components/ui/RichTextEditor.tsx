"use client";

import { ComponentType, SVGProps } from "react";
import { Bold, Heading1, Heading2, List, ListOrdered, Underline } from "lucide-react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Vanad tavatekstiga sisud (enne rikkaliku editori lisamist) teisendatakse lõikudeks,
// muidu kaotaks Tiptap reavahetused ära. HTML-sisu läheb muutmata edasi.
function toEditorContent(content: string | null | undefined) {
  const text = content ?? "";
  if (/^\s*</.test(text)) return text;
  return text
    .split("\n")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

interface ToolbarButtonProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  active: boolean;
  onClick: () => void;
}

function ToolbarButton({ icon: Icon, label, active, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`cursor-pointer rounded-md p-1.5 transition-colors duration-200 ${
        active ? "bg-accent/20 text-accent" : "text-muted hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

// panel: kaardi sees (File system, Quick Notes). page: dokumendivaade (app/doc/[id]), kus tekst on
// heledal lehel ja tööriistariba jääb kerimisel lehe kohale paigale.
type EditorVariant = "panel" | "page";

const TOOLBAR_CLASS: Record<EditorVariant, string> = {
  panel: "mb-2 flex items-center gap-0.5 rounded-lg border border-border/50 bg-surface/40 p-1",
  page: "sticky top-16 z-10 mx-auto mb-4 flex w-full max-w-[816px] flex-wrap items-center gap-0.5 rounded-lg border border-white/10 bg-surface/90 p-1 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)] backdrop-blur sm:mb-6",
};

const SURFACE_CLASS: Record<EditorVariant, string> = {
  panel:
    "flex-1 rounded-lg border border-white/10 bg-background/40 px-4 py-3 text-base leading-relaxed text-foreground transition-colors duration-200 focus-within:border-accent",
  page: "rich-page mx-auto w-full max-w-[816px] rounded-sm px-5 py-8 text-[17px] leading-[1.7] sm:min-h-[1056px] sm:px-16 sm:py-16 md:px-24 md:py-20",
};

interface RichTextEditorProps {
  /** Algsisu (HTML või vana tavatekst). Loetakse ainult editori loomisel. */
  content: string | null | undefined;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  variant?: EditorVariant;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "",
  className = "",
  variant = "panel",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2] } }), Placeholder.configure({ placeholder })],
    content: toEditorContent(content),
    // Next.js SSR: editor luuakse alles kliendis, muidu tuleb hydration mismatch.
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const marks = useEditorState({
    editor,
    selector: ({ editor }) => ({
      h1: editor?.isActive("heading", { level: 1 }) ?? false,
      h2: editor?.isActive("heading", { level: 2 }) ?? false,
      bold: editor?.isActive("bold") ?? false,
      underline: editor?.isActive("underline") ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
      orderedList: editor?.isActive("orderedList") ?? false,
    }),
  });

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      {editor && marks && (
        <div className={TOOLBAR_CLASS[variant]}>
          <ToolbarButton
            icon={Heading1}
            label="Pealkiri 1"
            active={marks.h1}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          />
          <ToolbarButton
            icon={Heading2}
            label="Pealkiri 2"
            active={marks.h2}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          <ToolbarButton
            icon={Bold}
            label="Rasvane (⌘B)"
            active={marks.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            icon={Underline}
            label="Allajoonitud (⌘U)"
            active={marks.underline}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          {/* Ka klaviatuurilt: "- " või "1. " rea alguses, Tab teeb alamloendi. */}
          <ToolbarButton
            icon={List}
            label="Täpploend"
            active={marks.bulletList}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            icon={ListOrdered}
            label="Nummerdatud loend"
            active={marks.orderedList}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
        </div>
      )}

      <div
        onClick={() => editor?.commands.focus()}
        className={`rich-editor cursor-text ${SURFACE_CLASS[variant]}`}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

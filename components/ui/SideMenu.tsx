"use client";

import { ComponentType, SVGProps, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

export type SideMenuItem<T extends string> = {
  id: T;
  label: string;
} & (
  | { icon: ComponentType<SVGProps<SVGSVGElement>>; logo?: undefined }
  /** Värviline logo ikooni asemel (liigad, public/leagues/): jääb oma värvi, mitteaktiivsena tuhmim. */
  | { logo: string; icon?: undefined }
);

interface SideMenuProps<T extends string> {
  items: SideMenuItem<T>[];
  active: T;
  onSelect: (id: T) => void;
}

// Natiivne <dialog> showModal'iga: fookus jääb paneeli sisse, Esc sulgeb ja taust on inert.
// Libisemine ja tausta tumenemine on CSS-is (.side-menu, globals.css).
export function SideMenu<T extends string>({ items, active, onSelect }: SideMenuProps<T>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const titleId = useId();
  const activeItem = items.find((item) => item.id === active);

  function open() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    setIsOpen(true);
    // showModal fokusseerib esimese nupu (sulge); aktiivne vaade on loogilisem alguspunkt.
    dialog.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={menuId}
        className="liquid-glass inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-full pl-3 pr-4 text-sm font-medium text-foreground transition-transform duration-200 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
      >
        {/* Nähtavad lapsed relative, et jääda .liquid-glass hägu-pseudoelemendi kohale (sr-only jääb absolute). */}
        <Menu className="relative h-4 w-4" aria-hidden />
        <span className="sr-only">Ava menüü, praegune vaade: </span>
        <span className="relative whitespace-nowrap">{activeItem?.label}</span>
      </button>

      <dialog
        ref={dialogRef}
        id={menuId}
        aria-labelledby={titleId}
        onClose={() => setIsOpen(false)}
        // Sisu täidab kogu paneeli, seega dialoog ise saab klõpsu ainult taustalt.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="side-menu glass inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-[min(20rem,calc(100vw-3rem))] max-w-none rounded-r-3xl border-0 p-0 text-foreground"
      >
        <div className="flex h-full flex-col overflow-y-auto px-3 pb-6 pt-4 md:pt-8">
          <div className="mb-6 flex items-center justify-between pl-3">
            <h2
              id={titleId}
              className="font-display text-2xl font-semibold tracking-[-0.03em] [font-stretch:92%]"
            >
              Vaated
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Sulge menüü"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-white/[0.06] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <nav aria-labelledby={titleId}>
            <ul className="flex flex-col gap-1">
              {items.map(({ id, label, icon: Icon, logo }) => {
                const isActive = id === active;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => {
                        onSelect(id);
                        close();
                      }}
                      className={`group flex w-full cursor-pointer items-center gap-3.5 rounded-xl px-3 py-3.5 text-left text-base font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-bright ${
                        isActive
                          ? "bg-white/[0.1] text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]"
                          : "text-muted hover:bg-white/[0.05] hover:text-foreground"
                      }`}
                    >
                      {/* Ühesuurune pesa: 28 px logo ja 20 px ikooni korral jäävad nimed samale joonele. */}
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden>
                        {logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={logo}
                            alt=""
                            width={28}
                            height={28}
                            className={`h-7 w-7 object-contain transition-opacity duration-200 ${
                              isActive ? "" : "opacity-75 group-hover:opacity-100"
                            }`}
                          />
                        ) : (
                          Icon && <Icon className={`h-5 w-5 ${isActive ? "text-accent-bright" : ""}`} />
                        )}
                      </span>
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}

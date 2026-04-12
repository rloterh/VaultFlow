"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ActionMenuItem {
  label: string;
  description?: string;
  href?: string;
  external?: boolean;
  icon?: LucideIcon;
  onSelect?: () => void | Promise<void>;
  disabled?: boolean;
  tone?: "default" | "danger";
  checked?: boolean;
}

export interface ActionMenuSection {
  label?: string;
  items: ActionMenuItem[];
}

interface ActionMenuProps {
  sections: ActionMenuSection[];
  align?: "left" | "right";
  widthClassName?: string;
  header?: ReactNode;
  renderTrigger?: (open: boolean) => ReactNode;
  triggerLabel?: string;
  triggerClassName?: string;
  shortcut?: {
    key: string;
    commandOrControl?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  };
}

function MenuButtonContent({
  item,
  onSelect,
}: {
  item: ActionMenuItem;
  onSelect: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      disabled={item.disabled}
      onClick={async () => {
        await item.onSelect?.();
        onSelect();
      }}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        item.tone === "danger"
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
      )}
    >
      <span className="mt-0.5 flex h-5 w-5 items-center justify-center">
        {item.checked ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : Icon ? (
          <Icon className="h-4 w-4" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{item.label}</span>
        {item.description && (
          <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
            {item.description}
          </span>
        )}
      </span>
    </button>
  );
}

export function ActionMenu({
  sections,
  align = "right",
  widthClassName = "w-64",
  header,
  renderTrigger,
  triggerLabel = "Open actions",
  triggerClassName,
  shortcut,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonId = useId();

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (!shortcut || isEditableTarget(event.target)) {
        return;
      }

      const matchesKey = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const matchesModifier = shortcut.commandOrControl
        ? event.metaKey || event.ctrlKey
        : !event.metaKey && !event.ctrlKey;

      if (
        matchesKey &&
        matchesModifier &&
        (!!shortcut.shiftKey === event.shiftKey) &&
        (!!shortcut.altKey === event.altKey)
      ) {
        event.preventDefault();
        setOpen(true);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcut]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        id={buttonId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center justify-center rounded-lg border border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-700",
          renderTrigger
            ? "min-h-10 px-2"
            : "h-9 w-9 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200",
          triggerClassName
        )}
      >
        {renderTrigger ? renderTrigger(open) : <MoreHorizontal className="h-4 w-4" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            role="menu"
            aria-labelledby={buttonId}
            className={cn(
              "absolute top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-2 shadow-xl dark:border-neutral-800 dark:bg-neutral-900",
              widthClassName,
              align === "right" ? "right-0" : "left-0"
            )}
          >
            {header && (
              <div className="border-b border-neutral-100 px-2 pb-3 dark:border-neutral-800">
                {header}
              </div>
            )}

            <div className={cn("space-y-1", header && "pt-2")}>
              {sections.map((section, sectionIndex) => (
                <div
                  key={`${section.label ?? "section"}-${sectionIndex}`}
                  className={cn(sectionIndex > 0 && "border-t border-neutral-100 pt-2 dark:border-neutral-800")}
                >
                  {section.label && (
                    <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      {section.label}
                    </p>
                  )}
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const key = `${item.label}-${item.href ?? "action"}`;

                      if (item.href) {
                        const content = (
                          <span
                            className={cn(
                              "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
                              item.tone === "danger"
                                ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                                : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                            )}
                          >
                            <span className="mt-0.5 flex h-5 w-5 items-center justify-center">
                              {item.checked ? (
                                <Check className="h-4 w-4 text-emerald-500" />
                              ) : item.icon ? (
                                <item.icon className="h-4 w-4" />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">{item.label}</span>
                              {item.description && (
                                <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                                  {item.description}
                                </span>
                              )}
                            </span>
                          </span>
                        );

                        return item.external ? (
                          <a
                            key={key}
                            href={item.href}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setOpen(false)}
                          >
                            {content}
                          </a>
                        ) : (
                          <Link key={key} href={item.href} onClick={() => setOpen(false)}>
                            {content}
                          </Link>
                        );
                      }

                      return (
                        <MenuButtonContent
                          key={key}
                          item={item}
                          onSelect={() => setOpen(false)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

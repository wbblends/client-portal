"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// Safe portal target: parents never open the popover during SSR (open starts
// false and only flips inside a click handler), so document is always defined
// by the time we return the portal JSX. Guard anyway in case a future caller
// mounts in an open state.
const canPortal = () => typeof document !== "undefined";

/**
 * Anchored inline popover. Renders into `document.body` via a portal, so it
 * escapes table layout and z-index stacks. Position is computed from the
 * caller-provided anchor rect (typically `event.currentTarget.getBoundingClientRect()`
 * captured when a row is clicked).
 *
 * Closes on outside-click, Escape, or window scroll/resize — scroll-close keeps
 * the floating card from drifting away from a row when the user scrolls the
 * underlying table. Re-opening is the natural follow-up if they didn't mean to
 * dismiss.
 *
 * Designed to layer on top of any clickable trigger; the trigger owns its own
 * `onClick`, captures the rect, and toggles `open`.
 */
export function Popover({
  open,
  anchorRect,
  onClose,
  width = 440,
  side = "bottom",
  children,
  className,
}: {
  open: boolean;
  anchorRect: DOMRect | null;
  onClose: () => void;
  width?: number;
  /** Preferred side relative to the anchor. Falls back if it would overflow. */
  side?: "bottom" | "top";
  children: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position the panel after layout so we can measure its actual height.
  useLayoutEffect(() => {
    if (!open || !anchorRect || !panelRef.current) return;
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelHeight = panelRef.current.offsetHeight;
    const panelWidth = Math.min(width, vw - margin * 2);

    let top: number;
    if (side === "bottom") {
      const below = anchorRect.bottom + 8;
      const wouldOverflowBelow = below + panelHeight > vh - margin;
      top = wouldOverflowBelow
        ? Math.max(margin, anchorRect.top - panelHeight - 8)
        : below;
    } else {
      const above = anchorRect.top - panelHeight - 8;
      const wouldOverflowAbove = above < margin;
      top = wouldOverflowAbove ? anchorRect.bottom + 8 : above;
    }

    let left = anchorRect.left;
    if (left + panelWidth > vw - margin) {
      left = Math.max(margin, vw - margin - panelWidth);
    }
    if (left < margin) left = margin;

    setPos({ top, left });
  }, [open, anchorRect, side, width]);

  // Outside-click + Escape + scroll/resize close.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (panelRef.current?.contains(e.target as Node)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onScrollOrResize() {
      onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, onClose]);

  if (!open || !anchorRect || !canPortal()) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        width: Math.min(width, typeof window !== "undefined" ? window.innerWidth - 24 : width),
        // Hide the panel until measured to avoid a flash at (0,0) on first render.
        visibility: pos ? "visible" : "hidden",
      }}
      className={cn(
        "z-50 rounded-xl border border-border bg-card shadow-[var(--shadow-popover)]",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

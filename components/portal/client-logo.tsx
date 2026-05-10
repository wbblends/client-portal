"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Client-side logo upload for a customer. Stored as a data URL in
 * localStorage keyed by customer id so the badge in the sidebar and the banner
 * on the dashboard stay in sync without a server round-trip — appropriate for
 * this demo portal. When a real upload endpoint exists, swap the read/write
 * helpers below to hit it instead.
 */

const STORAGE_PREFIX = "wbb_client_logo_";
const CHANGE_EVENT = "wbb:client-logo";
const MAX_BYTES = 4 * 1024 * 1024;

function storageKey(customerId: string) {
  return STORAGE_PREFIX + customerId;
}

function readLogo(customerId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKey(customerId));
}

function writeLogo(customerId: string, dataUrl: string | null) {
  if (typeof window === "undefined") return;
  if (dataUrl == null) {
    window.localStorage.removeItem(storageKey(customerId));
  } else {
    window.localStorage.setItem(storageKey(customerId), dataUrl);
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { customerId } }));
}

function useClientLogo(customerId: string) {
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    setLogo(readLogo(customerId));
    function onChange(ev: Event) {
      const detail = (ev as CustomEvent<{ customerId: string }>).detail;
      if (!detail || detail.customerId === customerId) {
        setLogo(readLogo(customerId));
      }
    }
    function onStorage(ev: StorageEvent) {
      if (ev.key === storageKey(customerId)) setLogo(ev.newValue);
    }
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [customerId]);

  return logo;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function validate(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Please choose an image file.";
  if (file.size > MAX_BYTES) return "Image must be 4 MB or smaller.";
  return null;
}

export function ClientLogoBadge({
  customerId,
  companyName,
}: {
  customerId: string;
  companyName: string;
}) {
  const logo = useClientLogo(customerId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const problem = validate(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    try {
      writeLogo(customerId, await readFileAsDataUrl(file));
    } catch {
      setError("Could not read that file.");
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          logo ? "bg-card" : "bg-primary-soft text-primary",
        )}
        title={logo ? "Change client logo" : "Upload client logo"}
        aria-label={logo ? "Change client logo" : "Upload client logo"}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={`${companyName} logo`} className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-semibold">{initialsOf(companyName)}</span>
        )}
        <span className="pointer-events-none absolute inset-0 grid place-items-center bg-foreground/55 text-white opacity-0 transition group-hover:opacity-100">
          <Camera className="h-4 w-4" />
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{companyName}</div>
        <div className="truncate text-xs text-muted">
          {error ? (
            <span className="text-danger">{error}</span>
          ) : logo ? (
            "Click logo to change"
          ) : (
            "Click to upload logo"
          )}
        </div>
      </div>
      {logo && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            writeLogo(customerId, null);
          }}
          className="rounded-md p-1.5 text-muted hover:bg-accent hover:text-foreground transition-colors"
          title="Remove logo"
          aria-label="Remove logo"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={ev => {
          handleFile(ev.target.files?.[0]);
          ev.target.value = "";
        }}
      />
    </div>
  );
}

export function ClientLogoBanner({
  customerId,
  companyName,
}: {
  customerId: string;
  companyName: string;
}) {
  const logo = useClientLogo(customerId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const problem = validate(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    try {
      writeLogo(customerId, await readFileAsDataUrl(file));
    } catch {
      setError("Could not read that file.");
    }
  }

  function openPicker() {
    inputRef.current?.click();
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      {logo ? (
        <div className="relative">
          <div className="grid place-items-center gradient-mesh px-6 py-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt={`${companyName} logo`}
              className="max-h-[140px] max-w-full object-contain"
            />
          </div>
          <div className="absolute right-3 top-3 flex gap-1.5">
            <button
              type="button"
              onClick={openPicker}
              className="inline-flex items-center gap-1 rounded-md bg-card/90 px-2.5 py-1.5 text-xs font-medium text-foreground-soft ring-1 ring-border backdrop-blur transition-colors hover:bg-card hover:text-foreground"
            >
              <Upload className="h-3.5 w-3.5" />
              Replace
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                writeLogo(customerId, null);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-card/90 px-2.5 py-1.5 text-xs font-medium text-foreground-soft ring-1 ring-border backdrop-blur transition-colors hover:bg-card hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          className="flex w-full flex-col items-center justify-center gap-2 px-6 py-10 text-center transition-colors hover:bg-accent/40 focus:outline-none focus-visible:bg-accent/40"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
            <Upload className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium text-foreground">
            Upload {companyName}&rsquo;s logo
          </span>
          <span className="text-xs text-muted">
            PNG, JPG, or SVG up to 4 MB. Shown across your portal.
          </span>
        </button>
      )}
      {error && (
        <div className="border-t border-border bg-danger-soft px-4 py-2 text-xs text-danger">
          {error}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={ev => {
          handleFile(ev.target.files?.[0]);
          ev.target.value = "";
        }}
      />
    </div>
  );
}

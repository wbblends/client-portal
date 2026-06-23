"use client";

/**
 * Tiny, dependency-free markdown renderer for trusted (our-own-API) content.
 *
 * Supports the subset the Brand Researcher emits: ##/###/#### headings,
 * **bold**, *italic*, `code`, [links](url), `-`/`*` bullet lists, `---` rules,
 * and paragraphs. We build real React nodes (no dangerouslySetInnerHTML) and
 * only allow http(s)/mailto hrefs, so model output can't smuggle markup in.
 */
import { Fragment, type ReactNode } from "react";

const INLINE =
  /(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+?)\*\*)|(`([^`]+)`)|(\*([^*]+?)\*)/g;

function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^(https?:\/\/|mailto:)/i.test(u)) return u;
  return null;
}

function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  let i = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[1]) {
      const href = safeHref(m[3]);
      out.push(
        href ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
          >
            {m[2]}
          </a>
        ) : (
          <span key={key}>{m[2]}</span>
        ),
      );
    } else if (m[4]) {
      out.push(
        <strong key={key} className="font-semibold text-foreground">
          {m[5]}
        </strong>,
      );
    } else if (m[6]) {
      out.push(
        <code
          key={key}
          className="rounded bg-accent px-1 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {m[7]}
        </code>,
      );
    } else if (m[8]) {
      out.push(
        <em key={key} className="italic">
          {m[9]}
        </em>,
      );
    }
    last = INLINE.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "h2" | "h3" | "h4" | "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "hr" };

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "p", text: para.join(" ").trim() });
      para = [];
    }
  };
  const flushList = () => {
    if (list && list.length) blocks.push({ kind: "ul", items: list });
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed === "") {
      flushPara();
      flushList();
      continue;
    }
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      flushPara();
      flushList();
      blocks.push({ kind: "hr" });
      continue;
    }
    const h = /^(#{2,4})\s+(.*)$/.exec(trimmed);
    if (h) {
      flushPara();
      flushList();
      const kind = (["h2", "h3", "h4"] as const)[h[1].length - 2];
      blocks.push({ kind, text: h[2].trim() });
      continue;
    }
    const li = /^[-*]\s+(.*)$/.exec(trimmed);
    if (li) {
      flushPara();
      if (!list) list = [];
      list.push(li[1].trim());
      continue;
    }
    // plain paragraph text
    flushList();
    para.push(trimmed);
  }
  flushPara();
  flushList();
  return blocks;
}

export function Markdown({ children }: { children: string }) {
  const blocks = parseBlocks(children || "");
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-foreground-soft">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "h2":
            return (
              <h2
                key={i}
                className="mt-6 border-b border-border pb-1.5 font-display text-xl tracking-tight text-foreground first:mt-0"
              >
                {renderInline(b.text, `h2-${i}`)}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={i}
                className="mt-4 text-sm font-bold uppercase tracking-wide text-primary"
              >
                {renderInline(b.text, `h3-${i}`)}
              </h3>
            );
          case "h4":
            return (
              <h4 key={i} className="mt-3 font-semibold text-foreground">
                {renderInline(b.text, `h4-${i}`)}
              </h4>
            );
          case "ul":
            return (
              <ul key={i} className="space-y-1.5 pl-1">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50"
                    />
                    <span className="min-w-0 flex-1">
                      {renderInline(it, `ul-${i}-${j}`)}
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "hr":
            return <hr key={i} className="border-border" />;
          case "p":
          default:
            return (
              <p key={i}>
                <Fragment>{renderInline(b.text, `p-${i}`)}</Fragment>
              </p>
            );
        }
      })}
    </div>
  );
}

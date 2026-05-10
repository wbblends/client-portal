import { randomBytes } from "node:crypto";
import { appendJsonLine, readJsonLines } from "./persistence";

/**
 * Append-only audit log of admin and auth events. Backed by a JSON-lines file
 * (one event per line) so writes are cheap and crash-safe. Reads scan the
 * whole file — fine at demo scale, swap for a DB once volumes warrant it.
 */

const FILE = "audit.log";

export type AuditAction =
  // Admin user-management actions
  | "user.created"
  | "user.profile_updated"
  | "user.role_changed"
  | "user.permissions_changed"
  | "user.permissions_reset"
  | "user.status_changed"
  | "user.password_reset"
  | "user.avatar_changed"
  | "user.avatar_removed"
  | "user.deleted"
  | "user.bulk_status_changed"
  | "user.bulk_permissions_reset"
  | "user.bulk_deleted"
  // Auth + 2FA
  | "auth.login_success"
  | "auth.login_failure"
  | "auth.logout"
  | "auth.password_reset_link_created"
  | "auth.password_reset_completed"
  | "auth.2fa_enabled"
  | "auth.2fa_disabled"
  | "auth.2fa_recovery_used"
  // Self-service
  | "account.profile_updated"
  | "account.password_changed"
  | "account.avatar_changed";

export type AuditEvent = {
  id: string;
  ts: string;
  action: AuditAction;
  /** The session user who performed the action. May be null for anonymous events (e.g. login failure). */
  actorId: string | null;
  actorUsername: string | null;
  /** The user the action was performed on, if any. */
  targetId?: string;
  targetUsername?: string;
  /** Free-form details — e.g. `{ from: "user", to: "admin" }` for role changes. */
  details?: Record<string, unknown>;
};

export type LogInput = Omit<AuditEvent, "id" | "ts">;

export function logEvent(input: LogInput): void {
  const event: AuditEvent = {
    id: "ev_" + randomBytes(6).toString("hex"),
    ts: new Date().toISOString(),
    ...input,
  };
  appendJsonLine(FILE, event);
}

export type AuditQuery = {
  /** Filter to events targeting a specific user. */
  targetId?: string;
  /** Filter to events performed by a specific actor. */
  actorId?: string;
  /** Filter to a specific action type. */
  action?: AuditAction;
  /** Substring match against username/action. Case-insensitive. */
  search?: string;
  /** Cap the number of events returned (most recent first). */
  limit?: number;
};

export function listEvents(query: AuditQuery = {}): AuditEvent[] {
  const all = readJsonLines<AuditEvent>(FILE);
  let filtered = all;
  if (query.targetId) {
    filtered = filtered.filter(e => e.targetId === query.targetId);
  }
  if (query.actorId) {
    filtered = filtered.filter(e => e.actorId === query.actorId);
  }
  if (query.action) {
    filtered = filtered.filter(e => e.action === query.action);
  }
  if (query.search) {
    const q = query.search.toLowerCase();
    filtered = filtered.filter(
      e =>
        (e.actorUsername ?? "").toLowerCase().includes(q) ||
        (e.targetUsername ?? "").toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q),
    );
  }
  // newest first
  filtered.reverse();
  if (query.limit && query.limit > 0) {
    filtered = filtered.slice(0, query.limit);
  }
  return filtered;
}

/** Human-readable summary suitable for a row in the UI. */
export function describeEvent(e: AuditEvent): string {
  const actor = e.actorUsername ? `@${e.actorUsername}` : "system";
  const target = e.targetUsername ? `@${e.targetUsername}` : e.targetId ? "(unknown user)" : "";
  switch (e.action) {
    case "user.created":
      return `${actor} created ${target}`;
    case "user.profile_updated":
      return `${actor} updated profile of ${target}`;
    case "user.role_changed":
      return `${actor} changed ${target}'s role from ${detail(e, "from")} to ${detail(e, "to")}`;
    case "user.permissions_changed":
      return `${actor} updated ${target}'s permissions`;
    case "user.permissions_reset":
      return `${actor} reset ${target}'s permissions to defaults`;
    case "user.status_changed":
      return `${actor} ${detail(e, "to") === "disabled" ? "disabled" : "reactivated"} ${target}`;
    case "user.password_reset":
      return `${actor} reset ${target}'s password`;
    case "user.avatar_changed":
      return `${actor} changed ${target}'s profile photo`;
    case "user.avatar_removed":
      return `${actor} removed ${target}'s profile photo`;
    case "user.deleted":
      return `${actor} deleted ${target}`;
    case "user.bulk_status_changed":
      return `${actor} ${detail(e, "to") === "disabled" ? "disabled" : "reactivated"} ${detail(e, "count")} users`;
    case "user.bulk_permissions_reset":
      return `${actor} reset permissions on ${detail(e, "count")} users`;
    case "user.bulk_deleted":
      return `${actor} deleted ${detail(e, "count")} users`;
    case "auth.login_success":
      return `${actor} signed in`;
    case "auth.login_failure":
      return `Failed login attempt for ${detail(e, "username") || "unknown user"}`;
    case "auth.logout":
      return `${actor} signed out`;
    case "auth.password_reset_link_created":
      return `${actor} created a password reset link for ${target}`;
    case "auth.password_reset_completed":
      return `${target} reset their password via reset link`;
    case "auth.2fa_enabled":
      return `${actor} enabled two-factor authentication`;
    case "auth.2fa_disabled":
      return `${actor} disabled two-factor authentication on ${target}`;
    case "auth.2fa_recovery_used":
      return `${actor} signed in with a 2FA recovery code`;
    case "account.profile_updated":
      return `${actor} updated their profile`;
    case "account.password_changed":
      return `${actor} changed their password`;
    case "account.avatar_changed":
      return `${actor} changed their profile photo`;
    default:
      return `${actor}: ${e.action}`;
  }
}

function detail(e: AuditEvent, key: string): string {
  const v = e.details?.[key];
  return v == null ? "" : String(v);
}

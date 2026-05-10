/**
 * OAuth 2.0 token acquisition + caching for Acumatica.
 *
 * Acumatica's identity server lives at `{baseUrl}/identity/connect/token`.
 * Supports `password` (Resource Owner) and `client_credentials` grants — the
 * portal will typically use `password` with a service account, since most
 * portal endpoints need to read data on behalf of a Customer record.
 *
 * Tokens are cached in-process and refreshed ~60s before expiry. This is fine
 * for a single Vercel serverless instance; behind a multi-instance deploy,
 * each lambda fetches its own token. Acumatica licenses concurrent API
 * sessions, so add the `api:concurrent_access` scope if seat usage is tight.
 */

import { getAcumaticaConfig, type AcumaticaConfig } from "./config";
import { AcumaticaApiError } from "./types";

type TokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // ms epoch
};

let cachedToken: TokenSet | null = null;
let inFlight: Promise<TokenSet> | null = null;

const REFRESH_SKEW_MS = 60_000;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - REFRESH_SKEW_MS > now) {
    return cachedToken.accessToken;
  }
  if (inFlight) {
    const t = await inFlight;
    return t.accessToken;
  }
  inFlight = acquireToken().finally(() => {
    inFlight = null;
  });
  const t = await inFlight;
  cachedToken = t;
  return t.accessToken;
}

/** Force token re-acquisition on next call. Use after a 401. */
export function invalidateToken() {
  cachedToken = null;
}

async function acquireToken(): Promise<TokenSet> {
  const cfg = getAcumaticaConfig();
  const body = new URLSearchParams();
  body.set("client_id", cfg.oauth.clientId);
  body.set("client_secret", cfg.oauth.clientSecret);
  body.set("scope", cfg.oauth.scope);

  if (cfg.oauth.grantType === "password") {
    if (!cfg.oauth.username || !cfg.oauth.password) {
      throw new Error("password grant requires ACUMATICA_OAUTH_USERNAME and ACUMATICA_OAUTH_PASSWORD");
    }
    body.set("grant_type", "password");
    body.set("username", cfg.oauth.username);
    body.set("password", cfg.oauth.password);
  } else {
    body.set("grant_type", "client_credentials");
  }

  const url = `${cfg.baseUrl}/identity/connect/token`;
  const res = await fetchWithTimeout(url, cfg.requestTimeoutMs, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new AcumaticaApiError({
      status: res.status,
      code: res.status === 401 ? "auth" : "server",
      message: `OAuth token request failed: ${text || res.statusText}`,
    });
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  };

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

async function fetchWithTimeout(url: string, timeoutMs: number, init: RequestInit): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type { AcumaticaConfig };

/**
 * Acumatica connection config — driven entirely from environment variables.
 *
 * Required env (set in Vercel Project → Settings → Environment Variables):
 *   ACUMATICA_BASE_URL          e.g. https://wbblends.acumatica.com
 *   ACUMATICA_TENANT            e.g. "WBBlends" — the Company/Tenant ID
 *   ACUMATICA_OAUTH_CLIENT_ID   "<guid>@<CompanyId>" from Connected Applications screen (SM303010)
 *   ACUMATICA_OAUTH_CLIENT_SECRET
 *   ACUMATICA_OAUTH_USERNAME    service account login (for password grant) — or omit if using client_credentials
 *   ACUMATICA_OAUTH_PASSWORD
 *
 * Optional:
 *   ACUMATICA_DEFAULT_ENDPOINT       default: "Default"
 *   ACUMATICA_MFG_ENDPOINT           default: "Manufacturing"
 *   ACUMATICA_ENDPOINT_VERSION       default: "24.200.001" — PIN this; "Latest" silently changes on tenant upgrade
 *   ACUMATICA_OAUTH_SCOPE            default: "api offline_access"
 *   ACUMATICA_REQUEST_TIMEOUT_MS     default: 30000
 *   ACUMATICA_MAX_PAGE_SIZE          default: 200 — HTTP 511 means too large; reduce
 */

export type AcumaticaConfig = {
  baseUrl: string;
  tenant: string;
  oauth: {
    clientId: string;
    clientSecret: string;
    username?: string;
    password?: string;
    scope: string;
    grantType: "password" | "client_credentials";
  };
  endpoints: {
    default: string;
    manufacturing: string;
    version: string;
  };
  requestTimeoutMs: number;
  maxPageSize: number;
};

let cached: AcumaticaConfig | null = null;

export function getAcumaticaConfig(): AcumaticaConfig {
  if (cached) return cached;

  const baseUrl = required("ACUMATICA_BASE_URL").replace(/\/+$/, "");
  const tenant = required("ACUMATICA_TENANT");
  const clientId = required("ACUMATICA_OAUTH_CLIENT_ID");
  const clientSecret = required("ACUMATICA_OAUTH_CLIENT_SECRET");
  const username = process.env.ACUMATICA_OAUTH_USERNAME;
  const password = process.env.ACUMATICA_OAUTH_PASSWORD;

  cached = {
    baseUrl,
    tenant,
    oauth: {
      clientId,
      clientSecret,
      username,
      password,
      scope: process.env.ACUMATICA_OAUTH_SCOPE ?? "api offline_access",
      grantType: username && password ? "password" : "client_credentials",
    },
    endpoints: {
      default: process.env.ACUMATICA_DEFAULT_ENDPOINT ?? "Default",
      manufacturing: process.env.ACUMATICA_MFG_ENDPOINT ?? "Manufacturing",
      version: process.env.ACUMATICA_ENDPOINT_VERSION ?? "24.200.001",
    },
    requestTimeoutMs: intEnv("ACUMATICA_REQUEST_TIMEOUT_MS", 30_000),
    maxPageSize: intEnv("ACUMATICA_MAX_PAGE_SIZE", 200),
  };
  return cached;
}

/** Reset the cache. Test-only. */
export function _resetConfigForTests() {
  cached = null;
}

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

function intEnv(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Build an entity URL for the Default endpoint. */
export function entityUrl(cfg: AcumaticaConfig, entity: string, suffix = ""): string {
  return `${cfg.baseUrl}/entity/${cfg.endpoints.default}/${cfg.endpoints.version}/${entity}${suffix}`;
}

/** Build an entity URL for the Manufacturing endpoint. */
export function mfgEntityUrl(cfg: AcumaticaConfig, entity: string, suffix = ""): string {
  return `${cfg.baseUrl}/entity/${cfg.endpoints.manufacturing}/${cfg.endpoints.version}/${entity}${suffix}`;
}

/** Build the file-by-id URL (entity-agnostic). */
export function fileUrl(cfg: AcumaticaConfig, fileId: string): string {
  return `${cfg.baseUrl}/entity/${cfg.endpoints.default}/${cfg.endpoints.version}/files/${fileId}`;
}

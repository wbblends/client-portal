import { requireSuperAdmin } from "@/lib/auth";

/**
 * Gates every page under `/admin/*` to super admins. Anyone else gets sent
 * back to /dashboard via `requireSuperAdmin()`.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return <>{children}</>;
}

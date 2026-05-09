import { requireCustomerAccess } from "@/lib/auth";

/**
 * Guard layout for /c/[customerId]/*. Validates that the logged-in user is
 * allowed to view this customer's data and 404/redirects otherwise.
 *
 * Each child page should also call `requireCustomerAccess(customerId)` to
 * fetch the resolved customer object (cheap — pure registry lookup) rather
 * than relying on layout-passed context.
 */
export default async function CustomerScopeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  await requireCustomerAccess(customerId);
  return <>{children}</>;
}

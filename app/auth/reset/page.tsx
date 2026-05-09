import { redirect } from "next/navigation";

/** Convenience alias — `?token=...` reset links land here, but the actual
 *  flow lives at /auth/set-password (which handles both invite and reset
 *  tokens identically). Forward through with the query string intact. */
export default async function ResetPage(props: PageProps<"/auth/reset">) {
  const params = await props.searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  if (!token) redirect("/login");
  redirect(`/auth/set-password?token=${encodeURIComponent(token)}`);
}

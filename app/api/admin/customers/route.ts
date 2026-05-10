import { NextResponse } from "next/server";
import { listCustomers } from "@/lib/data/store";
import { requireSuperAdminApi } from "@/lib/api-auth";

export async function GET() {
  const guard = await requireSuperAdminApi();
  if ("response" in guard) return guard.response;

  const customers = await listCustomers();
  return NextResponse.json({ customers });
}

import { getCustomer, listCustomers } from "@/lib/data/store";
import type { CustomerProfile } from "./types";

/**
 * Returns the customer profile for a given customer id, sourced from the JSON
 * store under `data/customers.json`. Returns a graceful fallback if the
 * customer record is missing so pages don't crash for stale sessions.
 */
export async function getCustomerProfile(customerId: string): Promise<CustomerProfile> {
  const stored = await getCustomer(customerId);
  if (!stored) {
    return {
      id: customerId,
      name: customerId,
      email: "",
      primaryContact: "",
      phone: "",
      websiteUrl: "",
      avatarUrl: null,
      logoUrl: null,
      accountSince: new Date().getFullYear(),
    };
  }
  return {
    id: stored.id,
    name: stored.name,
    email: stored.email,
    primaryContact: stored.primaryContact,
    phone: stored.phone,
    websiteUrl: stored.websiteUrl,
    avatarUrl: stored.avatarUrl,
    logoUrl: stored.logoUrl,
    accountSince: stored.accountSince,
  };
}

export async function getAllCustomerProfiles(): Promise<CustomerProfile[]> {
  const stored = await listCustomers();
  return stored.map(s => ({
    id: s.id,
    name: s.name,
    email: s.email,
    primaryContact: s.primaryContact,
    phone: s.phone,
    websiteUrl: s.websiteUrl,
    avatarUrl: s.avatarUrl,
    logoUrl: s.logoUrl,
    accountSince: s.accountSince,
  }));
}

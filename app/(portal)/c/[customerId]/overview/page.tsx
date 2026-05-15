import { requireCustomerAccess } from "@/lib/auth";
import { CustomerOverviewDashboard } from "@/components/dashboards/customer-overview";

export async function generateMetadata(props: PageProps<"/c/[customerId]/overview">) {
  const { customerId } = await props.params;
  return { title: `Overview · ${customerId} — WB Blends` };
}

export default async function CustomerOverviewPage(props: PageProps<"/c/[customerId]/overview">) {
  const { customerId } = await props.params;
  const { customer } = await requireCustomerAccess(customerId);
  const searchParams = await props.searchParams;
  return (
    <CustomerOverviewDashboard
      customer={customer}
      searchParams={searchParams}
    />
  );
}

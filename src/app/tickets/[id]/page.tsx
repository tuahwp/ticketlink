import { notFound, redirect } from "next/navigation";
import { 
  getTicketById, 
  getServicePartners,
  getMaincons,
  getDevices,
  getStates,
  getEndCustomerSites,
  getCustomerSlas
} from "../../actions";
import TicketWorkspace from "../../components/TicketWorkspace";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function TicketDetailPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params);
  const rawId = resolvedParams?.id;
  const ticketId = Number(rawId);

  if (!rawId || isNaN(ticketId)) notFound();

  const user = await getSessionUser();
  if (!user) {
    redirect(`/?redirect=/tickets/${ticketId}`);
  }
  if (user.role === "FIELD_ENGINEER") {
    redirect(`/?ticketId=${ticketId}`);
  }

  const [ticket, partners, maincons, devices, states, initialSites, slaRules] = await Promise.all([
    getTicketById(ticketId).catch((err) => {
      console.warn("Failed to fetch ticket by id:", err);
      return null;
    }),
    getServicePartners().catch(() => []),
    getMaincons().catch(() => []),
    getDevices().catch(() => []),
    getStates().catch(() => []),
    getEndCustomerSites().catch(() => []),
    getCustomerSlas().catch(() => []),
  ]);

  if (!ticket) notFound();

  return (
    <TicketWorkspace 
      ticket={ticket} 
      partners={partners}
      maincons={maincons}
      devices={devices}
      states={states}
      initialSites={initialSites}
      slaRules={slaRules}
    />
  );
}

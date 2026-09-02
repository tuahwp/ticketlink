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
  params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ticketId = Number(id);

  if (isNaN(ticketId)) notFound();

  const user = await getSessionUser();
  if (user?.role === "FIELD_ENGINEER") {
    redirect(`/?ticketId=${ticketId}`);
  }

  const [ticket, partners, maincons, devices, states, initialSites, slaRules] = await Promise.all([
    getTicketById(ticketId),
    getServicePartners(),
    getMaincons(),
    getDevices(),
    getStates(),
    getEndCustomerSites(),
    getCustomerSlas(),
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

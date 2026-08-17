import { notFound } from "next/navigation";
import { getTicketById, getServicePartners } from "../../actions";
import TicketWorkspace from "../../components/TicketWorkspace";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ticketId = Number(id);

  if (isNaN(ticketId)) notFound();

  const [ticket, partners] = await Promise.all([
    getTicketById(ticketId),
    getServicePartners(),
  ]);

  if (!ticket) notFound();

  return <TicketWorkspace ticket={ticket} partners={partners} />;
}

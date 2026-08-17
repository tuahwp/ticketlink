import React from "react";
import { notFound } from "next/navigation";
import { getTicketById, getMaincons, getServicePartners, getDevices, getStates, getEndCustomerSites, getCustomerSlas } from "../../../actions";
import EditTicketForm from "../../../components/EditTicketForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTicketPage({ params }: PageProps) {
  const { id } = await params;
  const ticketId = Number(id);

  if (isNaN(ticketId)) notFound();

  const [ticket, maincons, partners, devices, states, initialSites, slaRules] = await Promise.all([
    getTicketById(ticketId),
    getMaincons(),
    getServicePartners(),
    getDevices(),
    getStates(),
    getEndCustomerSites(),
    getCustomerSlas(),
  ]);

  if (!ticket) notFound();

  return (
    <EditTicketForm
      ticket={ticket}
      maincons={maincons}
      partners={partners}
      devices={devices}
      states={states}
      initialSites={initialSites}
      slaRules={slaRules}
    />
  );
}

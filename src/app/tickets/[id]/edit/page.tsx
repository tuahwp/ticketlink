import React from "react";
import { notFound, redirect } from "next/navigation";
import { getTicketById, getMaincons, getServicePartners, getDevices, getStates, getEndCustomerSites, getCustomerSlas } from "../../../actions";
import EditTicketForm from "../../../components/EditTicketForm";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function EditTicketPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params);
  const rawId = resolvedParams?.id;
  const ticketId = Number(rawId);

  if (!rawId || isNaN(ticketId)) notFound();

  const user = await getSessionUser();
  if (!user) {
    redirect(`/?redirect=/tickets/${ticketId}/edit`);
  }
  if (user.role === "FIELD_ENGINEER") {
    redirect(`/?ticketId=${ticketId}`);
  }
  if (user.role === "AGENT") {
    redirect(`/tickets/${ticketId}`);
  }

  const [ticket, maincons, partners, devices, states, initialSites, slaRules] = await Promise.all([
    getTicketById(ticketId).catch((err) => {
      console.warn("Failed to fetch ticket by id for edit:", err);
      return null;
    }),
    getMaincons().catch(() => []),
    getServicePartners().catch(() => []),
    getDevices().catch(() => []),
    getStates().catch(() => []),
    getEndCustomerSites().catch(() => []),
    getCustomerSlas().catch(() => []),
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

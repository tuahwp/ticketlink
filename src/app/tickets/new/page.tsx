import React from "react";
import { getMaincons, getServicePartners, getDevices, getStates, getEndCustomerSites, getCustomerSlas } from "../../actions";
import CreateTicketForm from "../../components/CreateTicketForm";

export const dynamic = "force-dynamic";

export default async function NewTicketPage() {
  const [maincons, partners, devices, states, initialSites, slaRules] = await Promise.all([
    getMaincons(),
    getServicePartners(),
    getDevices(),
    getStates(),
    getEndCustomerSites(),
    getCustomerSlas(),
  ]);

  return (
    <CreateTicketForm
      maincons={maincons}
      partners={partners}
      devices={devices}
      states={states}
      initialSites={initialSites}
      slaRules={slaRules}
    />
  );
}

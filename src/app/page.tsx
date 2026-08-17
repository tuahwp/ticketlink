import Dashboard from "./components/Dashboard";
import { getTickets, getMaincons, getServicePartners, getDevices, getStates, getCustomerSlas } from "./actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [tickets, maincons, partners, devices, states, slas] = await Promise.all([
    getTickets(),
    getMaincons(),
    getServicePartners(),
    getDevices(),
    getStates(),
    getCustomerSlas(),
  ]);

  return (
    <Dashboard
      initialTickets={tickets}
      initialMaincons={maincons}
      initialPartners={partners}
      initialDevices={devices}
      initialStates={states}
      initialSlas={slas}
    />
  );
}

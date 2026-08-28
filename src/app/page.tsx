import Dashboard from "./components/Dashboard";
import {
  getTickets,
  getMaincons,
  getServicePartners,
  getDevices,
  getStates,
  getCustomerSlas,
  getInventoryItems,
  getWarehouses,
  getPendingPartsRequests,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [tickets, maincons, partners, devices, states, slas, inventoryItems, warehouses, pendingPartsTickets] =
    await Promise.all([
      getTickets(),
      getMaincons(),
      getServicePartners(),
      getDevices(),
      getStates(),
      getCustomerSlas(),
      getInventoryItems(),
      getWarehouses(),
      getPendingPartsRequests(),
    ]);

  return (
    <Dashboard
      initialTickets={tickets}
      initialMaincons={maincons}
      initialPartners={partners}
      initialDevices={devices}
      initialStates={states}
      initialSlas={slas}
      initialInventoryItems={inventoryItems}
      initialWarehouses={warehouses}
      initialPendingPartsTickets={pendingPartsTickets}
    />
  );
}


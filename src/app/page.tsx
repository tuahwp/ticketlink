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
  const [
    tickets,
    maincons,
    partners,
    devices,
    states,
    slas,
    inventoryItems,
    warehouses,
    pendingPartsTickets,
  ] = await Promise.all([
    getTickets().catch((err) => {
      console.error("Failed to load tickets:", err);
      return [];
    }),
    getMaincons().catch(() => []),
    getServicePartners().catch(() => []),
    getDevices().catch(() => []),
    getStates().catch(() => []),
    getCustomerSlas().catch(() => []),
    getInventoryItems().catch((err) => {
      console.error("Failed to load inventory items:", err);
      return [];
    }),
    getWarehouses().catch((err) => {
      console.error("Failed to load warehouses:", err);
      return [];
    }),
    getPendingPartsRequests().catch((err) => {
      console.error("Failed to load pending parts:", err);
      return [];
    }),
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


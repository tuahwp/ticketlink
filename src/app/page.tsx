import Dashboard from "./components/Dashboard";
import {
  getTickets,
  getMaincons,
  getServicePartners,
  getDevices,
  getStates,
  getCustomerSlas,
} from "./actions";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Enforce server-side authentication check before executing any queries:
  // If no valid session cookie is present, return null immediately.
  // The client-side AuthProvider renders the Login UI without any server dashboard data.
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return null;
  }

  // Authenticated user: load only first page (50 items) with grid columns and master lookups.
  // Heavy tabs (inventory, warehouses, pending parts, users, registration codes) are loaded lazily on tab click.
  const [
    ticketResult,
    maincons,
    partners,
    devices,
    states,
    slas,
  ] = await Promise.all([
    getTickets({ page: 1, pageSize: 50 }).catch((err) => {
      console.error("Failed to load tickets:", err);
      return { tickets: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 1, presetCounts: null };
    }),
    getMaincons().catch(() => []),
    getServicePartners().catch(() => []),
    getDevices().catch(() => []),
    getStates().catch(() => []),
    getCustomerSlas().catch(() => []),
  ]);

  return (
    <Dashboard
      initialTickets={ticketResult.tickets}
      initialTotalTickets={ticketResult.totalCount}
      initialPresetCounts={ticketResult.presetCounts}
      initialMaincons={maincons}
      initialPartners={partners}
      initialDevices={devices}
      initialStates={states}
      initialSlas={slas}
      initialInventoryItems={[]}
      initialWarehouses={[]}
      initialPendingPartsTickets={[]}
      initialUsers={[]}
      initialCodes={[]}
    />
  );
}

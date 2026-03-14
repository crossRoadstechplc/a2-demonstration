import { KPIStatCard } from "@/components/dashboard/kpi-stat-card";
import type { StationKpis } from "../normalize";

interface StationKpiGridProps {
  kpis: StationKpis;
}

export function StationKpiGrid({ kpis }: StationKpiGridProps) {
  return (
    <section className="dashboard-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
      <KPIStatCard label="Total Batteries" value={String(kpis.totalBatteries)} status="neutral" />
      <KPIStatCard label="Ready Batteries" value={String(kpis.readyBatteries)} status="success" />
      <KPIStatCard
        label="Charging Batteries"
        value={String(kpis.chargingBatteries)}
        status="warning"
      />
      <KPIStatCard
        label="Trucks at Station"
        value={String(kpis.trucksAtStation)}
        status="info"
      />
      <KPIStatCard label="Swaps Today" value={String(kpis.swapsToday)} status="info" />
      <KPIStatCard
        label="Energy Consumed"
        value={`${Math.round(kpis.energyConsumedToday)} kWh`}
        status="warning"
      />
      <KPIStatCard
        label="Open Charger Faults"
        value={String(kpis.chargerFaultsOpen)}
        status={kpis.chargerFaultsOpen > 0 ? "danger" : "success"}
      />
      <KPIStatCard
        label="Queue Size"
        value={String(kpis.queueSize)}
        status={kpis.queueSize > 4 ? "warning" : "neutral"}
      />
    </section>
  );
}

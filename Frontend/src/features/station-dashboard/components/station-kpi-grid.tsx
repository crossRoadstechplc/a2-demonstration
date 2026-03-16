import { KPIStatCard } from "@/components/dashboard/kpi-stat-card";
import type { StationKpis } from "../normalize";
import { deriveStationKpiStatus } from "../station-kpi-thresholds";

interface StationKpiGridProps {
  kpis: StationKpis;
}

export function StationKpiGrid({ kpis }: StationKpiGridProps) {
  const status = deriveStationKpiStatus(kpis);
  return (
    <section className="dashboard-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
      <KPIStatCard label="Total Batteries" value={String(kpis.totalBatteries)} status={status.totalBatteries} />
      <KPIStatCard label="Ready Batteries" value={String(kpis.readyBatteries)} status={status.readyBatteries} />
      <KPIStatCard
        label="Charging Batteries"
        value={String(kpis.chargingBatteries)}
        status={status.chargingBatteries}
      />
      <KPIStatCard
        label="Trucks at Station"
        value={String(kpis.trucksAtStation)}
        status={status.trucksAtStation}
      />
      <KPIStatCard label="Swaps Today" value={String(kpis.swapsToday)} status={status.swapsToday} />
      <KPIStatCard
        label="Energy Consumed Today"
        value={`${Math.round(kpis.energyConsumedToday)} kWh`}
        status={status.energyConsumedToday}
      />
      <KPIStatCard
        label="Energy Charging Now"
        value={`${Math.round(kpis.energyChargingNow)} kWh`}
        status={status.energyChargingNow}
      />
      <KPIStatCard
        label="Revenue Today"
        value={`${Math.round(kpis.revenueTodayEtb).toLocaleString()} ETB`}
        status={status.revenueTodayEtb}
      />
      <KPIStatCard
        label="Revenue This Month"
        value={`${Math.round(kpis.revenueThisMonthEtb).toLocaleString()} ETB`}
        status={status.revenueThisMonthEtb}
      />
      <KPIStatCard
        label="Open Charger Faults"
        value={String(kpis.chargerFaultsOpen)}
        status={status.chargerFaultsOpen}
      />
      <KPIStatCard
        label="Queue Size"
        value={String(kpis.queueSize)}
        status={status.queueSize}
      />
    </section>
  );
}

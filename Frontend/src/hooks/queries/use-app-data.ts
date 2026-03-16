"use client";

import { queryKeys } from "@/constants/query-keys";
import { useAppMutation, useAppQuery } from "@/lib/query";
import { authService } from "@/services/auth.service";
import { batteriesService } from "@/services/batteries.service";
import { billingService } from "@/services/billing.service";
import { dashboardService } from "@/services/dashboard.service";
import { driversService } from "@/services/drivers.service";
import { fleetsService } from "@/services/fleets.service";
import { freightService } from "@/services/freight.service";
import { configService } from "@/services/config.service";
import { chargingService } from "@/services/charging.service";
import { stationsService } from "@/services/stations.service";
import { swapsService } from "@/services/swaps.service";
import { trucksService } from "@/services/trucks.service";
import { simulationService } from "@/services/simulation.service";

export const appQueries = {
  useMe: () =>
    useAppQuery({
      queryKey: queryKeys.auth.me,
      queryFn: authService.me,
    }),
  useStations: () =>
    useAppQuery({
      queryKey: queryKeys.stations.all,
      queryFn: stationsService.list,
    }),
  useFleets: () =>
    useAppQuery({
      queryKey: queryKeys.fleets.all,
      queryFn: fleetsService.list,
    }),
  useTrucks: () =>
    useAppQuery({
      queryKey: queryKeys.trucks.all,
      queryFn: trucksService.list,
    }),
  useDrivers: () =>
    useAppQuery({
      queryKey: queryKeys.drivers.all,
      queryFn: driversService.list,
    }),
  useBatteries: () =>
    useAppQuery({
      queryKey: queryKeys.batteries.all,
      queryFn: batteriesService.list,
    }),
  useSwaps: () =>
    useAppQuery({
      queryKey: queryKeys.swaps.all,
      queryFn: swapsService.list,
    }),
  useReceipts: () =>
    useAppQuery({
      queryKey: queryKeys.billing.receipts,
      queryFn: billingService.receipts,
    }),
  useShipments: () =>
    useAppQuery({
      queryKey: queryKeys.freight.all,
      queryFn: freightService.list,
    }),
  useA2Summary: () =>
    useAppQuery({
      queryKey: queryKeys.dashboard.a2,
      queryFn: dashboardService.a2,
    }),
  useA2LiveFeed: () =>
    useAppQuery({
      queryKey: queryKeys.dashboard.liveFeed,
      queryFn: dashboardService.liveFeed,
      staleTime: 20_000,
    }),
  useA2Charts: () =>
    useAppQuery({
      queryKey: queryKeys.dashboard.a2Charts,
      queryFn: dashboardService.a2Charts,
      staleTime: 15_000,
    }),
  useBillingSummaryA2: () =>
    useAppQuery({
      queryKey: queryKeys.billing.summaryA2,
      queryFn: billingService.summaryA2,
      staleTime: 30_000,
    }),
  useBillingSummaryStations: () =>
    useAppQuery({
      queryKey: queryKeys.billing.summaryStations,
      queryFn: billingService.summaryStations,
      staleTime: 30_000,
    }),
  useBillingSummaryFleets: () =>
    useAppQuery({
      queryKey: queryKeys.billing.summaryFleets,
      queryFn: billingService.summaryFleets,
      staleTime: 30_000,
    }),
  useBillingSummaryEeu: (timeframe: "daily" | "monthly" | "yearly" = "daily") =>
    useAppQuery({
      queryKey: [...queryKeys.billing.summaryEeu, timeframe],
      queryFn: () => billingService.summaryEeu(timeframe),
      staleTime: 30_000,
    }),
  useFleetSummary: (fleetId: number) =>
    useAppQuery({
      queryKey: queryKeys.dashboard.fleet(fleetId),
      queryFn: () => dashboardService.fleet(fleetId),
      enabled: Boolean(fleetId) && fleetId > 0,
    }),
  useFleetEnergyByTruck: (fleetId: number) =>
    useAppQuery({
      queryKey: queryKeys.dashboard.fleetEnergyByTruck(fleetId),
      queryFn: () => dashboardService.fleetEnergyByTruck(fleetId),
      enabled: Boolean(fleetId) && fleetId > 0,
      staleTime: 15_000,
    }),
  useFreightSummary: (customerId: number, timeframe: "daily" | "monthly" | "yearly" = "daily") =>
    useAppQuery({
      queryKey: queryKeys.dashboard.freight(customerId, timeframe),
      queryFn: () => dashboardService.freight(customerId, timeframe),
      enabled: Boolean(customerId) && customerId > 0,
      staleTime: 20_000,
    }),
  useStationSummary: (stationId: number) =>
    useAppQuery({
      queryKey: queryKeys.dashboard.station(stationId),
      queryFn: () => dashboardService.station(stationId),
      enabled: stationId > 0,
    }),
  useStationIncidents: (stationId: number) =>
    useAppQuery({
      queryKey: queryKeys.stations.incidents(stationId),
      queryFn: () => stationsService.listIncidents(stationId),
      enabled: stationId > 0,
    }),
  useStationChargerFaults: (stationId: number) =>
    useAppQuery({
      queryKey: queryKeys.stations.chargerFaults(stationId),
      queryFn: () => stationsService.listChargerFaults(stationId),
      enabled: stationId > 0,
    }),
  useChargingByStation: (stationId: number) =>
    useAppQuery({
      queryKey: queryKeys.charging.station(stationId),
      queryFn: () => chargingService.listByStation(stationId),
      staleTime: 20_000,
      enabled: stationId > 0,
    }),
  useTariffConfig: () =>
    useAppQuery({
      queryKey: queryKeys.config.tariffs,
      queryFn: configService.tariffs,
      staleTime: 60_000,
    }),
};

export const appMutations = {
  useLogin: () => useAppMutation(authService.login),
  useStartSimulation: () => useAppMutation(simulationService.start),
  useStopSimulation: () => useAppMutation(simulationService.stop),
};

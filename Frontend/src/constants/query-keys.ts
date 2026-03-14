export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  stations: {
    all: ["stations"] as const,
    byId: (id: number) => ["stations", id] as const,
    incidents: (id: number) => ["stations", id, "incidents"] as const,
    chargerFaults: (id: number) => ["stations", id, "charger-faults"] as const,
  },
  fleets: {
    all: ["fleets"] as const,
    byId: (id: number) => ["fleets", id] as const,
  },
  trucks: {
    all: ["trucks"] as const,
    byId: (id: number) => ["trucks", id] as const,
    refrigerated: ["trucks", "refrigerated"] as const,
  },
  drivers: {
    all: ["drivers"] as const,
    byId: (id: number) => ["drivers", id] as const,
  },
  batteries: {
    all: ["batteries"] as const,
    byId: (id: number) => ["batteries", id] as const,
    history: (id: number) => ["batteries", id, "history"] as const,
  },
  swaps: {
    all: ["swaps"] as const,
  },
  charging: {
    station: (stationId: number) =>
      ["charging", "station", stationId] as const,
    network: (stationIds: number[]) => ["charging", "network", ...stationIds] as const,
  },
  config: {
    tariffs: ["config", "tariffs"] as const,
  },
  billing: {
    receipts: ["billing", "receipts"] as const,
    summaryA2: ["billing", "summary", "a2"] as const,
    summaryEeu: ["billing", "summary", "eeu"] as const,
    summaryStations: ["billing", "summary", "stations"] as const,
    summaryFleets: ["billing", "summary", "fleets"] as const,
  },
  freight: {
    all: ["freight"] as const,
    byId: (id: number) => ["freight", id] as const,
    tracking: (id: number) => ["freight", id, "tracking"] as const,
  },
  dashboard: {
    a2: ["dashboard", "a2"] as const,
    station: (id: number) => ["dashboard", "station", id] as const,
    fleet: (id: number) => ["dashboard", "fleet", id] as const,
    driver: (id: number) => ["dashboard", "driver", id] as const,
    eeu: ["dashboard", "eeu"] as const,
    freight: (customerId: number) =>
      ["dashboard", "freight", customerId] as const,
    liveFeed: ["dashboard", "a2", "live-feed"] as const,
  },
  simulation: {
    status: ["simulation", "status"] as const,
  },
} as const;

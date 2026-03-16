import request from "supertest";

import app from "../../src/app";
import { getQuery, initializeDatabase, runQuery } from "../../src/database/connection";
import { runSimulationCycle } from "../../src/services/simulation/orchestrator";

describe("KPI Coverage Tests", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await runQuery("DELETE FROM receipts;");
    await runQuery("DELETE FROM charging_sessions;");
    await runQuery("DELETE FROM swap_transactions;");
    await runQuery("DELETE FROM batteries;");
    await runQuery("DELETE FROM shipments;");
    await runQuery("DELETE FROM driver_telemetry;");
    await runQuery("DELETE FROM trucks;");
    await runQuery("DELETE FROM drivers;");
    await runQuery("DELETE FROM fleets;");
    await runQuery("DELETE FROM stations;");
  });

  async function createBaseData(): Promise<{
    stationId: number;
    fleetId: number;
    driverId: number;
    truckId: number;
    batteryId: number;
  }> {
    const station = await request(app).post("/stations").send({
      name: "Addis Ababa (Main Hub)",
      location: "Addis Ababa",
      capacity: 100,
      status: "ACTIVE",
    });
    const stationId = station.body.station.id as number;

    const fleet = await request(app).post("/fleets").send({
      name: "Test Fleet",
      ownerName: "Test Owner",
      region: "Test Region",
    });
    const fleetId = fleet.body.fleet.id as number;

    const driver = await request(app).post("/drivers").send({
      name: "Test Driver",
      phone: "+251911111111",
      fleetId,
      rating: 4.5,
      status: "AVAILABLE",
    });
    const driverId = driver.body.driver.id as number;

    const truck = await request(app).post("/trucks").send({
      plateNumber: "ET-1001",
      fleetId,
      truckType: "STANDARD",
      batteryId: "BAT-1001",
      status: "READY",
      currentSoc: 80,
      currentStationId: stationId,
    });
    const truckId = truck.body.truck.id as number;

    const battery = await request(app).post("/batteries").send({
      capacityKwh: 588,
      soc: 80,
      health: 95,
      cycleCount: 100,
      temperature: 28,
      status: "READY",
      stationId,
    });
    const batteryId = battery.body.battery.id as number;

    return { stationId, fleetId, driverId, truckId, batteryId };
  }

  describe("A2 Dashboard KPIs", () => {
    it("generates all required A2 KPIs", async () => {
      const base = await createBaseData();

      // Assign driver to truck
      await runQuery("UPDATE drivers SET assignedTruckId = ?, status = 'ACTIVE' WHERE id = ?;", [
        base.truckId,
        base.driverId,
      ]);
      await runQuery("UPDATE trucks SET assignedDriverId = ?, status = 'IN_TRANSIT' WHERE id = ?;", [
        base.driverId,
        base.truckId,
      ]);

      // Run simulation cycle
      await runSimulationCycle();

      // Check A2 dashboard endpoint
      const response = await request(app).get("/dashboard/a2");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("activeTrucks");
      expect(response.body).toHaveProperty("swapsToday");
      expect(response.body).toHaveProperty("batteriesReady");
      expect(response.body).toHaveProperty("chargingActive");
      expect(response.body).toHaveProperty("corridorEnergyToday");
      expect(response.body).toHaveProperty("corridorRevenue");
      expect(response.body).toHaveProperty("a2Share");
      expect(response.body).toHaveProperty("eeuShare");
      expect(response.body).toHaveProperty("vatCollected");
      expect(response.body).toHaveProperty("stationsOnline");

      // Verify KPIs are numbers
      expect(typeof response.body.activeTrucks).toBe("number");
      expect(typeof response.body.swapsToday).toBe("number");
      expect(typeof response.body.batteriesReady).toBe("number");
      expect(typeof response.body.chargingActive).toBe("number");
      expect(typeof response.body.corridorEnergyToday).toBe("number");
      expect(typeof response.body.corridorRevenue).toBe("number");
      expect(typeof response.body.a2Share).toBe("number");
      expect(typeof response.body.eeuShare).toBe("number");
      expect(typeof response.body.vatCollected).toBe("number");
      expect(typeof response.body.stationsOnline).toBe("number");
    });
  });

  describe("Fleet Dashboard KPIs", () => {
    it("generates all required Fleet KPIs", async () => {
      const base = await createBaseData();

      // Run simulation cycle
      await runSimulationCycle();

      // Check fleet dashboard endpoint
      const response = await request(app).get(`/dashboard/fleet/${base.fleetId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("activeTrucks");
      expect(response.body).toHaveProperty("availableTrucks");
      expect(response.body).toHaveProperty("activeDrivers");
      expect(response.body).toHaveProperty("swapsToday");
      expect(response.body).toHaveProperty("fleetEnergyCostEtb");
      expect(response.body).toHaveProperty("completedTrips");
      expect(response.body).toHaveProperty("maintenanceAlerts");
      expect(response.body).toHaveProperty("refrigeratedTrucksActive");

      // Verify KPIs are numbers
      expect(typeof response.body.activeTrucks).toBe("number");
      expect(typeof response.body.availableTrucks).toBe("number");
      expect(typeof response.body.activeDrivers).toBe("number");
      expect(typeof response.body.swapsToday).toBe("number");
      expect(typeof response.body.fleetEnergyCostEtb).toBe("number");
      expect(typeof response.body.completedTrips).toBe("number");
      expect(typeof response.body.maintenanceAlerts).toBe("number");
      expect(typeof response.body.refrigeratedTrucksActive).toBe("number");
    });
  });

  describe("Station Dashboard KPIs", () => {
    it("generates all required Station KPIs", async () => {
      const base = await createBaseData();

      // Run simulation cycle
      await runSimulationCycle();

      // Check station dashboard endpoint
      const response = await request(app).get(`/dashboard/station/${base.stationId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("batteriesAtStation");
      expect(response.body).toHaveProperty("activeChargingSessions");
      expect(response.body).toHaveProperty("swapsToday");
      expect(response.body).toHaveProperty("energyToday");
      expect(response.body).toHaveProperty("revenueTodayEtb");
      expect(response.body).toHaveProperty("revenueThisMonthEtb");
      expect(response.body).toHaveProperty("energyChargingNowKwh");
      expect(response.body).toHaveProperty("chargerStatus");
      expect(response.body).toHaveProperty("incomingPredictions");
      expect(response.body).toHaveProperty("queueSize");

      // Verify KPIs are numbers or arrays
      expect(typeof response.body.batteriesAtStation).toBe("number");
      expect(typeof response.body.activeChargingSessions).toBe("number");
      expect(typeof response.body.swapsToday).toBe("number");
      expect(typeof response.body.energyToday).toBe("number");
      expect(typeof response.body.revenueTodayEtb).toBe("number");
      expect(typeof response.body.revenueThisMonthEtb).toBe("number");
      expect(typeof response.body.energyChargingNowKwh).toBe("number");
      expect(Array.isArray(response.body.chargerStatus)).toBe(true);
      expect(Array.isArray(response.body.incomingPredictions)).toBe(true);
      expect(typeof response.body.queueSize).toBe("number");
    });
  });

  describe("Finance Phase", () => {
    it("creates receipts for all swaps", async () => {
      const base = await createBaseData();

      // Create a swap transaction
      const swapResult = await runQuery(
        `INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, 100, ?);`,
        [base.truckId, base.stationId, base.batteryId, base.batteryId, new Date().toISOString()]
      );

      // Run simulation cycle (finance phase should create receipt)
      await runSimulationCycle();

      // Check receipt was created
      const receipt = await getQuery<{ id: number; swapId: number }>(
        "SELECT id, swapId FROM receipts WHERE swapId = ?;",
        [swapResult.lastID]
      );

      expect(receipt).not.toBeNull();
      expect(receipt?.swapId).toBe(swapResult.lastID);
    });

    it("calculates A2 and EEU shares correctly", async () => {
      const base = await createBaseData();

      // Create swap and receipt
      const swapResult = await runQuery(
        `INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, 100, ?);`,
        [base.truckId, base.stationId, base.batteryId, base.batteryId, new Date().toISOString()]
      );

      await runSimulationCycle();

      const receipt = await getQuery<{
        energyCharge: number;
        serviceCharge: number;
        vat: number;
        total: number;
        a2Share: number;
        eeuShare: number;
      }>("SELECT energyCharge, serviceCharge, vat, total, a2Share, eeuShare FROM receipts WHERE swapId = ?;", [
        swapResult.lastID,
      ]);

      expect(receipt).not.toBeNull();
      // A2 share = serviceCharge + (vat / 2)
      expect(receipt?.a2Share).toBeCloseTo((receipt?.serviceCharge ?? 0) + (receipt?.vat ?? 0) / 2, 2);
      // EEU share = energyCharge + (vat / 2)
      expect(receipt?.eeuShare).toBeCloseTo((receipt?.energyCharge ?? 0) + (receipt?.vat ?? 0) / 2, 2);
      // Total = energyCharge + serviceCharge + vat
      expect(receipt?.total).toBeCloseTo(
        (receipt?.energyCharge ?? 0) + (receipt?.serviceCharge ?? 0) + (receipt?.vat ?? 0),
        2
      );
    });
  });

  describe("Queue Management", () => {
    it("creates queue entries for trucks needing swaps", async () => {
      const base = await createBaseData();

      // Set truck to low SOC and in transit
      await runQuery(
        "UPDATE trucks SET status = 'IN_TRANSIT', currentSoc = 30, locationLat = 9.0, locationLng = 40.0 WHERE id = ?;",
        [base.truckId]
      );

      // Run simulation cycle
      await runSimulationCycle();

      // Check queue entry was created
      const queueEntry = await getQuery<{ id: number; truckId: number; stationId: number }>(
        "SELECT id, truckId, stationId FROM swap_queue WHERE truckId = ?;",
        [base.truckId]
      );

      expect(queueEntry).not.toBeNull();
      expect(queueEntry?.truckId).toBe(base.truckId);
    });
  });

  describe("Battery Health", () => {
    it("updates cycle count on swap", async () => {
      const base = await createBaseData();

      const initialCycleCount = await getQuery<{ cycleCount: number }>(
        "SELECT cycleCount FROM batteries WHERE id = ?;",
        [base.batteryId]
      );

      // Create swap transaction
      await runQuery(
        `INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, 100, ?);`,
        [base.truckId, base.stationId, base.batteryId, base.batteryId, new Date().toISOString()]
      );

      // Run simulation cycle
      await runSimulationCycle();

      // Check cycle count was incremented
      const updatedCycleCount = await getQuery<{ cycleCount: number }>(
        "SELECT cycleCount FROM batteries WHERE id = ?;",
        [base.batteryId]
      );

      expect(updatedCycleCount?.cycleCount).toBeGreaterThan(initialCycleCount?.cycleCount ?? 0);
    });
  });

  describe("Driver Rating", () => {
    it("updates driver rating based on performance", async () => {
      const base = await createBaseData();

      // Set driver with completed trips and safety score
      await runQuery(
        "UPDATE drivers SET completedTrips = 50, safetyScore = 90 WHERE id = ?;",
        [base.driverId]
      );

      // Run simulation cycle
      await runSimulationCycle();

      // Check rating was updated
      const driver = await getQuery<{ overallRating: number; tripEfficiency: number }>(
        "SELECT overallRating, tripEfficiency FROM drivers WHERE id = ?;",
        [base.driverId]
      );

      expect(driver?.overallRating).toBeGreaterThan(0);
      expect(driver?.overallRating).toBeLessThanOrEqual(5);
      expect(typeof driver?.tripEfficiency).toBe("number");
    });
  });

  describe("Refrigeration", () => {
    it("updates refrigerated truck temperature", async () => {
      const base = await createBaseData();

      // Create refrigerated truck
      const refrigeratedTruck = await request(app).post("/trucks").send({
        plateNumber: "ET-2001",
        fleetId: base.fleetId,
        truckType: "REFRIGERATED",
        batteryId: "BAT-2001",
        status: "IN_TRANSIT",
        currentSoc: 80,
        refrigerationPowerDraw: 12,
        temperatureTarget: 4,
        temperatureCurrent: 6,
        currentStationId: null,
      });
      const truckId = refrigeratedTruck.body.truck.id as number;

      // Run simulation cycle
      await runSimulationCycle();

      // Check temperature was updated
      const truck = await getQuery<{ temperatureCurrent: number }>(
        "SELECT temperatureCurrent FROM trucks WHERE id = ?;",
        [truckId]
      );

      expect(truck?.temperatureCurrent).not.toBeNull();
      expect(truck?.temperatureCurrent).toBeGreaterThanOrEqual(-10);
      expect(truck?.temperatureCurrent).toBeLessThanOrEqual(10);
    });
  });
});

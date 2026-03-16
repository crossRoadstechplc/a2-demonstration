import request from "supertest";

import app from "../src/app";
import { allQuery, getQuery, initializeDatabase, runQuery } from "../src/database/connection";
import { runSimulationCycle } from "../src/services/simulation/orchestrator";

describe("Dashboard Reconciliation Tests", () => {
  let adminToken: string;

  beforeAll(async () => {
    await initializeDatabase();

    const adminUser = await request(app).post("/auth/register").send({
      name: "Admin User",
      email: "admin@test.com",
      password: "password",
      role: "ADMIN",
    });
    adminToken = adminUser.body.token;
  });

  beforeEach(async () => {
    // Clean up test data
    await runQuery("DELETE FROM receipts;");
    await runQuery("DELETE FROM charging_sessions;");
    await runQuery("DELETE FROM swap_transactions;");
    await runQuery("DELETE FROM shipments;");
    await runQuery("DELETE FROM batteries;");
    await runQuery("DELETE FROM trucks;");
    await runQuery("DELETE FROM drivers;");
    await runQuery("DELETE FROM fleets;");
    await runQuery("DELETE FROM stations;");
  });

  describe("Revenue Reconciliation", () => {
    it("A2 revenue equals sum of receipts A2 share", async () => {
      // Create test data
      const station = await request(app)
        .post("/stations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Station",
          location: "Test Location",
          capacity: 100,
          status: "ACTIVE",
        });
      const stationId = station.body.station.id;

      const fleet = await request(app)
        .post("/fleets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Fleet",
          ownerName: "Test Owner",
          region: "Test Region",
        });
      const fleetId = fleet.body.fleet.id;

      const truck = await request(app)
        .post("/trucks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          plateNumber: "ET-1001",
          fleetId,
          truckType: "STANDARD",
          status: "READY",
          currentSoc: 80,
          currentStationId: stationId,
        });
      const truckId = truck.body.truck.id;

      const battery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 80,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "READY",
          stationId,
        });
      const batteryId = battery.body.battery.id;

      // Create swap transaction
      const swapResult = await runQuery(
        `INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, 100, ?);`,
        [truckId, stationId, batteryId, batteryId, new Date().toISOString()]
      );

      // Run simulation to create receipt
      await runSimulationCycle();

      // Get A2 dashboard data
      const a2Response = await request(app)
        .get("/dashboard/a2")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(a2Response.status).toBe(200);
      const a2Share = a2Response.body.a2Share;

      // Get sum of receipts A2 share
      const receiptsSum = await getQuery<{ total: number }>(
        "SELECT COALESCE(SUM(a2Share), 0) as total FROM receipts WHERE date(timestamp, 'localtime') = date('now', 'localtime');"
      );

      expect(a2Share).toBeCloseTo(receiptsSum?.total ?? 0, 2);
    });

    it("EEU revenue equals sum of receipts EEU share", async () => {
      // Create test data (same as above)
      const station = await request(app)
        .post("/stations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Station",
          location: "Test Location",
          capacity: 100,
          status: "ACTIVE",
        });
      const stationId = station.body.station.id;

      const fleet = await request(app)
        .post("/fleets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Fleet",
          ownerName: "Test Owner",
          region: "Test Region",
        });
      const fleetId = fleet.body.fleet.id;

      const truck = await request(app)
        .post("/trucks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          plateNumber: "ET-1001",
          fleetId,
          truckType: "STANDARD",
          status: "READY",
          currentSoc: 80,
          currentStationId: stationId,
        });
      const truckId = truck.body.truck.id;

      const battery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 80,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "READY",
          stationId,
        });
      const batteryId = battery.body.battery.id;

      // Create swap transaction
      await runQuery(
        `INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, 100, ?);`,
        [truckId, stationId, batteryId, batteryId, new Date().toISOString()]
      );

      // Run simulation to create receipt
      await runSimulationCycle();

      // Get EEU dashboard data
      const eeuUser = await request(app).post("/auth/register").send({
        name: "EEU Operator",
        email: "eeu@test.com",
        password: "password",
        role: "EEU_OPERATOR",
      });
      const eeuToken = eeuUser.body.token;

      const eeuResponse = await request(app)
        .get("/dashboard/eeu?timeframe=daily")
        .set("Authorization", `Bearer ${eeuToken}`);
      expect(eeuResponse.status).toBe(200);
      const eeuRevenueShare = eeuResponse.body.eeuRevenueShare;

      // Get sum of receipts EEU share
      const receiptsSum = await getQuery<{ total: number }>(
        "SELECT COALESCE(SUM(eeuShare), 0) as total FROM receipts WHERE date(timestamp, 'localtime') = date('now', 'localtime');"
      );

      expect(eeuRevenueShare).toBeCloseTo(receiptsSum?.total ?? 0, 2);
    });

    it("corridor revenue equals sum of receipt totals", async () => {
      // Create test data
      const station = await request(app)
        .post("/stations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Station",
          location: "Test Location",
          capacity: 100,
          status: "ACTIVE",
        });
      const stationId = station.body.station.id;

      const fleet = await request(app)
        .post("/fleets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Fleet",
          ownerName: "Test Owner",
          region: "Test Region",
        });
      const fleetId = fleet.body.fleet.id;

      const truck = await request(app)
        .post("/trucks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          plateNumber: "ET-1001",
          fleetId,
          truckType: "STANDARD",
          status: "READY",
          currentSoc: 80,
          currentStationId: stationId,
        });
      const truckId = truck.body.truck.id;

      const battery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 80,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "READY",
          stationId,
        });
      const batteryId = battery.body.battery.id;

      // Create swap transaction
      await runQuery(
        `INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, 100, ?);`,
        [truckId, stationId, batteryId, batteryId, new Date().toISOString()]
      );

      // Run simulation to create receipt
      await runSimulationCycle();

      // Get A2 dashboard data
      const a2Response = await request(app)
        .get("/dashboard/a2")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(a2Response.status).toBe(200);
      const corridorRevenue = a2Response.body.corridorRevenue;

      // Get sum of receipt totals
      const receiptsSum = await getQuery<{ total: number }>(
        `SELECT COALESCE(SUM(r.total), 0) as total
         FROM receipts r
         JOIN swap_transactions st ON r.swapId = st.id
         WHERE date(st.timestamp, 'localtime') = date('now', 'localtime');`
      );

      expect(corridorRevenue).toBeCloseTo(receiptsSum?.total ?? 0, 2);
    });
  });

  describe("Energy Reconciliation", () => {
    it("station energy summaries match charging sessions", async () => {
      const station = await request(app)
        .post("/stations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Station",
          location: "Test Location",
          capacity: 100,
          status: "ACTIVE",
        });
      const stationId = station.body.station.id;

      const battery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 50,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "CHARGING",
          stationId,
        });
      const batteryId = battery.body.battery.id;

      // Create charging session
      await runQuery(
        `INSERT INTO charging_sessions 
         (batteryId, stationId, startSoc, currentSoc, targetSoc, energyAddedKwh, startTime, status)
         VALUES (?, ?, 50, 60, 95, 58.8, ?, 'ACTIVE');`,
        [batteryId, stationId, new Date().toISOString()]
      );

      // Get station dashboard data
      const stationUser = await request(app).post("/auth/register").send({
        name: "Station Operator",
        email: "station@test.com",
        password: "password",
        role: "STATION_OPERATOR",
        organizationId: String(stationId),
      });
      const stationToken = stationUser.body.token;

      const stationResponse = await request(app)
        .get(`/dashboard/station/${stationId}`)
        .set("Authorization", `Bearer ${stationToken}`);
      expect(stationResponse.status).toBe(200);
      const energyChargingNow = stationResponse.body.energyChargingNowKwh;

      // Get sum of charging sessions energy
      const chargingSum = await getQuery<{ total: number }>(
        "SELECT COALESCE(SUM(energyAddedKwh), 0) as total FROM charging_sessions WHERE stationId = ? AND status = 'ACTIVE';",
        [stationId]
      );

      expect(energyChargingNow).toBeCloseTo(chargingSum?.total ?? 0, 2);
    });
  });

  describe("Swap Reconciliation", () => {
    it("swaps today match actual swap records", async () => {
      const station = await request(app)
        .post("/stations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Station",
          location: "Test Location",
          capacity: 100,
          status: "ACTIVE",
        });
      const stationId = station.body.station.id;

      const fleet = await request(app)
        .post("/fleets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Fleet",
          ownerName: "Test Owner",
          region: "Test Region",
        });
      const fleetId = fleet.body.fleet.id;

      const truck = await request(app)
        .post("/trucks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          plateNumber: "ET-1001",
          fleetId,
          truckType: "STANDARD",
          status: "READY",
          currentSoc: 80,
          currentStationId: stationId,
        });
      const truckId = truck.body.truck.id;

      const battery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 80,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "READY",
          stationId,
        });
      const batteryId = battery.body.battery.id;

      // Create swap transaction
      await runQuery(
        `INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, 100, ?);`,
        [truckId, stationId, batteryId, batteryId, new Date().toISOString()]
      );

      // Get A2 dashboard swaps count
      const a2Response = await request(app)
        .get("/dashboard/a2")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(a2Response.status).toBe(200);
      const swapsToday = a2Response.body.swapsToday;

      // Get actual swap count
      const swapCount = await getQuery<{ count: number }>(
        "SELECT COUNT(*) as count FROM swap_transactions WHERE date(timestamp, 'localtime') = date('now', 'localtime');"
      );

      expect(swapsToday).toBe(swapCount?.count ?? 0);
    });
  });

  describe("Fleet Energy Cost Reconciliation", () => {
    it("fleet energy cost matches receipts for fleet trucks", async () => {
      const station = await request(app)
        .post("/stations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Station",
          location: "Test Location",
          capacity: 100,
          status: "ACTIVE",
        });
      const stationId = station.body.station.id;

      const fleet = await request(app)
        .post("/fleets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Fleet",
          ownerName: "Test Owner",
          region: "Test Region",
        });
      const fleetId = fleet.body.fleet.id;

      const truck = await request(app)
        .post("/trucks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          plateNumber: "ET-1001",
          fleetId,
          truckType: "STANDARD",
          status: "READY",
          currentSoc: 80,
          currentStationId: stationId,
        });
      const truckId = truck.body.truck.id;

      const battery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 80,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "READY",
          stationId,
        });
      const batteryId = battery.body.battery.id;

      // Create swap transaction
      await runQuery(
        `INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, 100, ?);`,
        [truckId, stationId, batteryId, batteryId, new Date().toISOString()]
      );

      // Run simulation to create receipt
      await runSimulationCycle();

      // Get fleet dashboard data
      const fleetUser = await request(app).post("/auth/register").send({
        name: "Fleet Owner",
        email: "fleet@test.com",
        password: "password",
        role: "FLEET_OWNER",
        organizationId: String(fleetId),
      });
      const fleetToken = fleetUser.body.token;

      const fleetResponse = await request(app)
        .get(`/dashboard/fleet/${fleetId}`)
        .set("Authorization", `Bearer ${fleetToken}`);
      expect(fleetResponse.status).toBe(200);
      const fleetEnergyCost = fleetResponse.body.fleetEnergyCostEtb;

      // Get sum of receipts for fleet trucks
      const receiptsSum = await getQuery<{ total: number }>(
        `SELECT COALESCE(SUM(r.total), 0) as total
         FROM receipts r
         JOIN swap_transactions st ON r.swapId = st.id
         JOIN trucks t ON st.truckId = t.id
         WHERE t.fleetId = ? AND date(r.timestamp, 'localtime') = date('now', 'localtime');`,
        [fleetId]
      );

      expect(fleetEnergyCost).toBeCloseTo(receiptsSum?.total ?? 0, 2);
    });
  });
});

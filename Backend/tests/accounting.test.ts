import request from "supertest";

import app from "../src/app";
import { allQuery, getQuery, initializeDatabase, runQuery } from "../src/database/connection";
import { runSimulationCycle } from "../src/services/simulation/orchestrator";

describe("Accounting Tests", () => {
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
    await runQuery("DELETE FROM swap_transactions;");
    await runQuery("DELETE FROM batteries;");
    await runQuery("DELETE FROM trucks;");
    await runQuery("DELETE FROM stations;");
    await runQuery("DELETE FROM fleets;");
  });

  describe("Standard Swap Math", () => {
    it("calculates receipt correctly for standard swap", async () => {
      // Set tariff
      await runQuery(
        "INSERT OR REPLACE INTO tariff_config (id, eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent) VALUES (1, 10, 10, 15);"
      );

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
          currentSoc: 30,
          currentStationId: stationId,
        });
      const truckId = truck.body.truck.id;

      // Create outgoing battery (in truck)
      const outgoingBattery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 30,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "IN_TRUCK",
          truckId,
        });
      const outgoingBatteryId = outgoingBattery.body.battery.id;

      // Create incoming battery (at station)
      const incomingBattery = await request(app)
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
      const incomingBatteryId = incomingBattery.body.battery.id;

      // Create swap transaction
      const energyDeliveredKwh = 294; // 588 * (80 - 30) / 100
      const swapResult = await runQuery(
        `INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, ?, ?);`,
        [truckId, stationId, incomingBatteryId, outgoingBatteryId, energyDeliveredKwh, new Date().toISOString()]
      );

      // Run simulation to create receipt
      await runSimulationCycle();

      // Get receipt
      const receipt = await getQuery<{
        energyKwh: number;
        energyCharge: number;
        serviceCharge: number;
        vat: number;
        total: number;
        eeuShare: number;
        a2Share: number;
      }>("SELECT energyKwh, energyCharge, serviceCharge, vat, total, eeuShare, a2Share FROM receipts WHERE swapId = ?;", [
        swapResult.lastID,
      ]);

      expect(receipt).not.toBeNull();
      expect(receipt?.energyKwh).toBe(294);

      // Verify calculations
      // Energy charge = 294 * 10 = 2940
      expect(receipt?.energyCharge).toBeCloseTo(2940, 2);
      // Service charge = 294 * 10 = 2940
      expect(receipt?.serviceCharge).toBeCloseTo(2940, 2);
      // Subtotal = 2940 + 2940 = 5880
      const subtotal = (receipt?.energyCharge ?? 0) + (receipt?.serviceCharge ?? 0);
      expect(subtotal).toBeCloseTo(5880, 2);
      // VAT = 5880 * 0.15 = 882
      expect(receipt?.vat).toBeCloseTo(882, 2);
      // Total = 5880 + 882 = 6762
      expect(receipt?.total).toBeCloseTo(6762, 2);
      // EEU share = 2940 + 882/2 = 2940 + 441 = 3381
      expect(receipt?.eeuShare).toBeCloseTo(3381, 2);
      // A2 share = 2940 + 882/2 = 2940 + 441 = 3381
      expect(receipt?.a2Share).toBeCloseTo(3381, 2);
      // Total = EEU share + A2 share
      expect((receipt?.eeuShare ?? 0) + (receipt?.a2Share ?? 0)).toBeCloseTo(receipt?.total ?? 0, 2);
    });
  });

  describe("Refrigerated Swap Math", () => {
    it("calculates receipt correctly for refrigerated swap with extra energy", async () => {
      // Set tariff
      await runQuery(
        "INSERT OR REPLACE INTO tariff_config (id, eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent) VALUES (1, 10, 10, 15);"
      );

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
          plateNumber: "ET-2001",
          fleetId,
          truckType: "REFRIGERATED",
          status: "READY",
          currentSoc: 30,
          refrigerationPowerDraw: 12,
          temperatureTarget: 4,
          temperatureCurrent: 5,
          currentStationId: stationId,
        });
      const truckId = truck.body.truck.id;

      // Create outgoing battery (in truck)
      const outgoingBattery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 30,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "IN_TRUCK",
          truckId,
        });
      const outgoingBatteryId = outgoingBattery.body.battery.id;

      // Create incoming battery (at station)
      const incomingBattery = await request(app)
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
      const incomingBatteryId = incomingBattery.body.battery.id;

      // Create swap transaction with extra energy for refrigerated truck
      // Base energy = 588 * (80 - 30) / 100 = 294
      // Extra energy = 12 (refrigerationPowerDraw)
      // Total energy = 294 + 12 = 306
      const energyDeliveredKwh = 306;
      const swapResult = await runQuery(
        `INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, ?, ?);`,
        [truckId, stationId, incomingBatteryId, outgoingBatteryId, energyDeliveredKwh, new Date().toISOString()]
      );

      // Run simulation to create receipt
      await runSimulationCycle();

      // Get receipt
      const receipt = await getQuery<{
        energyKwh: number;
        energyCharge: number;
        serviceCharge: number;
        vat: number;
        total: number;
        eeuShare: number;
        a2Share: number;
      }>("SELECT energyKwh, energyCharge, serviceCharge, vat, total, eeuShare, a2Share FROM receipts WHERE swapId = ?;", [
        swapResult.lastID,
      ]);

      expect(receipt).not.toBeNull();
      expect(receipt?.energyKwh).toBe(306); // Should include extra energy

      // Verify calculations with extra energy
      // Energy charge = 306 * 10 = 3060
      expect(receipt?.energyCharge).toBeCloseTo(3060, 2);
      // Service charge = 306 * 10 = 3060
      expect(receipt?.serviceCharge).toBeCloseTo(3060, 2);
      // Subtotal = 3060 + 3060 = 6120
      const subtotal = (receipt?.energyCharge ?? 0) + (receipt?.serviceCharge ?? 0);
      expect(subtotal).toBeCloseTo(6120, 2);
      // VAT = 6120 * 0.15 = 918
      expect(receipt?.vat).toBeCloseTo(918, 2);
      // Total = 6120 + 918 = 7038
      expect(receipt?.total).toBeCloseTo(7038, 2);
      // EEU share = 3060 + 918/2 = 3060 + 459 = 3519
      expect(receipt?.eeuShare).toBeCloseTo(3519, 2);
      // A2 share = 3060 + 918/2 = 3060 + 459 = 3519
      expect(receipt?.a2Share).toBeCloseTo(3519, 2);
      // Total = EEU share + A2 share
      expect((receipt?.eeuShare ?? 0) + (receipt?.a2Share ?? 0)).toBeCloseTo(receipt?.total ?? 0, 2);
    });
  });

  describe("VAT Correctness", () => {
    it("calculates VAT correctly as percentage of subtotal", async () => {
      await runQuery(
        "INSERT OR REPLACE INTO tariff_config (id, eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent) VALUES (1, 10, 10, 15);"
      );

      // Create required entities
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
          currentSoc: 30,
          currentStationId: stationId,
        });
      const truckId = truck.body.truck.id;

      // Create outgoing battery (in truck)
      const outgoingBattery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 30,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "IN_TRUCK",
          truckId,
        });
      const outgoingBatteryId = outgoingBattery.body.battery.id;

      // Create incoming battery (at station)
      const incomingBattery = await request(app)
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
      const incomingBatteryId = incomingBattery.body.battery.id;

      const energyKwh = 100;
      const energyCharge = energyKwh * 10; // 1000
      const serviceCharge = energyKwh * 10; // 1000
      const subtotal = energyCharge + serviceCharge; // 2000
      const expectedVat = subtotal * 0.15; // 300

      const swapResult = await runQuery(
        `INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, ?, ?);`,
        [truckId, stationId, incomingBatteryId, outgoingBatteryId, energyKwh, new Date().toISOString()]
      );

      await runSimulationCycle();

      const receipt = await getQuery<{ vat: number; energyCharge: number; serviceCharge: number }>(
        "SELECT vat, energyCharge, serviceCharge FROM receipts WHERE swapId = ?;",
        [swapResult.lastID]
      );

      expect(receipt?.vat).toBeCloseTo(expectedVat, 2);
      expect(receipt?.vat).toBeCloseTo((receipt?.energyCharge ?? 0 + (receipt?.serviceCharge ?? 0)) * 0.15, 2);
    });
  });

  describe("Share Split Correctness", () => {
    it("splits VAT 50/50 between EEU and A2", async () => {
      await runQuery(
        "INSERT OR REPLACE INTO tariff_config (id, eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent) VALUES (1, 10, 10, 15);"
      );

      // Create required entities
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
          currentSoc: 30,
          currentStationId: stationId,
        });
      const truckId = truck.body.truck.id;

      // Create outgoing battery (in truck)
      const outgoingBattery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 30,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "IN_TRUCK",
          truckId,
        });
      const outgoingBatteryId = outgoingBattery.body.battery.id;

      // Create incoming battery (at station)
      const incomingBattery = await request(app)
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
      const incomingBatteryId = incomingBattery.body.battery.id;

      const energyKwh = 200;
      const swapResult = await runQuery(
        `INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, ?, ?);`,
        [truckId, stationId, incomingBatteryId, outgoingBatteryId, energyKwh, new Date().toISOString()]
      );

      await runSimulationCycle();

      const receipt = await getQuery<{
        energyCharge: number;
        serviceCharge: number;
        vat: number;
        eeuShare: number;
        a2Share: number;
        total: number;
      }>("SELECT energyCharge, serviceCharge, vat, eeuShare, a2Share, total FROM receipts WHERE swapId = ?;", [
        swapResult.lastID,
      ]);

      // EEU share = energyCharge + vat/2
      const expectedEeuShare = (receipt?.energyCharge ?? 0) + (receipt?.vat ?? 0) / 2;
      expect(receipt?.eeuShare).toBeCloseTo(expectedEeuShare, 2);

      // A2 share = serviceCharge + vat/2
      const expectedA2Share = (receipt?.serviceCharge ?? 0) + (receipt?.vat ?? 0) / 2;
      expect(receipt?.a2Share).toBeCloseTo(expectedA2Share, 2);

      // Total = EEU share + A2 share
      expect((receipt?.eeuShare ?? 0) + (receipt?.a2Share ?? 0)).toBeCloseTo(receipt?.total ?? 0, 2);
    });
  });

  describe("Station Daily/Monthly Summaries", () => {
    it("calculates station revenue correctly for daily timeframe", async () => {
      await runQuery(
        "INSERT OR REPLACE INTO tariff_config (id, eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent) VALUES (1, 10, 10, 15);"
      );

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
          currentSoc: 30,
          currentStationId: stationId,
        });
      const truckId = truck.body.truck.id;

      // Create outgoing battery (in truck)
      const outgoingBattery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 30,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "IN_TRUCK",
          truckId,
        });
      const outgoingBatteryId = outgoingBattery.body.battery.id;

      // Create incoming battery (at station)
      const incomingBattery = await request(app)
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
      const incomingBatteryId = incomingBattery.body.battery.id;

      // Create swap transaction
      const energyDeliveredKwh = 294;
      const swapResult = await runQuery(
        `INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, ?, ?);`,
        [truckId, stationId, incomingBatteryId, outgoingBatteryId, energyDeliveredKwh, new Date().toISOString()]
      );

      await runSimulationCycle();

      // Get station summary
      const summaryResponse = await request(app)
        .get(`/billing/summary/stations?timeframe=daily`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(summaryResponse.status).toBe(200);
      const stationSummary = summaryResponse.body.revenueByStation.find(
        (s: { stationId: number }) => s.stationId === stationId
      );

      expect(stationSummary).not.toBeUndefined();
      expect(stationSummary.totalReceipts).toBe(1);
      expect(stationSummary.totalEnergyKwh).toBe(294);
      expect(stationSummary.totalRevenueEtb).toBeGreaterThan(0);
    });
  });

  describe("Fleet Cost Correctness", () => {
    it("calculates fleet energy cost correctly", async () => {
      await runQuery(
        "INSERT OR REPLACE INTO tariff_config (id, eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent) VALUES (1, 10, 10, 15);"
      );

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
          currentSoc: 30,
          currentStationId: stationId,
        });
      const truckId = truck.body.truck.id;

      // Create outgoing battery (in truck)
      const outgoingBattery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 30,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "IN_TRUCK",
          truckId,
        });
      const outgoingBatteryId = outgoingBattery.body.battery.id;

      // Create incoming battery (at station)
      const incomingBattery = await request(app)
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
      const incomingBatteryId = incomingBattery.body.battery.id;

      // Create swap transaction
      const energyDeliveredKwh = 294;
      await runQuery(
        `INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, ?, ?);`,
        [truckId, stationId, incomingBatteryId, outgoingBatteryId, energyDeliveredKwh, new Date().toISOString()]
      );

      await runSimulationCycle();

      // Get fleet summary
      const fleetUser = await request(app).post("/auth/register").send({
        name: "Fleet Owner",
        email: "fleet@test.com",
        password: "password",
        role: "FLEET_OWNER",
        organizationId: String(fleetId),
      });
      const fleetToken = fleetUser.body.token;

      const summaryResponse = await request(app)
        .get(`/billing/summary/fleets?timeframe=daily`)
        .set("Authorization", `Bearer ${fleetToken}`);

      expect(summaryResponse.status).toBe(200);
      const fleetSummary = summaryResponse.body.revenueByFleet.find(
        (f: { fleetId: number }) => f.fleetId === fleetId
      );

      expect(fleetSummary).not.toBeUndefined();
      expect(fleetSummary.energyCostEtb).toBeGreaterThan(0);
      expect(fleetSummary.energyCostEtb).toBe(fleetSummary.totalRevenueEtb); // Fleet pays full receipt total
    });
  });

  describe("A2 and EEU Totals Reconciliation", () => {
    it("A2 totals reconcile against receipts", async () => {
      await runQuery(
        "INSERT OR REPLACE INTO tariff_config (id, eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent) VALUES (1, 10, 10, 15);"
      );

      // Create required entities
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
          currentSoc: 30,
          currentStationId: stationId,
        });
      const truckId = truck.body.truck.id;

      // Create batteries for swaps
      const batteries: number[] = [];
      for (let i = 0; i < 6; i++) {
        const battery = await request(app)
          .post("/batteries")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            capacityKwh: 588,
            soc: i < 3 ? 30 : 80, // First 3 are outgoing (in truck), last 3 are incoming (at station)
            health: 95,
            cycleCount: 100,
            temperature: 28,
            status: i < 3 ? "IN_TRUCK" : "READY",
            truckId: i < 3 ? truckId : undefined,
            stationId: i < 3 ? undefined : stationId,
          });
        batteries.push(battery.body.battery.id);
      }

      // Create multiple swaps
      for (let i = 0; i < 3; i++) {
        const energyKwh = 100 + i * 50;
        await runQuery(
          `INSERT INTO swap_transactions 
           (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
           VALUES (?, ?, ?, ?, 30, ?, ?);`,
          [truckId, stationId, batteries[3 + i], batteries[i], energyKwh, new Date().toISOString()]
        );
      }

      await runSimulationCycle();

      // Get A2 summary
      const a2Response = await request(app)
        .get("/billing/summary/a2?timeframe=daily")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(a2Response.status).toBe(200);
      const a2Total = a2Response.body.totalA2ShareEtb;

      // Get sum from receipts
      const receiptsSum = await getQuery<{ total: number }>(
        "SELECT COALESCE(SUM(a2Share), 0) as total FROM receipts WHERE date(timestamp, 'localtime') = date('now', 'localtime');"
      );

      expect(a2Total).toBeCloseTo(receiptsSum?.total ?? 0, 2);
    });

    it("EEU totals reconcile against receipts", async () => {
      await runQuery(
        "INSERT OR REPLACE INTO tariff_config (id, eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent) VALUES (1, 10, 10, 15);"
      );

      // Create required entities
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
          currentSoc: 30,
          currentStationId: stationId,
        });
      const truckId = truck.body.truck.id;

      // Create batteries for swaps
      const batteries: number[] = [];
      for (let i = 0; i < 6; i++) {
        const battery = await request(app)
          .post("/batteries")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            capacityKwh: 588,
            soc: i < 3 ? 30 : 80, // First 3 are outgoing (in truck), last 3 are incoming (at station)
            health: 95,
            cycleCount: 100,
            temperature: 28,
            status: i < 3 ? "IN_TRUCK" : "READY",
            truckId: i < 3 ? truckId : undefined,
            stationId: i < 3 ? undefined : stationId,
          });
        batteries.push(battery.body.battery.id);
      }

      // Create multiple swaps
      for (let i = 0; i < 3; i++) {
        const energyKwh = 100 + i * 50;
        await runQuery(
          `INSERT INTO swap_transactions 
           (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
           VALUES (?, ?, ?, ?, 30, ?, ?);`,
          [truckId, stationId, batteries[3 + i], batteries[i], energyKwh, new Date().toISOString()]
        );
      }

      await runSimulationCycle();

      // Get EEU summary
      const eeuUser = await request(app).post("/auth/register").send({
        name: "EEU Operator",
        email: "eeu@test.com",
        password: "password",
        role: "EEU_OPERATOR",
      });
      const eeuToken = eeuUser.body.token;

      const eeuResponse = await request(app)
        .get("/billing/summary/eeu?timeframe=daily")
        .set("Authorization", `Bearer ${eeuToken}`);

      expect(eeuResponse.status).toBe(200);
      const eeuTotal = eeuResponse.body.totalEeuShareEtb;

      // Get sum from receipts
      const receiptsSum = await getQuery<{ total: number }>(
        "SELECT COALESCE(SUM(eeuShare), 0) as total FROM receipts WHERE date(timestamp, 'localtime') = date('now', 'localtime');"
      );

      expect(eeuTotal).toBeCloseTo(receiptsSum?.total ?? 0, 2);
    });
  });
});

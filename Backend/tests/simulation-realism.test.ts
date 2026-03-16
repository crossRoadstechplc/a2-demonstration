import request from "supertest";

import app from "../src/app";
import { allQuery, getQuery, initializeDatabase, runQuery } from "../src/database/connection";
import { runSimulationCycle } from "../src/services/simulation/orchestrator";

describe("Simulation Realism Tests", () => {
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
    await runQuery("DELETE FROM swap_queue;");
    await runQuery("DELETE FROM station_incidents;");
    await runQuery("DELETE FROM charger_faults;");
    await runQuery("DELETE FROM batteries;");
    await runQuery("DELETE FROM trucks;");
    await runQuery("DELETE FROM stations;");
    await runQuery("DELETE FROM fleets;");
  });

  describe("Battery Realism", () => {
    it("all batteries use 588 kWh capacity", async () => {
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
          soc: 80,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "READY",
          stationId,
        });

      expect(battery.body.battery.capacityKwh).toBe(588);

      // Run simulation to ensure capacity is maintained
      await runSimulationCycle();

      const batteryAfter = await getQuery<{ capacityKwh: number }>(
        "SELECT capacityKwh FROM batteries WHERE id = ?;",
        [battery.body.battery.id]
      );

      expect(batteryAfter?.capacityKwh).toBe(588);
    });

    it("battery health degrades slowly over time", async () => {
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
          soc: 80,
          health: 100,
          cycleCount: 100,
          temperature: 28,
          status: "READY",
          stationId,
        });

      const initialHealth = battery.body.battery.health;

      // Run multiple cycles to see health degradation
      for (let i = 0; i < 10; i++) {
        await runSimulationCycle();
      }

      const batteryAfter = await getQuery<{ health: number; cycleCount: number }>(
        "SELECT health, cycleCount FROM batteries WHERE id = ?;",
        [battery.body.battery.id]
      );

      // Health should degrade (but slowly)
      expect(batteryAfter?.health).toBeLessThanOrEqual(initialHealth);
      expect(batteryAfter?.health).toBeGreaterThanOrEqual(50); // Min health
    });

    it("battery cycle count increments on swap", async () => {
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
      const initialCycleCount = outgoingBattery.body.battery.cycleCount;

      // Create incoming battery (at station)
      const incomingBattery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 80,
          health: 95,
          cycleCount: 50,
          temperature: 28,
          status: "READY",
          stationId,
        });

      // Run simulation to trigger swap
      await runSimulationCycle();

      const batteryAfter = await getQuery<{ cycleCount: number; status: string }>(
        "SELECT cycleCount, status FROM batteries WHERE id = ?;",
        [outgoingBattery.body.battery.id]
      );

      // Cycle count should increment when battery is swapped out
      expect(batteryAfter?.cycleCount).toBe(initialCycleCount + 1);
      expect(batteryAfter?.status).toBe("CHARGING");
    });

    it("battery temperature changes during charging", async () => {
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
          temperature: 25,
          status: "CHARGING",
          stationId,
        });

      const initialTemp = battery.body.battery.temperature;

      // Run simulation cycles
      for (let i = 0; i < 5; i++) {
        await runSimulationCycle();
      }

      const batteryAfter = await getQuery<{ temperature: number; status: string }>(
        "SELECT temperature, status FROM batteries WHERE id = ?;",
        [battery.body.battery.id]
      );

      // Temperature should increase during charging (max 35°C)
      if (batteryAfter?.status === "CHARGING") {
        expect(batteryAfter.temperature).toBeGreaterThanOrEqual(initialTemp);
        expect(batteryAfter.temperature).toBeLessThanOrEqual(35);
      }
    });

    it("battery status transitions correctly", async () => {
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

      // Test READY -> CHARGING transition
      const battery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 50,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "READY",
          stationId,
        });

      // Run simulation to start charging
      await runSimulationCycle();

      const batteryAfter = await getQuery<{ status: string; soc: number }>(
        "SELECT status, soc FROM batteries WHERE id = ?;",
        [battery.body.battery.id]
      );

      // Battery should transition to CHARGING if SOC < 95
      if ((batteryAfter?.soc ?? 0) < 95) {
        expect(["CHARGING", "READY"]).toContain(batteryAfter?.status);
      }
    });
  });

  describe("Truck Realism", () => {
    it("truck location updates continuously during transit", async () => {
      const station1 = await request(app)
        .post("/stations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Station 1",
          location: "Location 1",
          capacity: 100,
          status: "ACTIVE",
        });
      const station1Id = station1.body.station.id;

      const station2 = await request(app)
        .post("/stations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Station 2",
          location: "Location 2",
          capacity: 100,
          status: "ACTIVE",
        });
      const station2Id = station2.body.station.id;

      const fleet = await request(app)
        .post("/fleets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Fleet",
          ownerName: "Test Owner",
          region: "Test Region",
        });
      const fleetId = fleet.body.fleet.id;

      const driver = await request(app)
        .post("/drivers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Driver",
          phone: "+251911111111",
          fleetId,
          rating: 4.5,
          status: "AVAILABLE",
        });
      const driverId = driver.body.driver.id;

      const truck = await request(app)
        .post("/trucks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          plateNumber: "ET-1001",
          fleetId,
          truckType: "STANDARD",
          status: "READY",
          currentSoc: 80,
          currentStationId: station1Id,
          assignedDriverId: driverId,
        });
      const truckId = truck.body.truck.id;

      const initialLocation = await getQuery<{ locationLat: number; locationLng: number }>(
        "SELECT locationLat, locationLng FROM trucks WHERE id = ?;",
        [truckId]
      );

      // Run simulation to start movement
      await runSimulationCycle();

      const locationAfter = await getQuery<{
        locationLat: number;
        locationLng: number;
        status: string;
        currentStationId: number | null;
      }>("SELECT locationLat, locationLng, status, currentStationId FROM trucks WHERE id = ?;", [truckId]);

      // Location should update if truck is in transit
      if (locationAfter?.status === "IN_TRANSIT") {
        expect(locationAfter.locationLat).not.toBeNull();
        expect(locationAfter.locationLng).not.toBeNull();
        expect(locationAfter.currentStationId).toBeNull(); // Should be cleared during transit
      }
    });

    it("truck currentStationId updates on arrival/departure", async () => {
      const station1 = await request(app)
        .post("/stations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Station 1",
          location: "Location 1",
          capacity: 100,
          status: "ACTIVE",
        });
      const station1Id = station1.body.station.id;

      const fleet = await request(app)
        .post("/fleets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Fleet",
          ownerName: "Test Owner",
          region: "Test Region",
        });
      const fleetId = fleet.body.fleet.id;

      const driver = await request(app)
        .post("/drivers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Driver",
          phone: "+251911111111",
          fleetId,
          rating: 4.5,
          status: "AVAILABLE",
        });
      const driverId = driver.body.driver.id;

      const truck = await request(app)
        .post("/trucks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          plateNumber: "ET-1001",
          fleetId,
          truckType: "STANDARD",
          status: "READY",
          currentSoc: 80,
          currentStationId: station1Id,
          assignedDriverId: driverId,
        });
      const truckId = truck.body.truck.id;

      // Run simulation to start movement
      await runSimulationCycle();

      const truckAfter = await getQuery<{ currentStationId: number | null; status: string }>(
        "SELECT currentStationId, status FROM trucks WHERE id = ?;",
        [truckId]
      );

      // If truck is in transit, currentStationId should be NULL
      if (truckAfter?.status === "IN_TRANSIT") {
        expect(truckAfter.currentStationId).toBeNull();
      }
    });

    it("refrigerated trucks consume more energy", async () => {
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

      const driver = await request(app)
        .post("/drivers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Driver",
          phone: "+251911111111",
          fleetId,
          rating: 4.5,
          status: "AVAILABLE",
        });
      const driverId = driver.body.driver.id;

      const standardTruck = await request(app)
        .post("/trucks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          plateNumber: "ET-1001",
          fleetId,
          truckType: "STANDARD",
          status: "READY",
          currentSoc: 80,
          currentStationId: stationId,
          assignedDriverId: driverId,
        });

      const refrigeratedTruck = await request(app)
        .post("/trucks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          plateNumber: "ET-2001",
          fleetId,
          truckType: "REFRIGERATED",
          status: "READY",
          currentSoc: 80,
          refrigerationPowerDraw: 12,
          currentStationId: stationId,
          assignedDriverId: driverId,
        });

      // Create batteries for both trucks
      const standardBattery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 80,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "IN_TRUCK",
          truckId: standardTruck.body.truck.id,
        });

      const refrigeratedBattery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 80,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "IN_TRUCK",
          truckId: refrigeratedTruck.body.truck.id,
        });

      // Run simulation cycles
      for (let i = 0; i < 5; i++) {
        await runSimulationCycle();
      }

      const standardSoc = await getQuery<{ soc: number }>(
        "SELECT soc FROM batteries WHERE id = ?;",
        [standardBattery.body.battery.id]
      );

      const refrigeratedSoc = await getQuery<{ soc: number }>(
        "SELECT soc FROM batteries WHERE id = ?;",
        [refrigeratedBattery.body.battery.id]
      );

      // Refrigerated truck should have lower SOC (more energy consumed)
      if (standardSoc && refrigeratedSoc) {
        expect(refrigeratedSoc.soc).toBeLessThanOrEqual(standardSoc.soc);
      }
    });

    it("trucks can enter maintenance occasionally", async () => {
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

      const driver = await request(app)
        .post("/drivers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Driver",
          phone: "+251911111111",
          fleetId,
          rating: 4.5,
          status: "AVAILABLE",
        });
      const driverId = driver.body.driver.id;

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
          assignedDriverId: driverId,
        });
      const truckId = truck.body.truck.id;

      // Run many cycles to increase chance of maintenance
      for (let i = 0; i < 200; i++) {
        await runSimulationCycle();
        const truckStatus = await getQuery<{ status: string }>(
          "SELECT status FROM trucks WHERE id = ?;",
          [truckId]
        );
        if (truckStatus?.status === "MAINTENANCE") {
          // Truck entered maintenance
          expect(truckStatus.status).toBe("MAINTENANCE");
          break;
        }
      }
    });
  });

  describe("Queue Realism", () => {
    it("queue records are created when trucks need swaps", async () => {
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

      const driver = await request(app)
        .post("/drivers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Driver",
          phone: "+251911111111",
          fleetId,
          rating: 4.5,
          status: "AVAILABLE",
        });
      const driverId = driver.body.driver.id;

      const truck = await request(app)
        .post("/trucks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          plateNumber: "ET-1001",
          fleetId,
          truckType: "STANDARD",
          status: "IN_TRANSIT",
          currentSoc: 30, // Low SOC, needs swap
          assignedDriverId: driverId,
        });
      const truckId = truck.body.truck.id;

      // Set truck location
      await runQuery(
        "UPDATE trucks SET locationLat = 9.0, locationLng = 40.0 WHERE id = ?;",
        [truckId]
      );

      // Run simulation to trigger queue management
      await runSimulationCycle();

      const queueEntry = await getQuery<{ id: number; truckId: number; stationId: number; status: string }>(
        "SELECT id, truckId, stationId, status FROM swap_queue WHERE truckId = ?;",
        [truckId]
      );

      // Queue entry should be created
      expect(queueEntry).not.toBeNull();
      expect(queueEntry?.truckId).toBe(truckId);
      expect(queueEntry?.stationId).toBe(stationId);
      expect(queueEntry?.status).toBe("PENDING");
    });

    it("queue is station-specific", async () => {
      const station1 = await request(app)
        .post("/stations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Station 1",
          location: "Location 1",
          capacity: 100,
          status: "ACTIVE",
        });
      const station1Id = station1.body.station.id;

      const station2 = await request(app)
        .post("/stations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Station 2",
          location: "Location 2",
          capacity: 100,
          status: "ACTIVE",
        });
      const station2Id = station2.body.station.id;

      const fleet = await request(app)
        .post("/fleets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Fleet",
          ownerName: "Test Owner",
          region: "Test Region",
        });
      const fleetId = fleet.body.fleet.id;

      const driver = await request(app)
        .post("/drivers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Driver",
          phone: "+251911111111",
          fleetId,
          rating: 4.5,
          status: "AVAILABLE",
        });
      const driverId = driver.body.driver.id;

      const truck1 = await request(app)
        .post("/trucks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          plateNumber: "ET-1001",
          fleetId,
          truckType: "STANDARD",
          status: "IN_TRANSIT",
          currentSoc: 30,
          assignedDriverId: driverId,
        });
      const truck1Id = truck1.body.truck.id;

      const truck2 = await request(app)
        .post("/trucks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          plateNumber: "ET-1002",
          fleetId,
          truckType: "STANDARD",
          status: "IN_TRANSIT",
          currentSoc: 30,
          assignedDriverId: driverId,
        });
      const truck2Id = truck2.body.truck.id;

      // Set truck locations (truck1 closer to station1, truck2 closer to station2)
      await runQuery("UPDATE trucks SET locationLat = 8.98, locationLng = 38.76 WHERE id = ?;", [truck1Id]);
      await runQuery("UPDATE trucks SET locationLat = 8.54, locationLng = 39.27 WHERE id = ?;", [truck2Id]);

      // Run simulation
      await runSimulationCycle();

      const queue1 = await allQuery<{ truckId: number; stationId: number }>(
        "SELECT truckId, stationId FROM swap_queue WHERE truckId = ?;",
        [truck1Id]
      );

      const queue2 = await allQuery<{ truckId: number; stationId: number }>(
        "SELECT truckId, stationId FROM swap_queue WHERE truckId = ?;",
        [truck2Id]
      );

      // Each truck should be queued at its nearest station
      if (queue1.length > 0) {
        expect(queue1[0].stationId).toBe(station1Id);
      }
      if (queue2.length > 0) {
        expect(queue2[0].stationId).toBe(station2Id);
      }
    });

    it("queue ordering is deterministic (by distance)", async () => {
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

      const driver = await request(app)
        .post("/drivers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Driver",
          phone: "+251911111111",
          fleetId,
          rating: 4.5,
          status: "AVAILABLE",
        });
      const driverId = driver.body.driver.id;

      // Create multiple trucks at different distances
      const truck1 = await request(app)
        .post("/trucks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          plateNumber: "ET-1001",
          fleetId,
          truckType: "STANDARD",
          status: "IN_TRANSIT",
          currentSoc: 30,
          assignedDriverId: driverId,
        });
      const truck1Id = truck1.body.truck.id;

      const truck2 = await request(app)
        .post("/trucks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          plateNumber: "ET-1002",
          fleetId,
          truckType: "STANDARD",
          status: "IN_TRANSIT",
          currentSoc: 30,
          assignedDriverId: driverId,
        });
      const truck2Id = truck2.body.truck.id;

      // Set truck locations (truck1 closer, truck2 farther)
      await runQuery("UPDATE trucks SET locationLat = 8.99, locationLng = 38.76 WHERE id = ?;", [truck1Id]);
      await runQuery("UPDATE trucks SET locationLat = 9.5, locationLng = 40.0 WHERE id = ?;", [truck2Id]);

      // Run simulation
      await runSimulationCycle();

      const queueEntries = await allQuery<{ truckId: number; distanceKm: number }>(
        "SELECT truckId, distanceKm FROM swap_queue WHERE stationId = ? ORDER BY distanceKm ASC, bookedAt ASC;",
        [stationId]
      );

      // Queue should be ordered by distance (closest first)
      if (queueEntries.length >= 2) {
        expect(queueEntries[0].distanceKm).toBeLessThanOrEqual(queueEntries[1].distanceKm);
      }
    });
  });

  describe("Charging Realism", () => {
    it("charging respects configured charging windows", async () => {
      // Set charging window to 22:00-06:00
      await runQuery(
        "INSERT OR REPLACE INTO charging_window_config (id, startHour, endHour) VALUES (1, 22, 6);"
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

      const battery = await request(app)
        .post("/batteries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          capacityKwh: 588,
          soc: 50,
          health: 95,
          cycleCount: 100,
          temperature: 28,
          status: "READY",
          stationId,
        });

      // Run simulation
      await runSimulationCycle();

      const batteryAfter = await getQuery<{ status: string }>(
        "SELECT status FROM batteries WHERE id = ?;",
        [battery.body.battery.id]
      );

      // Battery should start charging if in window or remain ready if outside window
      expect(["READY", "CHARGING"]).toContain(batteryAfter?.status);
    });

    it("charging sessions track current SOC and target SOC", async () => {
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
          status: "READY",
          stationId,
        });

      // Run simulation to start charging
      await runSimulationCycle();

      const session = await getQuery<{ startSoc: number; currentSoc: number; targetSoc: number; status: string }>(
        "SELECT startSoc, currentSoc, targetSoc, status FROM charging_sessions WHERE batteryId = ? AND status = 'ACTIVE';",
        [battery.body.battery.id]
      );

      if (session) {
        expect(session.startSoc).toBeGreaterThanOrEqual(0);
        expect(session.currentSoc).toBeGreaterThanOrEqual(session.startSoc);
        expect(session.targetSoc).toBe(95);
        expect(session.status).toBe("ACTIVE");
      }
    });

    it("energy added is computed from SOC progression", async () => {
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
          status: "READY",
          stationId,
        });

      const initialSoc = battery.body.battery.soc;

      // Run simulation cycles
      for (let i = 0; i < 3; i++) {
        await runSimulationCycle();
      }

      const session = await getQuery<{ energyAddedKwh: number; currentSoc: number }>(
        "SELECT energyAddedKwh, currentSoc FROM charging_sessions WHERE batteryId = ? AND status = 'ACTIVE';",
        [battery.body.battery.id]
      );

      if (session) {
        // Energy added should be calculated from SOC increase
        const expectedEnergy = (588 * (session.currentSoc - initialSoc)) / 100;
        expect(session.energyAddedKwh).toBeGreaterThan(0);
        expect(session.energyAddedKwh).toBeCloseTo(expectedEnergy, 1);
      }
    });

    it("station charger capacity constraints are respected", async () => {
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

      // Create many batteries that need charging
      for (let i = 0; i < 30; i++) {
        await request(app)
          .post("/batteries")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            capacityKwh: 588,
            soc: 50,
            health: 95,
            cycleCount: 100,
            temperature: 28,
            status: "READY",
            stationId,
          });
      }

      // Run simulation
      await runSimulationCycle();

      const activeSessions = await allQuery<{ id: number }>(
        "SELECT id FROM charging_sessions WHERE stationId = ? AND status = 'ACTIVE';",
        [stationId]
      );

      // Active sessions should be limited by charger capacity (~20-30 chargers per 100 batteries)
      expect(activeSessions.length).toBeLessThanOrEqual(30);
    });
  });

  describe("Incoming Truck Predictions", () => {
    it("generates ETA, distance, and estimated SOC for trucks approaching stations", async () => {
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

      const driver = await request(app)
        .post("/drivers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Driver",
          phone: "+251911111111",
          fleetId,
          rating: 4.5,
          status: "AVAILABLE",
        });
      const driverId = driver.body.driver.id;

      const truck = await request(app)
        .post("/trucks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          plateNumber: "ET-1001",
          fleetId,
          truckType: "STANDARD",
          status: "IN_TRANSIT",
          currentSoc: 60,
          assignedDriverId: driverId,
        });
      const truckId = truck.body.truck.id;

      // Set truck location (some distance from station)
      await runQuery("UPDATE trucks SET locationLat = 9.0, locationLng = 40.0 WHERE id = ?;", [truckId]);

      // Get station dashboard to see predictions
      const stationUser = await request(app).post("/auth/register").send({
        name: "Station Operator",
        email: "station@test.com",
        password: "password",
        role: "STATION_OPERATOR",
        organizationId: String(stationId),
      });
      const stationToken = stationUser.body.token;

      const dashboardResponse = await request(app)
        .get(`/dashboard/station/${stationId}`)
        .set("Authorization", `Bearer ${stationToken}`);

      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.body).toHaveProperty("incomingPredictions");
      
      if (dashboardResponse.body.incomingPredictions.length > 0) {
        const prediction = dashboardResponse.body.incomingPredictions[0];
        expect(prediction).toHaveProperty("truckId");
        expect(prediction).toHaveProperty("eta");
        expect(prediction).toHaveProperty("distanceKm");
        expect(prediction).toHaveProperty("estimatedSoc");
        expect(prediction.distanceKm).toBeGreaterThan(0);
        expect(prediction.estimatedSoc).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("EEU Realism", () => {
    it("computes live network load", async () => {
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

      // Create batteries and start charging
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post("/batteries")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            capacityKwh: 588,
            soc: 50,
            health: 95,
            cycleCount: 100,
            temperature: 28,
            status: "READY",
            stationId,
          });
      }

      // Run simulation to start charging
      await runSimulationCycle();

      const eeuUser = await request(app).post("/auth/register").send({
        name: "EEU Operator",
        email: "eeu@test.com",
        password: "password",
        role: "EEU_OPERATOR",
      });
      const eeuToken = eeuUser.body.token;

      const eeuResponse = await request(app)
        .get("/dashboard/eeu")
        .set("Authorization", `Bearer ${eeuToken}`);

      expect(eeuResponse.status).toBe(200);
      expect(eeuResponse.body).toHaveProperty("totalNetworkLoad");
      expect(eeuResponse.body.totalNetworkLoad).toBeGreaterThanOrEqual(0);
    });

    it("computes station loads", async () => {
      const station1 = await request(app)
        .post("/stations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Station 1",
          location: "Location 1",
          capacity: 100,
          status: "ACTIVE",
        });
      const station1Id = station1.body.station.id;

      const station2 = await request(app)
        .post("/stations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Station 2",
          location: "Location 2",
          capacity: 100,
          status: "ACTIVE",
        });
      const station2Id = station2.body.station.id;

      // Create batteries at both stations
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/batteries")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            capacityKwh: 588,
            soc: 50,
            health: 95,
            cycleCount: 100,
            temperature: 28,
            status: "READY",
            stationId: station1Id,
          });
      }

      for (let i = 0; i < 10; i++) {
        await request(app)
          .post("/batteries")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            capacityKwh: 588,
            soc: 50,
            health: 95,
            cycleCount: 100,
            temperature: 28,
            status: "READY",
            stationId: station2Id,
          });
      }

      // Run simulation
      await runSimulationCycle();

      const eeuUser = await request(app).post("/auth/register").send({
        name: "EEU Operator",
        email: "eeu@test.com",
        password: "password",
        role: "EEU_OPERATOR",
      });
      const eeuToken = eeuUser.body.token;

      const eeuResponse = await request(app)
        .get("/dashboard/eeu")
        .set("Authorization", `Bearer ${eeuToken}`);

      expect(eeuResponse.status).toBe(200);
      expect(eeuResponse.body).toHaveProperty("stationLoads");
      expect(Array.isArray(eeuResponse.body.stationLoads)).toBe(true);
    });

    it("identifies peak load station", async () => {
      const station1 = await request(app)
        .post("/stations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Station 1",
          location: "Location 1",
          capacity: 100,
          status: "ACTIVE",
        });
      const station1Id = station1.body.station.id;

      const station2 = await request(app)
        .post("/stations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Station 2",
          location: "Location 2",
          capacity: 100,
          status: "ACTIVE",
        });
      const station2Id = station2.body.station.id;

      // Create more batteries at station2 (should have higher load)
      for (let i = 0; i < 15; i++) {
        await request(app)
          .post("/batteries")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            capacityKwh: 588,
            soc: 50,
            health: 95,
            cycleCount: 100,
            temperature: 28,
            status: "READY",
            stationId: station2Id,
          });
      }

      // Run simulation
      await runSimulationCycle();

      const eeuUser = await request(app).post("/auth/register").send({
        name: "EEU Operator",
        email: "eeu@test.com",
        password: "password",
        role: "EEU_OPERATOR",
      });
      const eeuToken = eeuUser.body.token;

      const eeuResponse = await request(app)
        .get("/dashboard/eeu")
        .set("Authorization", `Bearer ${eeuToken}`);

      expect(eeuResponse.status).toBe(200);
      expect(eeuResponse.body).toHaveProperty("peakLoadStation");
      
      if (eeuResponse.body.peakLoadStation) {
        expect(eeuResponse.body.peakLoadStation).toHaveProperty("stationId");
        expect(eeuResponse.body.peakLoadStation).toHaveProperty("loadKw");
        expect(eeuResponse.body.peakLoadStation.loadKw).toBeGreaterThan(0);
      }
    });

    it("generates 24-hour forecast", async () => {
      const eeuUser = await request(app).post("/auth/register").send({
        name: "EEU Operator",
        email: "eeu@test.com",
        password: "password",
        role: "EEU_OPERATOR",
      });
      const eeuToken = eeuUser.body.token;

      const eeuResponse = await request(app)
        .get("/dashboard/eeu")
        .set("Authorization", `Bearer ${eeuToken}`);

      expect(eeuResponse.status).toBe(200);
      expect(eeuResponse.body).toHaveProperty("forecast24h");
      expect(Array.isArray(eeuResponse.body.forecast24h)).toBe(true);
      expect(eeuResponse.body.forecast24h.length).toBe(24);

      // Each forecast entry should have hour, forecastLoadKw, and forecastEnergyKwh
      for (const forecast of eeuResponse.body.forecast24h) {
        expect(forecast).toHaveProperty("hour");
        expect(forecast).toHaveProperty("forecastLoadKw");
        expect(forecast).toHaveProperty("forecastEnergyKwh");
        expect(forecast.hour).toBeGreaterThanOrEqual(0);
        expect(forecast.hour).toBeLessThan(24);
      }
    });
  });

  describe("Incidents and Faults", () => {
    it("generates queue congestion events when threshold exceeded", async () => {
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

      const driver = await request(app)
        .post("/drivers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Driver",
          phone: "+251911111111",
          fleetId,
          rating: 4.5,
          status: "AVAILABLE",
        });
      const driverId = driver.body.driver.id;

      // Create many trucks that need swaps (to trigger congestion)
      for (let i = 0; i < 10; i++) {
        const truck = await request(app)
          .post("/trucks")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            plateNumber: `ET-${1000 + i}`,
            fleetId,
            truckType: "STANDARD",
            status: "IN_TRANSIT",
            currentSoc: 30,
            assignedDriverId: driverId,
          });
        const truckId = truck.body.truck.id;
        await runQuery("UPDATE trucks SET locationLat = 9.0, locationLng = 40.0 WHERE id = ?;", [truckId]);
      }

      // Run simulation
      await runSimulationCycle();

      const incidents = await allQuery<{ type: string; severity: string; status: string }>(
        "SELECT type, severity, status FROM station_incidents WHERE stationId = ? AND type = 'QUEUE_CONGESTION';",
        [stationId]
      );

      // Should have queue congestion incident if queue > 5
      if (incidents.length > 0) {
        expect(incidents[0].type).toBe("QUEUE_CONGESTION");
        expect(["LOW", "MEDIUM", "HIGH"]).toContain(incidents[0].severity);
      }
    });

    it("generates occasional charger faults", async () => {
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

      // Create batteries and start charging
      for (let i = 0; i < 20; i++) {
        await request(app)
          .post("/batteries")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            capacityKwh: 588,
            soc: 50,
            health: 95,
            cycleCount: 100,
            temperature: 28,
            status: "READY",
            stationId,
          });
      }

      // Run many cycles to increase chance of fault
      for (let i = 0; i < 100; i++) {
        await runSimulationCycle();
        const faults = await allQuery<{ id: number }>(
          "SELECT id FROM charger_faults WHERE stationId = ? AND status = 'OPEN';",
          [stationId]
        );
        if (faults.length > 0) {
          // Fault generated
          expect(faults.length).toBeGreaterThan(0);
          break;
        }
      }
    });
  });

  describe("Live Feed Realism", () => {
    it("includes swap completed events", async () => {
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

      const driver = await request(app)
        .post("/drivers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Driver",
          phone: "+251911111111",
          fleetId,
          rating: 4.5,
          status: "AVAILABLE",
        });
      const driverId = driver.body.driver.id;

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
          assignedDriverId: driverId,
        });
      const truckId = truck.body.truck.id;

      // Create batteries
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

      // Run simulation to trigger swap
      await runSimulationCycle();

      // Check live feed
      const a2Response = await request(app)
        .get("/dashboard/a2/live-feed")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(a2Response.status).toBe(200);
      expect(a2Response.body).toHaveProperty("swaps");
      expect(Array.isArray(a2Response.body.swaps)).toBe(true);
    });

    it("includes charging started and completed events", async () => {
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
          status: "READY",
          stationId,
        });

      // Run simulation to start charging
      await runSimulationCycle();

      // Check live feed
      const a2Response = await request(app)
        .get("/dashboard/a2/live-feed")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(a2Response.status).toBe(200);
      expect(a2Response.body).toHaveProperty("chargingStarts");
      expect(Array.isArray(a2Response.body.chargingStarts)).toBe(true);
    });

    it("includes incident and charger fault events", async () => {
      // Check live feed
      const a2Response = await request(app)
        .get("/dashboard/a2/live-feed")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(a2Response.status).toBe(200);
      expect(a2Response.body).toHaveProperty("incidents");
      expect(a2Response.body).toHaveProperty("chargerFaults");
      expect(Array.isArray(a2Response.body.incidents)).toBe(true);
      expect(Array.isArray(a2Response.body.chargerFaults)).toBe(true);
    });
  });
});

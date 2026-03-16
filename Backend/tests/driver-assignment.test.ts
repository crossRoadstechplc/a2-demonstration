import request from "supertest";

import app from "../src/app";
import { initializeDatabase, runQuery } from "../src/database/connection";

describe("Driver self truck assignment", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await runQuery("DELETE FROM battery_events;");
    await runQuery("DELETE FROM truck_arrivals;");
    await runQuery("DELETE FROM shipment_events;");
    await runQuery("DELETE FROM station_incidents;");
    await runQuery("DELETE FROM charger_faults;");
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
    await runQuery("DELETE FROM users;");
  });

  async function registerDriverUser(driverId: number) {
    const registerResponse = await request(app).post("/auth/register").send({
      name: "Driver User",
      email: `driver-${driverId}@example.com`,
      password: "secret123",
      role: "DRIVER",
      organizationId: String(driverId)
    });

    return registerResponse.body.token as string;
  }

  async function createFleet(name: string): Promise<number> {
    const fleetResponse = await request(app).post("/fleets").send({
      name,
      ownerName: "Owner",
      region: "Addis Ababa"
    });
    return fleetResponse.body.fleet.id as number;
  }

  async function createDriver(fleetId: number, name: string): Promise<number> {
    const driverResponse = await request(app).post("/drivers").send({
      name,
      phone: `+2519${Math.floor(10000000 + Math.random() * 89999999)}`,
      fleetId,
      rating: 4.5,
      status: "AVAILABLE"
    });
    return driverResponse.body.driver.id as number;
  }

  async function createTruck(fleetId: number, plateNumber: string): Promise<number> {
    const truckResponse = await request(app).post("/trucks").send({
      plateNumber,
      fleetId,
      truckType: "STANDARD",
      batteryId: `BAT-${plateNumber}`,
      status: "READY",
      currentSoc: 80
    });
    return truckResponse.body.truck.id as number;
  }

  it("attaches truck by license plate for logged-in driver", async () => {
    const fleetId = await createFleet("Selam Transport");
    const driverId = await createDriver(fleetId, "Abel");
    await createTruck(fleetId, "ET-5555");
    const token = await registerDriverUser(driverId);

    const response = await request(app)
      .post("/drivers/me/attach-truck")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "et-5555" });

    expect(response.status).toBe(200);
    expect(response.body.driver.assignedTruckId).toBeTruthy();
    expect(response.body.truck.plateNumber).toBe("ET-5555");
    expect(response.body.truck.assignedDriverId).toBe(driverId);
  });

  it("blocks attach for truck from different fleet", async () => {
    const fleetA = await createFleet("Fleet A");
    const fleetB = await createFleet("Fleet B");
    const driverId = await createDriver(fleetA, "Biruk");
    await createTruck(fleetB, "ET-7777");
    const token = await registerDriverUser(driverId);

    const response = await request(app)
      .post("/drivers/me/attach-truck")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "ET-7777" });

    expect(response.status).toBe(403);
  });

  it("detaches current truck for logged-in driver", async () => {
    const fleetId = await createFleet("Fleet C");
    const driverId = await createDriver(fleetId, "Dawit");
    const truckId = await createTruck(fleetId, "ET-8888");
    const token = await registerDriverUser(driverId);

    await request(app)
      .post("/drivers/me/attach-truck")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "ET-8888" });

    const response = await request(app)
      .post("/drivers/me/detach-truck")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.driver.assignedTruckId).toBeNull();
    expect(response.body.truck.id).toBe(truckId);
    expect(response.body.truck.assignedDriverId).toBeNull();
  });
});

import request from "supertest";

import app from "../src/app";
import { initializeDatabase, runQuery } from "../src/database/connection";

describe("Billing engine", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await runQuery(
      "UPDATE tariff_config SET eeuRatePerKwh = 10, a2ServiceRatePerKwh = 10, vatPercent = 15 WHERE id = 1;"
    );
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

  async function runSwapForBilling(): Promise<{ swapId: number }> {
    const stationRes = await request(app).post("/stations").send({
      name: "Awash",
      location: "Awash",
      capacity: 20,
      status: "ACTIVE"
    });
    const stationId = stationRes.body.station.id as number;

    const fleetRes = await request(app).post("/fleets").send({
      name: "Habesha Freight",
      ownerName: "Birhanu Tesfaye",
      region: "Oromia"
    });
    const fleetId = fleetRes.body.fleet.id as number;

    const truckRes = await request(app).post("/trucks").send({
      plateNumber: "ET-8801",
      fleetId,
      truckType: "STANDARD",
      batteryId: "1",
      status: "READY",
      currentSoc: 30
    });
    const truckId = truckRes.body.truck.id as number;

    const outgoingBatteryRes = await request(app).post("/batteries").send({
      capacityKwh: 300,
      soc: 30,
      health: 95,
      cycleCount: 200,
      temperature: 31,
      status: "IN_TRUCK",
      truckId
    });
    const outgoingBatteryId = outgoingBatteryRes.body.battery.id as number;

    const incomingBatteryRes = await request(app).post("/batteries").send({
      capacityKwh: 300,
      soc: 90,
      health: 97,
      cycleCount: 60,
      temperature: 28,
      status: "READY",
      stationId
    });
    const incomingBatteryId = incomingBatteryRes.body.battery.id as number;

    const swapRes = await request(app).post("/swaps").send({
      truckId,
      stationId,
      incomingBatteryId,
      outgoingBatteryId,
      arrivalSoc: 20
    });

    return { swapId: swapRes.body.swap.id as number };
  }

  it("billing calculation correct", async () => {
    await runSwapForBilling();
    const receiptsRes = await request(app).get("/billing/receipts");
    const receipt = receiptsRes.body.receipts[0] as {
      energyKwh: number;
      energyCharge: number;
      serviceCharge: number;
      vat: number;
      total: number;
    };

    expect(receiptsRes.status).toBe(200);
    expect(receipt.energyKwh).toBe(210);
    expect(receipt.energyCharge).toBe(2100);
    expect(receipt.serviceCharge).toBe(2100);
    expect(receipt.vat).toBe(630);
    expect(receipt.total).toBe(4830);
  });

  it("revenue split correct", async () => {
    await runSwapForBilling();
    const receiptsRes = await request(app).get("/billing/receipts");
    const receipt = receiptsRes.body.receipts[0] as { eeuShare: number; a2Share: number };

    expect(receipt.eeuShare).toBe(2415);
    expect(receipt.a2Share).toBe(2415);
  });

  it("receipt created after swap", async () => {
    const { swapId } = await runSwapForBilling();
    const receiptsRes = await request(app).get("/billing/receipts");
    const receipt = receiptsRes.body.receipts[0] as { swapId: number };

    expect(receiptsRes.status).toBe(200);
    expect(receiptsRes.body.receipts.length).toBe(1);
    expect(receipt.swapId).toBe(swapId);
  });
});

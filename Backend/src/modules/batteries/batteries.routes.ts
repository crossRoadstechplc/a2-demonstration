import { Router } from "express";

import { allQuery, getQuery, runQuery } from "../../database/connection";

interface Battery {
  id: number;
  capacityKwh: number;
  soc: number;
  health: number;
  cycleCount: number;
  temperature: number;
  status: "READY" | "CHARGING" | "IN_TRUCK" | "MAINTENANCE";
  stationId: number | null;
  truckId: number | null;
}

interface BatteryEvent {
  id: number;
  eventType: string;
  details: string | null;
  timestamp: string;
}

const BATTERY_STATUSES = ["READY", "CHARGING", "IN_TRUCK", "MAINTENANCE"] as const;

function isValidBatteryStatus(status: string): status is Battery["status"] {
  return BATTERY_STATUSES.includes(status as Battery["status"]);
}

const batteriesRouter = Router();

async function addBatteryEvent(batteryId: number, eventType: string, details: string): Promise<void> {
  await runQuery(
    `
    INSERT INTO battery_events (batteryId, eventType, details, timestamp)
    VALUES (?, ?, ?, ?);
  `,
    [batteryId, eventType, details, new Date().toISOString()]
  );
}

batteriesRouter.post("/batteries", async (req, res, next) => {
  try {
    const {
      capacityKwh,
      soc,
      health,
      cycleCount,
      temperature,
      status,
      stationId,
      truckId
    } = req.body as {
      capacityKwh?: number;
      soc?: number;
      health?: number;
      cycleCount?: number;
      temperature?: number;
      status?: string;
      stationId?: number;
      truckId?: number;
    };

    if (
      capacityKwh === undefined ||
      soc === undefined ||
      health === undefined ||
      cycleCount === undefined ||
      temperature === undefined ||
      !status
    ) {
      res.status(400).json({
        error:
          "capacityKwh, soc, health, cycleCount, temperature and status are required"
      });
      return;
    }

    if (!isValidBatteryStatus(status)) {
      res.status(400).json({ error: "Invalid battery status" });
      return;
    }

    if (stationId !== undefined && truckId !== undefined) {
      res.status(400).json({ error: "Provide either stationId or truckId, not both" });
      return;
    }

    if (stationId !== undefined) {
      const station = await getQuery<{ id: number }>(
        "SELECT id FROM stations WHERE id = ?;",
        [stationId]
      );
      if (!station) {
        res.status(400).json({ error: "Invalid stationId" });
        return;
      }
    }

    if (truckId !== undefined) {
      const truck = await getQuery<{ id: number }>("SELECT id FROM trucks WHERE id = ?;", [
        truckId
      ]);
      if (!truck) {
        res.status(400).json({ error: "Invalid truckId" });
        return;
      }
    }

    const result = await runQuery(
      `
      INSERT INTO batteries
      (capacityKwh, soc, health, cycleCount, temperature, status, stationId, truckId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `,
      [
        capacityKwh,
        soc,
        health,
        cycleCount,
        temperature,
        status,
        stationId ?? null,
        truckId ?? null
      ]
    );
    const battery = await getQuery<Battery>("SELECT * FROM batteries WHERE id = ?;", [
      result.lastID
    ]);
    await addBatteryEvent(result.lastID, "CREATED", "Battery registered");
    res.status(201).json({ battery });
  } catch (error) {
    next(error);
  }
});

batteriesRouter.get("/batteries", async (_req, res, next) => {
  try {
    const batteries = await allQuery<Battery>("SELECT * FROM batteries ORDER BY id;");
    res.status(200).json({ batteries });
  } catch (error) {
    next(error);
  }
});

batteriesRouter.patch("/batteries/:id/soc", async (req, res, next) => {
  try {
    const batteryId = Number(req.params.id);
    const { soc } = req.body as { soc?: number };

    if (Number.isNaN(batteryId)) {
      res.status(400).json({ error: "Invalid battery id" });
      return;
    }

    if (soc === undefined || soc < 0 || soc > 100) {
      res.status(400).json({ error: "soc must be a number between 0 and 100" });
      return;
    }

    const existing = await getQuery<{ id: number }>("SELECT id FROM batteries WHERE id = ?;", [
      batteryId
    ]);
    if (!existing) {
      res.status(404).json({ error: "Battery not found" });
      return;
    }

    await runQuery("UPDATE batteries SET soc = ? WHERE id = ?;", [soc, batteryId]);
    await addBatteryEvent(batteryId, "SOC_UPDATED", `SOC updated to ${soc}`);
    const battery = await getQuery<Battery>("SELECT * FROM batteries WHERE id = ?;", [
      batteryId
    ]);
    res.status(200).json({ battery });
  } catch (error) {
    next(error);
  }
});

batteriesRouter.patch("/batteries/:id/assign-truck", async (req, res, next) => {
  try {
    const batteryId = Number(req.params.id);
    const { truckId } = req.body as { truckId?: number };

    if (Number.isNaN(batteryId) || truckId === undefined) {
      res.status(400).json({ error: "Valid battery id and truckId are required" });
      return;
    }

    const battery = await getQuery<{ id: number }>("SELECT id FROM batteries WHERE id = ?;", [
      batteryId
    ]);
    if (!battery) {
      res.status(404).json({ error: "Battery not found" });
      return;
    }

    const truck = await getQuery<{ id: number }>("SELECT id FROM trucks WHERE id = ?;", [
      truckId
    ]);
    if (!truck) {
      res.status(400).json({ error: "Invalid truckId" });
      return;
    }

    await runQuery(
      "UPDATE batteries SET truckId = ?, stationId = NULL, status = 'IN_TRUCK' WHERE id = ?;",
      [truckId, batteryId]
    );
    await addBatteryEvent(batteryId, "ASSIGNED_TRUCK", `Assigned to truck ${truckId}`);
    const updated = await getQuery<Battery>("SELECT * FROM batteries WHERE id = ?;", [batteryId]);
    res.status(200).json({ battery: updated });
  } catch (error) {
    next(error);
  }
});

batteriesRouter.patch("/batteries/:id/assign-station", async (req, res, next) => {
  try {
    const batteryId = Number(req.params.id);
    const { stationId } = req.body as { stationId?: number };

    if (Number.isNaN(batteryId) || stationId === undefined) {
      res.status(400).json({ error: "Valid battery id and stationId are required" });
      return;
    }

    const battery = await getQuery<{ id: number }>("SELECT id FROM batteries WHERE id = ?;", [
      batteryId
    ]);
    if (!battery) {
      res.status(404).json({ error: "Battery not found" });
      return;
    }

    const station = await getQuery<{ id: number }>("SELECT id FROM stations WHERE id = ?;", [
      stationId
    ]);
    if (!station) {
      res.status(400).json({ error: "Invalid stationId" });
      return;
    }

    await runQuery(
      "UPDATE batteries SET stationId = ?, truckId = NULL, status = 'CHARGING' WHERE id = ?;",
      [stationId, batteryId]
    );
    await addBatteryEvent(batteryId, "ASSIGNED_STATION", `Assigned to station ${stationId}`);
    const updated = await getQuery<Battery>("SELECT * FROM batteries WHERE id = ?;", [batteryId]);
    res.status(200).json({ battery: updated });
  } catch (error) {
    next(error);
  }
});

batteriesRouter.get("/batteries/:id", async (req, res, next) => {
  try {
    const batteryId = Number(req.params.id);
    if (Number.isNaN(batteryId)) {
      res.status(400).json({ error: "Invalid battery id" });
      return;
    }

    const battery = await getQuery<Battery>("SELECT * FROM batteries WHERE id = ?;", [batteryId]);
    if (!battery) {
      res.status(404).json({ error: "Battery not found" });
      return;
    }

    const truck = battery.truckId
      ? await getQuery("SELECT id, plateNumber, status FROM trucks WHERE id = ?;", [battery.truckId])
      : null;
    const station = battery.stationId
      ? await getQuery("SELECT id, name, status FROM stations WHERE id = ?;", [battery.stationId])
      : null;

    res.status(200).json({ battery, truck, station });
  } catch (error) {
    next(error);
  }
});

batteriesRouter.get("/batteries/:id/history", async (req, res, next) => {
  try {
    const batteryId = Number(req.params.id);
    if (Number.isNaN(batteryId)) {
      res.status(400).json({ error: "Invalid battery id" });
      return;
    }

    const battery = await getQuery<{ id: number }>("SELECT id FROM batteries WHERE id = ?;", [
      batteryId
    ]);
    if (!battery) {
      res.status(404).json({ error: "Battery not found" });
      return;
    }

    const assignmentEvents = await allQuery<BatteryEvent>(
      `
      SELECT id, eventType, details, timestamp
      FROM battery_events
      WHERE batteryId = ?
      ORDER BY id DESC;
    `,
      [batteryId]
    );
    const chargingSessions = await allQuery(
      `
      SELECT id, stationId, startTime, endTime, energyAddedKwh, status
      FROM charging_sessions
      WHERE batteryId = ?
      ORDER BY id DESC;
    `,
      [batteryId]
    );
    const swapParticipation = await allQuery(
      `
      SELECT id, truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp
      FROM swap_transactions
      WHERE incomingBatteryId = ? OR outgoingBatteryId = ?
      ORDER BY id DESC;
    `,
      [batteryId, batteryId]
    );

    res.status(200).json({
      batteryId,
      assignmentChanges: assignmentEvents,
      socUpdates: assignmentEvents.filter((event) => event.eventType === "SOC_UPDATED"),
      chargingSessions,
      swapParticipation,
      maintenanceEvents: assignmentEvents.filter((event) => event.eventType === "MAINTENANCE")
    });
  } catch (error) {
    next(error);
  }
});

export default batteriesRouter;

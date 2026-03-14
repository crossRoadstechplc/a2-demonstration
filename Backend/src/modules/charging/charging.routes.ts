import { Router } from "express";

import { allQuery, getQuery, runQuery } from "../../database/connection";

interface BatteryRow {
  id: number;
  capacityKwh: number;
  soc: number;
  stationId: number | null;
  truckId: number | null;
  status: string;
}

interface ChargingSession {
  id: number;
  stationId: number;
  batteryId: number;
  startTime: string;
  endTime: string | null;
  energyAddedKwh: number;
  status: string;
}

const chargingRouter = Router();

chargingRouter.post("/charging/start", async (req, res, next) => {
  try {
    const { stationId, batteryId } = req.body as { stationId?: number; batteryId?: number };

    if (stationId === undefined || batteryId === undefined) {
      res.status(400).json({ error: "stationId and batteryId are required" });
      return;
    }

    const station = await getQuery<{ id: number }>("SELECT id FROM stations WHERE id = ?;", [
      stationId
    ]);
    if (!station) {
      res.status(400).json({ error: "Invalid stationId" });
      return;
    }

    const battery = await getQuery<BatteryRow>(
      "SELECT id, capacityKwh, soc, stationId, truckId, status FROM batteries WHERE id = ?;",
      [batteryId]
    );
    if (!battery) {
      res.status(400).json({ error: "Invalid batteryId" });
      return;
    }

    if (battery.stationId !== stationId) {
      res.status(400).json({ error: "Battery is not assigned to the station" });
      return;
    }

    const active = await getQuery<{ id: number }>(
      "SELECT id FROM charging_sessions WHERE batteryId = ? AND status = 'ACTIVE';",
      [batteryId]
    );
    if (active) {
      res.status(409).json({ error: "Battery already has an active charging session" });
      return;
    }

    const startTime = new Date().toISOString();
    const insert = await runQuery(
      `
      INSERT INTO charging_sessions (stationId, batteryId, startTime, status)
      VALUES (?, ?, ?, 'ACTIVE');
    `,
      [stationId, batteryId, startTime]
    );

    await runQuery("UPDATE batteries SET status = 'CHARGING' WHERE id = ?;", [batteryId]);

    const session = await getQuery<ChargingSession>(
      "SELECT * FROM charging_sessions WHERE id = ?;",
      [insert.lastID]
    );

    res.status(201).json({ session });
  } catch (error) {
    next(error);
  }
});

chargingRouter.post("/charging/complete", async (req, res, next) => {
  try {
    const { sessionId, endSoc } = req.body as { sessionId?: number; endSoc?: number };

    if (sessionId === undefined || endSoc === undefined) {
      res.status(400).json({ error: "sessionId and endSoc are required" });
      return;
    }

    if (endSoc < 0 || endSoc > 100) {
      res.status(400).json({ error: "endSoc must be between 0 and 100" });
      return;
    }

    const session = await getQuery<ChargingSession>(
      "SELECT * FROM charging_sessions WHERE id = ?;",
      [sessionId]
    );
    if (!session) {
      res.status(404).json({ error: "Charging session not found" });
      return;
    }
    if (session.status !== "ACTIVE") {
      res.status(400).json({ error: "Charging session is not active" });
      return;
    }

    const battery = await getQuery<BatteryRow>(
      "SELECT id, capacityKwh, soc, stationId, truckId, status FROM batteries WHERE id = ?;",
      [session.batteryId]
    );
    if (!battery) {
      res.status(404).json({ error: "Battery not found" });
      return;
    }

    const clampedEndSoc = Number(endSoc.toFixed(2));
    const deltaSoc = Math.max(0, clampedEndSoc - battery.soc);
    const energyAddedKwh = Number(((battery.capacityKwh * deltaSoc) / 100).toFixed(2));
    const endTime = new Date().toISOString();

    await runQuery(
      "UPDATE charging_sessions SET endTime = ?, energyAddedKwh = ?, status = 'COMPLETED' WHERE id = ?;",
      [endTime, energyAddedKwh, sessionId]
    );

    await runQuery("UPDATE batteries SET soc = ?, status = 'READY' WHERE id = ?;", [
      clampedEndSoc,
      battery.id
    ]);

    const updatedSession = await getQuery<ChargingSession>(
      "SELECT * FROM charging_sessions WHERE id = ?;",
      [sessionId]
    );
    const updatedBattery = await getQuery<BatteryRow>(
      "SELECT id, capacityKwh, soc, stationId, truckId, status FROM batteries WHERE id = ?;",
      [battery.id]
    );

    res.status(200).json({ session: updatedSession, battery: updatedBattery });
  } catch (error) {
    next(error);
  }
});

chargingRouter.get("/charging/station/:stationId", async (req, res, next) => {
  try {
    const stationId = Number(req.params.stationId);
    if (Number.isNaN(stationId)) {
      res.status(400).json({ error: "Invalid stationId" });
      return;
    }

    const sessions = await allQuery<ChargingSession>(
      "SELECT * FROM charging_sessions WHERE stationId = ? ORDER BY id DESC;",
      [stationId]
    );
    res.status(200).json({ sessions });
  } catch (error) {
    next(error);
  }
});

export default chargingRouter;

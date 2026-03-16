"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const requireAuth_1 = require("../../middleware/requireAuth");
const requireAnyRole_1 = require("../../middleware/requireAnyRole");
const connection_1 = require("../../database/connection");
const simulationRunner_1 = require("../../services/simulationRunner");
const simulationRouter = (0, express_1.Router)();
simulationRouter.get("/simulation/status", (_req, res) => {
    res.status(200).json({
        running: (0, simulationRunner_1.isSimulationRunning)()
    });
});
simulationRouter.post("/simulation/start", (_req, res) => {
    const started = (0, simulationRunner_1.startSimulation)();
    res.status(200).json({
        running: (0, simulationRunner_1.isSimulationRunning)(),
        message: started ? "Simulation started" : "Simulation already running"
    });
});
simulationRouter.post("/simulation/stop", (_req, res) => {
    const stopped = (0, simulationRunner_1.stopSimulation)();
    res.status(200).json({
        running: (0, simulationRunner_1.isSimulationRunning)(),
        message: stopped ? "Simulation stopped" : "Simulation already stopped"
    });
});
/**
 * POST /simulation/reset
 *
 * Clears simulation data (batteries, swaps, receipts, etc.) so the next
 * simulation cycle runs bootstrap and creates fresh data with correct
 * battery counts, READY distribution, and revenue.
 *
 * Use this when you've applied bootstrap fixes but still see old values -
 * the bootstrap only runs when battery count is 0.
 */
simulationRouter.post("/simulation/reset", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (_req, res, next) => {
    try {
        // Clear simulation data in correct order (respect FKs)
        await (0, connection_1.runQuery)("DELETE FROM receipts;");
        await (0, connection_1.runQuery)("DELETE FROM charging_sessions;");
        await (0, connection_1.runQuery)("DELETE FROM swap_transactions;");
        await (0, connection_1.runQuery)("DELETE FROM battery_events;");
        await (0, connection_1.runQuery)("DELETE FROM batteries;");
        await (0, connection_1.runQuery)("DELETE FROM shipment_events;");
        await (0, connection_1.runQuery)("DELETE FROM shipments;");
        await (0, connection_1.runQuery)("DELETE FROM truck_arrivals;");
        await (0, connection_1.runQuery)("DELETE FROM station_incidents;");
        await (0, connection_1.runQuery)("DELETE FROM charger_faults;");
        await (0, connection_1.runQuery)("DELETE FROM driver_telemetry;");
        // Clear swap_queue if it exists
        try {
            await (0, connection_1.runQuery)("DELETE FROM swap_queue;");
        }
        catch {
            // Table might not exist
        }
        // Clear truck battery references so bootstrap can assign fresh ones
        await (0, connection_1.runQuery)("UPDATE trucks SET batteryId = '0', currentSoc = 50;");
        // Run one simulation cycle immediately so bootstrap creates fresh data
        await (0, simulationRunner_1.runSimulationCycle)();
        res.status(200).json({
            status: "ok",
            message: "Simulation data reset. Bootstrap ran and created fresh batteries, swaps, and revenue data.",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = simulationRouter;

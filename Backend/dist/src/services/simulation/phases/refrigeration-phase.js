"use strict";
/**
 * Refrigeration Phase
 *
 * Simulates refrigerated truck temperature:
 * - Updates temperatureCurrent based on target
 * - Simulates temperature drift
 * - Updates power draw if needed
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRefrigerationPhase = runRefrigerationPhase;
const connection_1 = require("../../../database/connection");
const utils_1 = require("../utils");
async function runRefrigerationPhase(context) {
    // Get all refrigerated trucks
    const refrigeratedTrucks = await (0, connection_1.allQuery)(`
    SELECT id, temperatureTarget, temperatureCurrent, refrigerationPowerDraw, status
    FROM trucks
    WHERE truckType = 'REFRIGERATED'
      AND temperatureTarget IS NOT NULL
      AND temperatureCurrent IS NOT NULL;
    `);
    for (const truck of refrigeratedTrucks) {
        if (!truck.temperatureTarget || truck.temperatureCurrent === null) {
            continue;
        }
        // Only update temperature for active trucks
        if (truck.status !== "IN_TRANSIT" && truck.status !== "READY") {
            continue;
        }
        // Simulate temperature drift toward target
        // Temperature moves 0.1-0.3°C per cycle toward target
        const diff = truck.temperatureTarget - truck.temperatureCurrent;
        const drift = Math.sign(diff) * (0.1 + Math.random() * 0.2);
        const newTemp = (0, utils_1.round2)(Math.max(-10, Math.min(10, truck.temperatureCurrent + drift)));
        // Add some random variation (±0.2°C)
        const finalTemp = (0, utils_1.round2)(newTemp + (Math.random() - 0.5) * 0.4);
        await (0, connection_1.runQuery)("UPDATE trucks SET temperatureCurrent = ? WHERE id = ?;", [finalTemp, truck.id]);
    }
}

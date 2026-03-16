"use strict";
/**
 * Battery Health Phase
 *
 * Updates battery health metrics:
 * - Degrades health slowly over time based on cycle count
 * - Updates temperature during charging and use
 * - Maintains correct battery status transitions
 * - Ensures 588 kWh capacity consistency
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBatteryHealthPhase = runBatteryHealthPhase;
const connection_1 = require("../../../database/connection");
const utils_1 = require("../utils");
const STANDARD_BATTERY_CAPACITY_KWH = 588;
async function runBatteryHealthPhase(context) {
    // Ensure all batteries have standard 588 kWh capacity
    await ensureStandardCapacity();
    // Degrade health based on cycle count (0.01% per 10 cycles, min 50%)
    await updateBatteryHealth();
    // Update temperature for charging batteries
    await updateChargingBatteryTemperatures();
    // Cool down batteries that are not charging
    await coolDownIdleBatteries();
    // Check for batteries that need maintenance (health < 60% or cycleCount > 1000)
    await checkMaintenanceStatus();
}
async function ensureStandardCapacity() {
    // Update any batteries that don't have 588 kWh capacity
    await (0, connection_1.runQuery)("UPDATE batteries SET capacityKwh = ? WHERE capacityKwh != ? OR capacityKwh IS NULL;", [STANDARD_BATTERY_CAPACITY_KWH, STANDARD_BATTERY_CAPACITY_KWH]);
}
async function updateBatteryHealth() {
    // Degrade health based on cycle count
    // Health degrades by 0.01% per 10 cycles (realistic degradation rate)
    const batteries = await (0, connection_1.allQuery)("SELECT id, health, cycleCount FROM batteries WHERE health > 50;");
    for (const battery of batteries) {
        // Calculate health degradation: 0.01% per 10 cycles
        const cyclesSinceLastUpdate = battery.cycleCount % 10;
        if (cyclesSinceLastUpdate === 0 && battery.cycleCount > 0) {
            const degradation = (0, utils_1.round2)(battery.cycleCount * 0.0001); // 0.01% per 10 cycles = 0.001% per cycle
            const newHealth = (0, utils_1.round2)(Math.max(50, battery.health - degradation));
            if (newHealth !== battery.health) {
                await (0, connection_1.runQuery)("UPDATE batteries SET health = ? WHERE id = ?;", [newHealth, battery.id]);
            }
        }
    }
}
async function updateChargingBatteryTemperatures() {
    // Update temperature for charging batteries
    // Temperature increases during charging (1-2°C per cycle, max 35°C)
    const chargingBatteries = await (0, connection_1.allQuery)("SELECT id, temperature, soc FROM batteries WHERE status = 'CHARGING';");
    for (const battery of chargingBatteries) {
        // Temperature increases more when SOC is higher (more heat at higher charge levels)
        const socFactor = battery.soc / 100; // 0.0 to 1.0
        const baseTempIncrease = 0.5 + socFactor * 1.0; // 0.5-1.5°C per cycle
        const tempIncrease = (0, utils_1.round2)(baseTempIncrease + Math.random() * 0.5); // Add some randomness
        const newTemp = (0, utils_1.round2)(Math.min(35, battery.temperature + tempIncrease));
        if (newTemp !== battery.temperature) {
            await (0, connection_1.runQuery)("UPDATE batteries SET temperature = ? WHERE id = ?;", [newTemp, battery.id]);
        }
    }
}
async function coolDownIdleBatteries() {
    // Cool down batteries that are not charging
    // Decrease by 0.3-0.7°C per cycle (depending on ambient), min 20°C
    const idleBatteries = await (0, connection_1.allQuery)("SELECT id, temperature, status FROM batteries WHERE status IN ('READY', 'IN_TRUCK') AND temperature > 20;");
    for (const battery of idleBatteries) {
        // Batteries in trucks cool slower (less airflow) than at stations
        const coolDownRate = battery.status === 'IN_TRUCK' ? 0.2 : 0.5;
        const tempDecrease = (0, utils_1.round2)(coolDownRate + Math.random() * 0.2);
        const newTemp = (0, utils_1.round2)(Math.max(20, battery.temperature - tempDecrease));
        if (newTemp !== battery.temperature) {
            await (0, connection_1.runQuery)("UPDATE batteries SET temperature = ? WHERE id = ?;", [newTemp, battery.id]);
        }
    }
}
async function checkMaintenanceStatus() {
    // Check for batteries that need maintenance
    // Set status to MAINTENANCE if health < 60% or cycleCount > 1000
    const batteriesNeedingMaintenance = await (0, connection_1.allQuery)("SELECT id, health, cycleCount, status FROM batteries WHERE (health < 60 OR cycleCount > 1000) AND status != 'MAINTENANCE';");
    for (const battery of batteriesNeedingMaintenance) {
        // Only set to maintenance if not already in use
        if (battery.status !== 'IN_TRUCK') {
            await (0, connection_1.runQuery)("UPDATE batteries SET status = 'MAINTENANCE' WHERE id = ?;", [battery.id]);
        }
    }
    // Restore batteries from maintenance if health improved or cycles reset
    const batteriesReadyForService = await (0, connection_1.allQuery)("SELECT id, health, cycleCount FROM batteries WHERE status = 'MAINTENANCE' AND health >= 60 AND cycleCount <= 1000;");
    for (const battery of batteriesReadyForService) {
        // Restore to READY status (will be assigned to station)
        await (0, connection_1.runQuery)("UPDATE batteries SET status = 'READY' WHERE id = ?;", [battery.id]);
    }
}

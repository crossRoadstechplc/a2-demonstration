"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../../database/connection");
const requireAuth_1 = require("../../middleware/requireAuth");
const requireAnyRole_1 = require("../../middleware/requireAnyRole");
const accessControl_1 = require("../../utils/accessControl");
const corridorRouter = (0, express_1.Router)();
const TRUCK_TYPES = ["STANDARD", "REFRIGERATED"];
function isValidTruckType(value) {
    return TRUCK_TYPES.includes(value);
}
corridorRouter.post("/stations", async (req, res, next) => {
    try {
        const { name, location, capacity, status } = req.body;
        if (!name || !location || capacity === undefined || !status) {
            res
                .status(400)
                .json({ error: "name, location, capacity and status are required" });
            return;
        }
        const result = await (0, connection_1.runQuery)("INSERT INTO stations (name, location, capacity, status) VALUES (?, ?, ?, ?);", [name, location, capacity, status]);
        const station = await (0, connection_1.getQuery)("SELECT * FROM stations WHERE id = ?;", [result.lastID]);
        res.status(201).json({ station });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.get("/stations", async (_req, res, next) => {
    try {
        const stations = await (0, connection_1.allQuery)("SELECT * FROM stations ORDER BY id;");
        res.status(200).json({ stations });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.post("/fleets", async (req, res, next) => {
    try {
        const { name, ownerName, region } = req.body;
        if (!name || !ownerName || !region) {
            res.status(400).json({ error: "name, ownerName and region are required" });
            return;
        }
        const result = await (0, connection_1.runQuery)("INSERT INTO fleets (name, ownerName, region) VALUES (?, ?, ?);", [name, ownerName, region]);
        const fleet = await (0, connection_1.getQuery)("SELECT * FROM fleets WHERE id = ?;", [
            result.lastID
        ]);
        res.status(201).json({ fleet });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.get("/fleets", async (_req, res, next) => {
    try {
        const fleets = await (0, connection_1.allQuery)("SELECT * FROM fleets ORDER BY id;");
        res.status(200).json({ fleets });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.post("/trucks", async (req, res, next) => {
    try {
        const { plateNumber, fleetId, truckType, batteryId, status, currentSoc, refrigerationPowerDraw, temperatureTarget, temperatureCurrent, currentStationId } = req.body;
        if (!plateNumber ||
            fleetId === undefined ||
            !truckType ||
            !batteryId ||
            !status ||
            currentSoc === undefined) {
            res.status(400).json({
                error: "plateNumber, fleetId, truckType, batteryId, status and currentSoc are required"
            });
            return;
        }
        const fleet = await (0, connection_1.getQuery)("SELECT * FROM fleets WHERE id = ?;", [fleetId]);
        if (!fleet) {
            res.status(400).json({ error: "Invalid fleetId" });
            return;
        }
        if (!isValidTruckType(truckType)) {
            res.status(400).json({ error: "truckType must be STANDARD or REFRIGERATED" });
            return;
        }
        if (currentStationId !== undefined) {
            const station = await (0, connection_1.getQuery)("SELECT * FROM stations WHERE id = ?;", [
                currentStationId
            ]);
            if (!station) {
                res.status(400).json({ error: "Invalid currentStationId" });
                return;
            }
        }
        if (truckType === "REFRIGERATED" &&
            (refrigerationPowerDraw === undefined ||
                temperatureTarget === undefined ||
                temperatureCurrent === undefined)) {
            res.status(400).json({
                error: "refrigerationPowerDraw, temperatureTarget and temperatureCurrent are required for REFRIGERATED trucks"
            });
            return;
        }
        const result = await (0, connection_1.runQuery)(`
      INSERT INTO trucks
      (plateNumber, fleetId, truckType, batteryId, status, currentSoc, refrigerationPowerDraw, temperatureTarget, temperatureCurrent, currentStationId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [
            plateNumber,
            fleetId,
            truckType,
            batteryId,
            status,
            currentSoc,
            refrigerationPowerDraw ?? 0,
            temperatureTarget ?? 0,
            temperatureCurrent ?? 0,
            currentStationId ?? null
        ]);
        const truck = await (0, connection_1.getQuery)("SELECT * FROM trucks WHERE id = ?;", [
            result.lastID
        ]);
        res.status(201).json({ truck });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.get("/trucks", async (_req, res, next) => {
    try {
        const trucks = await (0, connection_1.allQuery)("SELECT * FROM trucks ORDER BY id;");
        res.status(200).json({ trucks });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.get("/trucks/refrigerated", async (_req, res, next) => {
    try {
        const trucks = await (0, connection_1.allQuery)("SELECT * FROM trucks WHERE truckType = 'REFRIGERATED' ORDER BY id;");
        res.status(200).json({ trucks });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.get("/trucks/:id", async (req, res, next) => {
    try {
        const truckId = Number(req.params.id);
        if (Number.isNaN(truckId)) {
            res.status(400).json({ error: "Invalid truck id" });
            return;
        }
        const truck = await (0, connection_1.getQuery)("SELECT * FROM trucks WHERE id = ?;", [truckId]);
        if (!truck) {
            res.status(404).json({ error: "Truck not found" });
            return;
        }
        const fleet = await (0, connection_1.getQuery)("SELECT id, name, ownerName, region FROM fleets WHERE id = ?;", [
            truck.fleetId
        ]);
        const driver = truck.assignedDriverId
            ? await (0, connection_1.getQuery)("SELECT id, name, phone, status, overallRating, safetyScore FROM drivers WHERE id = ?;", [truck.assignedDriverId])
            : null;
        const battery = await (0, connection_1.getQuery)("SELECT id, soc, status, health, temperature FROM batteries WHERE truckId = ? ORDER BY id DESC LIMIT 1;", [truck.id]);
        res.status(200).json({
            truck,
            fleet,
            assignedDriver: driver,
            currentBattery: battery,
            currentSoc: truck.currentSoc
        });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.patch("/trucks/:id/temperature", async (req, res, next) => {
    try {
        const truckId = Number(req.params.id);
        const { temperatureCurrent, temperatureTarget } = req.body;
        if (Number.isNaN(truckId)) {
            res.status(400).json({ error: "Invalid truck id" });
            return;
        }
        if (temperatureCurrent === undefined && temperatureTarget === undefined) {
            res.status(400).json({
                error: "temperatureCurrent or temperatureTarget must be provided"
            });
            return;
        }
        const truck = await (0, connection_1.getQuery)("SELECT * FROM trucks WHERE id = ?;", [truckId]);
        if (!truck) {
            res.status(404).json({ error: "Truck not found" });
            return;
        }
        if (truck.truckType !== "REFRIGERATED") {
            res.status(400).json({ error: "Temperature updates apply to refrigerated trucks only" });
            return;
        }
        await (0, connection_1.runQuery)(`
      UPDATE trucks
      SET temperatureCurrent = ?, temperatureTarget = ?
      WHERE id = ?;
    `, [
            temperatureCurrent ?? truck.temperatureCurrent,
            temperatureTarget ?? truck.temperatureTarget,
            truckId
        ]);
        const updatedTruck = await (0, connection_1.getQuery)("SELECT * FROM trucks WHERE id = ?;", [truckId]);
        res.status(200).json({ truck: updatedTruck });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.patch("/trucks/:id/location", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["DRIVER", "ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const truckId = Number(req.params.id);
        const { lat, lng, currentStationId } = req.body;
        if (Number.isNaN(truckId) || lat === undefined || lng === undefined) {
            res.status(400).json({ error: "Valid truck id, lat and lng are required" });
            return;
        }
        if (currentStationId !== undefined) {
            const station = await (0, connection_1.getQuery)("SELECT id FROM stations WHERE id = ?;", [currentStationId]);
            if (!station) {
                res.status(400).json({ error: "Invalid currentStationId" });
                return;
            }
        }
        await (0, connection_1.runQuery)("UPDATE trucks SET locationLat = ?, locationLng = ?, currentStationId = COALESCE(?, currentStationId) WHERE id = ?;", [lat, lng, currentStationId ?? null, truckId]);
        const truck = await (0, connection_1.getQuery)("SELECT * FROM trucks WHERE id = ?;", [truckId]);
        res.status(200).json({ truck });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.patch("/trucks/:id/status", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["DRIVER", "FLEET_OWNER", "ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const truckId = Number(req.params.id);
        const { status } = req.body;
        if (Number.isNaN(truckId) || !status) {
            res.status(400).json({ error: "Valid truck id and status are required" });
            return;
        }
        await (0, connection_1.runQuery)("UPDATE trucks SET status = ? WHERE id = ?;", [status, truckId]);
        const truck = await (0, connection_1.getQuery)("SELECT * FROM trucks WHERE id = ?;", [truckId]);
        res.status(200).json({ truck });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.patch("/trucks/:id/availability", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["FLEET_OWNER", "ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const truckId = Number(req.params.id);
        const { availability } = req.body;
        if (Number.isNaN(truckId) || !availability) {
            res.status(400).json({ error: "Valid truck id and availability are required" });
            return;
        }
        const truck = await (0, connection_1.getQuery)("SELECT id, fleetId FROM trucks WHERE id = ?;", [truckId]);
        if (!truck) {
            res.status(404).json({ error: "Truck not found" });
            return;
        }
        if (req.user?.role === "FLEET_OWNER") {
            const fleetId = (0, accessControl_1.getOrganizationIdAsNumber)(req);
            if (!fleetId || fleetId !== truck.fleetId) {
                res.status(403).json({ error: "Forbidden for fleet ownership" });
                return;
            }
        }
        await (0, connection_1.runQuery)("UPDATE trucks SET availability = ? WHERE id = ?;", [availability, truckId]);
        const updated = await (0, connection_1.getQuery)("SELECT * FROM trucks WHERE id = ?;", [truckId]);
        res.status(200).json({ truck: updated });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.post("/drivers", async (req, res, next) => {
    try {
        const { name, phone, fleetId, rating, status } = req.body;
        if (!name || !phone || fleetId === undefined || rating === undefined || !status) {
            res
                .status(400)
                .json({ error: "name, phone, fleetId, rating and status are required" });
            return;
        }
        const fleet = await (0, connection_1.getQuery)("SELECT * FROM fleets WHERE id = ?;", [fleetId]);
        if (!fleet) {
            res.status(400).json({ error: "Invalid fleetId" });
            return;
        }
        const result = await (0, connection_1.runQuery)(`
      INSERT INTO drivers
      (name, phone, fleetId, rating, status, overallRating, customerRating, safetyScore, speedViolations, harshBrakes, tripEfficiency, completedTrips)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 80, 0);
    `, [name, phone, fleetId, rating, status, rating, rating, 100]);
        const driver = await (0, connection_1.getQuery)("SELECT * FROM drivers WHERE id = ?;", [
            result.lastID
        ]);
        res.status(201).json({ driver });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.get("/drivers", async (_req, res, next) => {
    try {
        const drivers = await (0, connection_1.allQuery)("SELECT * FROM drivers ORDER BY id;");
        res.status(200).json({ drivers });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.get("/drivers/:id", async (req, res, next) => {
    try {
        const driverId = Number(req.params.id);
        if (Number.isNaN(driverId)) {
            res.status(400).json({ error: "Invalid driver id" });
            return;
        }
        const driver = await (0, connection_1.getQuery)("SELECT * FROM drivers WHERE id = ?;", [driverId]);
        if (!driver) {
            res.status(404).json({ error: "Driver not found" });
            return;
        }
        const assignedTruck = driver.assignedTruckId
            ? await (0, connection_1.getQuery)("SELECT id, plateNumber, status, truckType, currentSoc FROM trucks WHERE id = ?;", [
                driver.assignedTruckId
            ])
            : null;
        res.status(200).json({ driver, assignedTruck });
    }
    catch (error) {
        next(error);
    }
});
function parseTruckCode(code) {
    const normalized = code.trim();
    if (!normalized) {
        return { asPlate: "", asNumericId: null };
    }
    const numericId = Number(normalized);
    return {
        asPlate: normalized,
        asNumericId: Number.isInteger(numericId) && numericId > 0 ? numericId : null
    };
}
async function getCurrentDriver(req) {
    const driverId = (0, accessControl_1.getOrganizationIdAsNumber)(req);
    if (!driverId) {
        return null;
    }
    const driver = await (0, connection_1.getQuery)("SELECT * FROM drivers WHERE id = ?;", [driverId]);
    return driver ?? null;
}
async function clearDriverTruckLink(driverId, truckId) {
    if (!truckId) {
        return;
    }
    await (0, connection_1.runQuery)("UPDATE trucks SET assignedDriverId = NULL WHERE id = ? AND assignedDriverId = ?;", [
        truckId,
        driverId
    ]);
}
async function clearTruckDriverLink(driverId) {
    if (!driverId) {
        return;
    }
    await (0, connection_1.runQuery)("UPDATE drivers SET assignedTruckId = NULL WHERE id = ?;", [driverId]);
}
corridorRouter.post("/drivers/me/attach-truck", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["DRIVER"]), async (req, res, next) => {
    try {
        const { code } = req.body;
        if (!code || !code.trim()) {
            res.status(400).json({ error: "Truck code is required" });
            return;
        }
        const driver = await getCurrentDriver(req);
        if (!driver) {
            res.status(400).json({ error: "Driver account is not mapped to a valid driver profile" });
            return;
        }
        const parsedCode = parseTruckCode(code);
        const truckByPlate = await (0, connection_1.getQuery)("SELECT * FROM trucks WHERE UPPER(plateNumber) = UPPER(?);", [parsedCode.asPlate]);
        const truck = truckByPlate ??
            (parsedCode.asNumericId
                ? await (0, connection_1.getQuery)("SELECT * FROM trucks WHERE id = ?;", [parsedCode.asNumericId])
                : null);
        if (!truck) {
            res.status(404).json({ error: "Truck not found for provided code" });
            return;
        }
        if (driver.fleetId !== truck.fleetId) {
            res.status(403).json({ error: "Truck belongs to a different fleet" });
            return;
        }
        if (driver.assignedTruckId === truck.id && truck.assignedDriverId === driver.id) {
            res.status(200).json({ driver, truck, status: "already-attached" });
            return;
        }
        await clearDriverTruckLink(driver.id, driver.assignedTruckId);
        await clearTruckDriverLink(truck.assignedDriverId);
        await (0, connection_1.runQuery)("UPDATE drivers SET assignedTruckId = ? WHERE id = ?;", [truck.id, driver.id]);
        await (0, connection_1.runQuery)("UPDATE trucks SET assignedDriverId = ? WHERE id = ?;", [driver.id, truck.id]);
        const updatedDriver = await (0, connection_1.getQuery)("SELECT * FROM drivers WHERE id = ?;", [driver.id]);
        const updatedTruck = await (0, connection_1.getQuery)("SELECT * FROM trucks WHERE id = ?;", [truck.id]);
        res.status(200).json({ driver: updatedDriver, truck: updatedTruck, status: "attached" });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.post("/drivers/me/detach-truck", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["DRIVER"]), async (req, res, next) => {
    try {
        const driver = await getCurrentDriver(req);
        if (!driver) {
            res.status(400).json({ error: "Driver account is not mapped to a valid driver profile" });
            return;
        }
        if (!driver.assignedTruckId) {
            res.status(200).json({ driver, truck: null, status: "already-detached" });
            return;
        }
        const detachedTruck = await (0, connection_1.getQuery)("SELECT * FROM trucks WHERE id = ?;", [
            driver.assignedTruckId
        ]);
        await (0, connection_1.runQuery)("UPDATE drivers SET assignedTruckId = NULL WHERE id = ?;", [driver.id]);
        await (0, connection_1.runQuery)("UPDATE trucks SET assignedDriverId = NULL WHERE id = ? AND assignedDriverId = ?;", [driver.assignedTruckId, driver.id]);
        const updatedDriver = await (0, connection_1.getQuery)("SELECT * FROM drivers WHERE id = ?;", [driver.id]);
        const updatedTruck = detachedTruck
            ? await (0, connection_1.getQuery)("SELECT * FROM trucks WHERE id = ?;", [detachedTruck.id])
            : null;
        res.status(200).json({ driver: updatedDriver, truck: updatedTruck, status: "detached" });
    }
    catch (error) {
        next(error);
    }
});
function toTwoDecimals(value) {
    return Number(value.toFixed(2));
}
function mapDeliveryFeedbackToEfficiencyDelta(feedback) {
    const normalized = feedback.trim().toLowerCase();
    if (normalized === "positive") {
        return 2;
    }
    if (normalized === "negative") {
        return -2;
    }
    return 0;
}
corridorRouter.post("/drivers/:id/rate", async (req, res, next) => {
    try {
        const driverId = Number(req.params.id);
        const { customerRating, deliveryFeedback } = req.body;
        if (Number.isNaN(driverId)) {
            res.status(400).json({ error: "Invalid driver id" });
            return;
        }
        if (customerRating === undefined ||
            customerRating < 1 ||
            customerRating > 5 ||
            !deliveryFeedback) {
            res.status(400).json({
                error: "customerRating (1-5) and deliveryFeedback are required"
            });
            return;
        }
        const driver = await (0, connection_1.getQuery)("SELECT * FROM drivers WHERE id = ?;", [driverId]);
        if (!driver) {
            res.status(404).json({ error: "Driver not found" });
            return;
        }
        const newCompletedTrips = driver.completedTrips + 1;
        const previousTrips = driver.completedTrips;
        const newCustomerRating = toTwoDecimals((driver.customerRating * previousTrips + customerRating) / newCompletedTrips);
        const efficiencyDelta = mapDeliveryFeedbackToEfficiencyDelta(deliveryFeedback);
        const newTripEfficiency = toTwoDecimals(Math.min(100, Math.max(0, driver.tripEfficiency + efficiencyDelta)));
        const newOverallRating = toTwoDecimals(newCustomerRating * 0.6 + (driver.safetyScore / 20) * 0.4);
        await (0, connection_1.runQuery)(`
      UPDATE drivers
      SET customerRating = ?, tripEfficiency = ?, completedTrips = ?, overallRating = ?, rating = ?
      WHERE id = ?;
    `, [
            newCustomerRating,
            newTripEfficiency,
            newCompletedTrips,
            newOverallRating,
            newOverallRating,
            driverId
        ]);
        const updatedDriver = await (0, connection_1.getQuery)("SELECT * FROM drivers WHERE id = ?;", [
            driverId
        ]);
        res.status(200).json({ driver: updatedDriver });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.post("/drivers/:id/telemetry", async (req, res, next) => {
    try {
        const driverId = Number(req.params.id);
        const { speed, brakeForce, timestamp } = req.body;
        if (Number.isNaN(driverId)) {
            res.status(400).json({ error: "Invalid driver id" });
            return;
        }
        if (speed === undefined || brakeForce === undefined || !timestamp) {
            res.status(400).json({ error: "speed, brakeForce and timestamp are required" });
            return;
        }
        const driver = await (0, connection_1.getQuery)("SELECT * FROM drivers WHERE id = ?;", [driverId]);
        if (!driver) {
            res.status(404).json({ error: "Driver not found" });
            return;
        }
        const speedViolationDelta = speed > 100 ? 1 : 0;
        const harshBrakeDelta = brakeForce > 0.8 ? 1 : 0;
        await (0, connection_1.runQuery)("INSERT INTO driver_telemetry (driverId, speed, brakeForce, timestamp) VALUES (?, ?, ?, ?);", [driverId, speed, brakeForce, timestamp]);
        const newSpeedViolations = driver.speedViolations + speedViolationDelta;
        const newHarshBrakes = driver.harshBrakes + harshBrakeDelta;
        const newSafetyScore = toTwoDecimals(Math.max(0, 100 - (newSpeedViolations * 5 + newHarshBrakes * 3)));
        const newOverallRating = toTwoDecimals(driver.customerRating * 0.6 + (newSafetyScore / 20) * 0.4);
        await (0, connection_1.runQuery)(`
      UPDATE drivers
      SET speedViolations = ?, harshBrakes = ?, safetyScore = ?, overallRating = ?, rating = ?
      WHERE id = ?;
    `, [
            newSpeedViolations,
            newHarshBrakes,
            newSafetyScore,
            newOverallRating,
            newOverallRating,
            driverId
        ]);
        const updatedDriver = await (0, connection_1.getQuery)("SELECT * FROM drivers WHERE id = ?;", [
            driverId
        ]);
        res.status(200).json({ driver: updatedDriver });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.post("/drivers/:id/assign-truck", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["FLEET_OWNER", "ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const driverId = Number(req.params.id);
        const { truckId } = req.body;
        if (Number.isNaN(driverId) || truckId === undefined) {
            res.status(400).json({ error: "Valid driver id and truckId are required" });
            return;
        }
        const driver = await (0, connection_1.getQuery)("SELECT * FROM drivers WHERE id = ?;", [driverId]);
        const truck = await (0, connection_1.getQuery)("SELECT * FROM trucks WHERE id = ?;", [truckId]);
        if (!driver || !truck) {
            res.status(404).json({ error: "Driver or truck not found" });
            return;
        }
        if (req.user?.role === "FLEET_OWNER") {
            const fleetId = (0, accessControl_1.getOrganizationIdAsNumber)(req);
            if (!fleetId || fleetId !== driver.fleetId || fleetId !== truck.fleetId) {
                res.status(403).json({ error: "Forbidden for fleet ownership" });
                return;
            }
        }
        await (0, connection_1.runQuery)("UPDATE drivers SET assignedTruckId = ? WHERE id = ?;", [truckId, driverId]);
        await (0, connection_1.runQuery)("UPDATE trucks SET assignedDriverId = ? WHERE id = ?;", [driverId, truckId]);
        const updatedDriver = await (0, connection_1.getQuery)("SELECT * FROM drivers WHERE id = ?;", [driverId]);
        res.status(200).json({ driver: updatedDriver });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.post("/fleets/:id/assign-driver", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["FLEET_OWNER", "ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const fleetId = Number(req.params.id);
        const { driverId, truckId } = req.body;
        if (Number.isNaN(fleetId) || driverId === undefined || truckId === undefined) {
            res.status(400).json({ error: "Valid fleet id, driverId and truckId are required" });
            return;
        }
        if (req.user?.role === "FLEET_OWNER") {
            const ownerFleetId = (0, accessControl_1.getOrganizationIdAsNumber)(req);
            if (!ownerFleetId || ownerFleetId !== fleetId) {
                res.status(403).json({ error: "Forbidden for fleet ownership" });
                return;
            }
        }
        const driver = await (0, connection_1.getQuery)("SELECT * FROM drivers WHERE id = ? AND fleetId = ?;", [driverId, fleetId]);
        const truck = await (0, connection_1.getQuery)("SELECT * FROM trucks WHERE id = ? AND fleetId = ?;", [truckId, fleetId]);
        if (!driver || !truck) {
            res.status(404).json({ error: "Driver or truck not found in fleet" });
            return;
        }
        // Handle unassign (truckId === 0)
        if (truckId === 0) {
            const currentDriver = await (0, connection_1.getQuery)("SELECT * FROM drivers WHERE id = ? AND fleetId = ?;", [driverId, fleetId]);
            if (!currentDriver || !currentDriver.assignedTruckId) {
                res.status(400).json({ error: "Driver is not assigned to any truck" });
                return;
            }
            await (0, connection_1.runQuery)("UPDATE trucks SET assignedDriverId = NULL WHERE id = ?;", [
                currentDriver.assignedTruckId,
            ]);
            await (0, connection_1.runQuery)("UPDATE drivers SET assignedTruckId = NULL WHERE id = ?;", [driverId]);
            res.status(200).json({ status: "ok", fleetId, driverId, truckId: null });
            return;
        }
        await (0, connection_1.runQuery)("UPDATE drivers SET assignedTruckId = ? WHERE id = ?;", [truckId, driverId]);
        await (0, connection_1.runQuery)("UPDATE trucks SET assignedDriverId = ? WHERE id = ?;", [driverId, truckId]);
        res.status(200).json({ status: "ok", fleetId, driverId, truckId });
    }
    catch (error) {
        next(error);
    }
});
corridorRouter.post("/drivers/:id/arrive-station", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["DRIVER", "ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const driverId = Number(req.params.id);
        const { stationId, truckId } = req.body;
        if (Number.isNaN(driverId) || stationId === undefined || truckId === undefined) {
            res.status(400).json({ error: "Valid driver id, stationId and truckId are required" });
            return;
        }
        if (req.user?.role === "DRIVER") {
            const orgDriverId = (0, accessControl_1.getOrganizationIdAsNumber)(req);
            if (!orgDriverId || orgDriverId !== driverId) {
                res.status(403).json({ error: "Forbidden for driver ownership" });
                return;
            }
        }
        const driver = await (0, connection_1.getQuery)("SELECT id FROM drivers WHERE id = ?;", [driverId]);
        const truck = await (0, connection_1.getQuery)("SELECT id FROM trucks WHERE id = ?;", [truckId]);
        const station = await (0, connection_1.getQuery)("SELECT id FROM stations WHERE id = ?;", [stationId]);
        if (!driver || !truck || !station) {
            res.status(404).json({ error: "Driver, truck or station not found" });
            return;
        }
        const arrivedAt = new Date().toISOString();
        const result = await (0, connection_1.runQuery)(`
        INSERT INTO truck_arrivals (stationId, truckId, driverId, arrivedAt)
        VALUES (?, ?, ?, ?);
      `, [stationId, truckId, driverId, arrivedAt]);
        await (0, connection_1.runQuery)("UPDATE trucks SET currentStationId = ?, status = 'READY' WHERE id = ?;", [
            stationId,
            truckId
        ]);
        const arrival = await (0, connection_1.getQuery)("SELECT * FROM truck_arrivals WHERE id = ?;", [result.lastID]);
        res.status(201).json({ arrival });
    }
    catch (error) {
        next(error);
    }
});
exports.default = corridorRouter;

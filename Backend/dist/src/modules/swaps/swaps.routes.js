"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../../database/connection");
const swapsRouter = (0, express_1.Router)();
swapsRouter.post("/swaps", async (req, res, next) => {
    try {
        const { truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc } = req.body;
        if (truckId === undefined ||
            stationId === undefined ||
            incomingBatteryId === undefined ||
            outgoingBatteryId === undefined ||
            arrivalSoc === undefined) {
            res.status(400).json({
                error: "truckId, stationId, incomingBatteryId, outgoingBatteryId and arrivalSoc are required"
            });
            return;
        }
        const truck = await (0, connection_1.getQuery)("SELECT id, truckType, refrigerationPowerDraw FROM trucks WHERE id = ?;", [truckId]);
        if (!truck) {
            res.status(400).json({ error: "Invalid truckId" });
            return;
        }
        const station = await (0, connection_1.getQuery)("SELECT id FROM stations WHERE id = ?;", [
            stationId
        ]);
        if (!station) {
            res.status(400).json({ error: "Invalid stationId" });
            return;
        }
        const incoming = await (0, connection_1.getQuery)("SELECT id, capacityKwh, soc, status, stationId, truckId FROM batteries WHERE id = ?;", [incomingBatteryId]);
        const outgoing = await (0, connection_1.getQuery)("SELECT id, capacityKwh, soc, status, stationId, truckId FROM batteries WHERE id = ?;", [outgoingBatteryId]);
        if (!incoming || !outgoing) {
            res.status(400).json({ error: "Invalid battery id(s)" });
            return;
        }
        if (outgoing.truckId !== truckId) {
            res.status(400).json({ error: "Outgoing battery is not assigned to the truck" });
            return;
        }
        if (incoming.stationId !== stationId) {
            res.status(400).json({ error: "Incoming battery is not at the station" });
            return;
        }
        const baseEnergyKwh = (incoming.capacityKwh * (incoming.soc - arrivalSoc)) / 100;
        const extraEnergyKwh = truck.truckType === "REFRIGERATED" ? truck.refrigerationPowerDraw : 0;
        const energyDeliveredKwh = Number(Math.max(0, baseEnergyKwh + extraEnergyKwh).toFixed(2));
        const timestamp = new Date().toISOString();
        await (0, connection_1.runQuery)("UPDATE batteries SET truckId = NULL, stationId = ?, soc = ?, status = 'CHARGING' WHERE id = ?;", [stationId, arrivalSoc, outgoingBatteryId]);
        await (0, connection_1.runQuery)("UPDATE batteries SET truckId = ?, stationId = NULL, status = 'IN_TRUCK' WHERE id = ?;", [truckId, incomingBatteryId]);
        await (0, connection_1.runQuery)("UPDATE trucks SET batteryId = ?, currentSoc = ? WHERE id = ?;", [
            String(incomingBatteryId),
            incoming.soc,
            truckId
        ]);
        const insert = await (0, connection_1.runQuery)(`
      INSERT INTO swap_transactions
      (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `, [
            truckId,
            stationId,
            incomingBatteryId,
            outgoingBatteryId,
            arrivalSoc,
            energyDeliveredKwh,
            timestamp
        ]);
        const swap = await (0, connection_1.getQuery)("SELECT * FROM swap_transactions WHERE id = ?;", [insert.lastID]);
        const tariff = (await (0, connection_1.getQuery)("SELECT eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent FROM tariff_config WHERE id = 1;")) ?? { eeuRatePerKwh: 10, a2ServiceRatePerKwh: 10, vatPercent: 15 };
        const energyCharge = Number((energyDeliveredKwh * tariff.eeuRatePerKwh).toFixed(2));
        const serviceCharge = Number((energyDeliveredKwh * tariff.a2ServiceRatePerKwh).toFixed(2));
        const subtotal = Number((energyCharge + serviceCharge).toFixed(2));
        const vat = Number((subtotal * (tariff.vatPercent / 100)).toFixed(2));
        const total = Number((subtotal + vat).toFixed(2));
        const eeuShare = Number((energyCharge + vat / 2).toFixed(2));
        const a2Share = Number((serviceCharge + vat / 2).toFixed(2));
        // Random payment method
        const paymentMethods = ["Telebirr", "CBE", "M-Pesa", "Bank Transfer"];
        const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
        await (0, connection_1.runQuery)(`
      INSERT INTO receipts
      (swapId, energyKwh, energyCharge, serviceCharge, vat, total, eeuShare, a2Share, paymentMethod, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [
            insert.lastID,
            energyDeliveredKwh,
            energyCharge,
            serviceCharge,
            vat,
            total,
            eeuShare,
            a2Share,
            paymentMethod,
            timestamp
        ]);
        res.status(201).json({ swap });
    }
    catch (error) {
        next(error);
    }
});
swapsRouter.get("/swaps", async (_req, res, next) => {
    try {
        const swaps = await (0, connection_1.allQuery)("SELECT * FROM swap_transactions ORDER BY id DESC;");
        res.status(200).json({ swaps });
    }
    catch (error) {
        next(error);
    }
});
swapsRouter.post("/swaps/book", async (req, res, next) => {
    try {
        const { truckId, stationId } = req.body;
        if (truckId === undefined || stationId === undefined) {
            res.status(400).json({ error: "truckId and stationId are required" });
            return;
        }
        const truck = await (0, connection_1.getQuery)("SELECT id, locationLat, locationLng FROM trucks WHERE id = ?;", [truckId]);
        if (!truck) {
            res.status(400).json({ error: "Invalid truckId" });
            return;
        }
        const station = await (0, connection_1.getQuery)("SELECT id, locationLat, locationLng FROM stations WHERE id = ?;", [
            stationId
        ]);
        if (!station) {
            res.status(400).json({ error: "Invalid stationId" });
            return;
        }
        // Calculate distance
        let distanceKm = 0;
        if (truck.locationLat &&
            truck.locationLng &&
            station.locationLat &&
            station.locationLng) {
            const lat1 = truck.locationLat;
            const lon1 = truck.locationLng;
            const lat2 = station.locationLat;
            const lon2 = station.locationLng;
            const R = 6371; // Earth's radius in km
            const dLat = ((lat2 - lat1) * Math.PI) / 180;
            const dLon = ((lon2 - lon1) * Math.PI) / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos((lat1 * Math.PI) / 180) *
                    Math.cos((lat2 * Math.PI) / 180) *
                    Math.sin(dLon / 2) *
                    Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distanceKm = R * c;
        }
        else {
            // Fallback: estimate 50km if no coordinates
            distanceKm = 50;
        }
        // Check if already in queue
        const existingBooking = await (0, connection_1.getQuery)(`SELECT id FROM swap_queue 
       WHERE truckId = ? AND stationId = ? AND status = 'PENDING';`, [truckId, stationId]);
        if (existingBooking) {
            res.status(409).json({ error: "Truck is already in queue for this station" });
            return;
        }
        // Estimate arrival time (assuming average speed of 60 km/h)
        const estimatedMinutes = Math.round((distanceKm / 60) * 60);
        const bookedAt = new Date().toISOString();
        const estimatedArrival = new Date(Date.now() + estimatedMinutes * 60 * 1000).toISOString();
        // Get queue position
        const queuePosition = await (0, connection_1.getQuery)(`SELECT COUNT(*) as count FROM swap_queue 
       WHERE stationId = ? AND status = 'PENDING' 
       AND (distanceKm < ? OR (distanceKm = ? AND bookedAt < ?));`, [stationId, distanceKm, distanceKm, bookedAt]);
        const position = (queuePosition?.count ?? 0) + 1;
        // Insert into queue
        const insert = await (0, connection_1.runQuery)(`
      INSERT INTO swap_queue (truckId, stationId, bookedAt, estimatedArrival, distanceKm, status)
      VALUES (?, ?, ?, ?, ?, 'PENDING');
    `, [truckId, stationId, bookedAt, estimatedArrival, distanceKm]);
        const booking = await (0, connection_1.getQuery)("SELECT * FROM swap_queue WHERE id = ?;", [insert.lastID]);
        res.status(201).json({
            booking,
            queuePosition: position,
            estimatedArrivalMinutes: estimatedMinutes,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = swapsRouter;

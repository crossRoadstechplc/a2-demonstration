"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDemoData = seedDemoData;
exports.fixStationOperatorLinks = fixStationOperatorLinks;
exports.fixFleetOwnerLinks = fixFleetOwnerLinks;
exports.fixFreightCustomerLinks = fixFreightCustomerLinks;
const bcrypt_1 = __importDefault(require("bcrypt"));
const connection_1 = require("./connection");
const fleetSeed = [
    { name: "Selam Transport", ownerName: "Alemu Bekele", region: "Addis Ababa" },
    { name: "Abay Logistics", ownerName: "Dawit Mulugeta", region: "Amhara" },
    { name: "Habesha Freight", ownerName: "Birhanu Tesfaye", region: "Oromia" },
    { name: "Blue Nile Haulage", ownerName: "Getachew Alemayehu", region: "Benishangul-Gumuz" },
    { name: "Addis Cargo Lines", ownerName: "Yonas Gebru", region: "Addis Ababa" },
    { name: "EthioMove Logistics", ownerName: "Mekonnen Tadesse", region: "SNNPR" },
    { name: "Sheba Freight Group", ownerName: "Haile Fikru", region: "Tigray" },
    { name: "Tana Transport", ownerName: "Abebe Desta", region: "Amhara" },
    { name: "Rift Valley Haulage", ownerName: "Solomon Assefa", region: "Oromia" },
    { name: "Highland Cargo", ownerName: "Kebede Worku", region: "Sidama" }
];
const stationSeed = [
    { name: "Addis Ababa (Main Hub)", location: "Addis Ababa", capacity: 40, status: "ACTIVE" },
    { name: "Adama", location: "Adama", capacity: 22, status: "ACTIVE" },
    { name: "Awash", location: "Awash", capacity: 16, status: "ACTIVE" },
    { name: "Mieso", location: "Mieso", capacity: 14, status: "ACTIVE" },
    { name: "Dire Dawa", location: "Dire Dawa", capacity: 22, status: "ACTIVE" },
    { name: "Semera / Mille area", location: "Semera / Mille", capacity: 18, status: "ACTIVE" },
    { name: "Djibouti Port Gateway", location: "Djibouti Port", capacity: 30, status: "ACTIVE" }
];
const firstNames = [
    "Abel",
    "Dawit",
    "Kebede",
    "Tesfaye",
    "Abebe",
    "Haile",
    "Yonas",
    "Solomon",
    "Biruk",
    "Mekonnen",
    "Natnael",
    "Henok",
    "Daniel",
    "Kalkidan",
    "Fikre",
    "Mulatu",
    "Mulugeta",
    "Getachew",
    "Alemu",
    "Ephrem"
];
const lastNames = [
    "Tesfaye",
    "Mekonnen",
    "Alemu",
    "Bekele",
    "Tadesse",
    "Gebremedhin",
    "Desta",
    "Assefa",
    "Kebede",
    "Taye",
    "Abate",
    "Haile",
    "Demissie",
    "Worku",
    "Fikru",
    "Ayalew"
];
const truckTypes = ["STANDARD", "REFRIGERATED"];
const truckStatuses = ["READY", "IN_TRANSIT", "MAINTENANCE"];
const driverStatuses = ["AVAILABLE", "ON_DUTY", "RESTING"];
const ALICE_DRIVER_EMAIL = "alicedriver@example.com";
const ALICE_DRIVER_PASSWORD = "secret123";
function randomInt(maxExclusive) {
    return Math.floor(Math.random() * maxExclusive);
}
function pickRandom(items) {
    return items[randomInt(items.length)];
}
async function ensureAliceDriverLinkedUser(defaultFleetId) {
    const existingAliceDriver = await (0, connection_1.getQuery)("SELECT id FROM drivers WHERE name = ? ORDER BY id DESC LIMIT 1;", ["Alice Driver"]);
    let aliceDriverId = existingAliceDriver?.id ?? null;
    if (!aliceDriverId) {
        const insertDriver = await (0, connection_1.runQuery)("INSERT INTO drivers (name, phone, fleetId, rating, status) VALUES (?, ?, ?, ?, ?);", ["Alice Driver", "+251911223344", defaultFleetId, 4.8, "AVAILABLE"]);
        aliceDriverId = insertDriver.lastID;
    }
    const hashedPassword = await bcrypt_1.default.hash(ALICE_DRIVER_PASSWORD, 10);
    const existingUser = await (0, connection_1.getQuery)("SELECT id FROM users WHERE LOWER(email) = LOWER(?);", [ALICE_DRIVER_EMAIL]);
    if (existingUser) {
        await (0, connection_1.runQuery)(`
      UPDATE users
      SET name = ?, role = 'DRIVER', organizationId = ?, password = ?
      WHERE id = ?;
    `, ["Alice Driver", String(aliceDriverId), hashedPassword, existingUser.id]);
        return;
    }
    await (0, connection_1.runQuery)(`
    INSERT INTO users (name, email, password, role, organizationId, createdAt)
    VALUES (?, ?, ?, 'DRIVER', ?, ?);
  `, ["Alice Driver", ALICE_DRIVER_EMAIL, hashedPassword, String(aliceDriverId), new Date().toISOString()]);
}
async function seedDemoData() {
    await (0, connection_1.initializeDatabase)();
    await (0, connection_1.runQuery)("DELETE FROM battery_events;");
    await (0, connection_1.runQuery)("DELETE FROM truck_arrivals;");
    await (0, connection_1.runQuery)("DELETE FROM shipment_events;");
    await (0, connection_1.runQuery)("DELETE FROM station_incidents;");
    await (0, connection_1.runQuery)("DELETE FROM charger_faults;");
    await (0, connection_1.runQuery)("DELETE FROM receipts;");
    await (0, connection_1.runQuery)("DELETE FROM charging_sessions;");
    await (0, connection_1.runQuery)("DELETE FROM swap_transactions;");
    await (0, connection_1.runQuery)("DELETE FROM batteries;");
    await (0, connection_1.runQuery)("DELETE FROM shipments;");
    await (0, connection_1.runQuery)("DELETE FROM driver_telemetry;");
    await (0, connection_1.runQuery)("DELETE FROM trucks;");
    await (0, connection_1.runQuery)("DELETE FROM drivers;");
    await (0, connection_1.runQuery)("DELETE FROM fleets;");
    await (0, connection_1.runQuery)("DELETE FROM stations;");
    for (const station of stationSeed) {
        await (0, connection_1.runQuery)("INSERT INTO stations (name, location, capacity, status) VALUES (?, ?, ?, ?);", [station.name, station.location, station.capacity, station.status]);
    }
    const fleetIds = [];
    for (const fleet of fleetSeed) {
        const result = await (0, connection_1.runQuery)("INSERT INTO fleets (name, ownerName, region) VALUES (?, ?, ?);", [fleet.name, fleet.ownerName, fleet.region]);
        fleetIds.push(result.lastID);
    }
    for (let i = 1; i <= 1000; i += 1) {
        const fleetId = pickRandom(fleetIds);
        const plateNumber = `ET-${String(i).padStart(4, "0")}`;
        const batteryId = `BAT-${String(i).padStart(4, "0")}`;
        const currentSoc = Number((Math.max(25, 30 + Math.random() * 70)).toFixed(2));
        const truckType = pickRandom(truckTypes);
        const refrigerationPowerDraw = truckType === "REFRIGERATED" ? 8 : 0;
        const temperatureTarget = truckType === "REFRIGERATED" ? 4 : 0;
        const temperatureCurrent = truckType === "REFRIGERATED" ? Number((2 + Math.random() * 4).toFixed(2)) : 0;
        await (0, connection_1.runQuery)(`
      INSERT INTO trucks
      (plateNumber, fleetId, truckType, batteryId, status, currentSoc, refrigerationPowerDraw, temperatureTarget, temperatureCurrent, currentStationId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [
            plateNumber,
            fleetId,
            truckType,
            batteryId,
            pickRandom(truckStatuses),
            currentSoc,
            refrigerationPowerDraw,
            temperatureTarget,
            temperatureCurrent,
            null
        ]);
    }
    for (let i = 1; i <= 1000; i += 1) {
        const fleetId = pickRandom(fleetIds);
        const name = `${pickRandom(firstNames)} ${pickRandom(lastNames)}`;
        const phone = `+2519${String(10000000 + i).padStart(8, "0")}`;
        const rating = Number((3.5 + Math.random() * 1.5).toFixed(2));
        await (0, connection_1.runQuery)("INSERT INTO drivers (name, phone, fleetId, rating, status) VALUES (?, ?, ?, ?, ?);", [name, phone, fleetId, rating, pickRandom(driverStatuses)]);
    }
    await ensureAliceDriverLinkedUser(fleetIds[0]);
    // Create station operator users for each station
    await ensureStationOperatorsLinked();
    // Create fleet owner users for each fleet
    await ensureFleetOwnersLinked(fleetIds);
    // Create freight customer users
    await ensureFreightCustomersLinked();
}
async function ensureStationOperatorsLinked() {
    // Get all stations
    const stations = await (0, connection_1.allQuery)("SELECT id, name FROM stations ORDER BY id ASC;");
    // Default password for station operators
    const defaultPassword = "station123";
    const hashedPassword = await bcrypt_1.default.hash(defaultPassword, 10);
    for (const station of stations) {
        // Create email based on station name (sanitized)
        const emailBase = station.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .substring(0, 20);
        const email = `${emailBase}@station.example.com`;
        // Check if user already exists
        const existingUser = await (0, connection_1.getQuery)("SELECT id FROM users WHERE LOWER(email) = LOWER(?);", [email]);
        if (existingUser) {
            // Update existing user to ensure correct organizationId
            await (0, connection_1.runQuery)(`
        UPDATE users
        SET name = ?, role = 'STATION_OPERATOR', organizationId = ?, password = ?
        WHERE id = ?;
      `, [`${station.name} Operator`, String(station.id), hashedPassword, existingUser.id]);
        }
        else {
            // Create new station operator user
            await (0, connection_1.runQuery)(`
        INSERT INTO users (name, email, password, role, organizationId, createdAt)
        VALUES (?, ?, ?, 'STATION_OPERATOR', ?, ?);
      `, [
                `${station.name} Operator`,
                email,
                hashedPassword,
                String(station.id),
                new Date().toISOString()
            ]);
        }
    }
    // Also ensure any existing STATION_OPERATOR users without organizationId are linked
    // Link them to the first station if they don't have one
    const unlinkedOperators = await (0, connection_1.allQuery)("SELECT id, email FROM users WHERE role = 'STATION_OPERATOR' AND (organizationId IS NULL OR organizationId = '');");
    if (unlinkedOperators.length > 0 && stations.length > 0) {
        // Link unlinked operators to stations (round-robin assignment)
        for (let i = 0; i < unlinkedOperators.length; i++) {
            const station = stations[i % stations.length];
            await (0, connection_1.runQuery)("UPDATE users SET organizationId = ? WHERE id = ?;", [String(station.id), unlinkedOperators[i].id]);
        }
    }
}
async function ensureFleetOwnersLinked(fleetIds) {
    // Get all fleets
    const fleets = await (0, connection_1.allQuery)("SELECT id, name, ownerName FROM fleets ORDER BY id ASC;");
    // Default password for fleet owners
    const defaultPassword = "fleet123";
    const hashedPassword = await bcrypt_1.default.hash(defaultPassword, 10);
    for (const fleet of fleets) {
        // Create email based on fleet name (sanitized)
        const emailBase = fleet.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .substring(0, 20);
        const email = `${emailBase}@fleet.example.com`;
        // Check if user already exists
        const existingUser = await (0, connection_1.getQuery)("SELECT id FROM users WHERE LOWER(email) = LOWER(?);", [email]);
        if (existingUser) {
            // Update existing user to ensure correct organizationId
            await (0, connection_1.runQuery)(`
        UPDATE users
        SET name = ?, role = 'FLEET_OWNER', organizationId = ?, password = ?
        WHERE id = ?;
      `, [`${fleet.ownerName} (${fleet.name})`, String(fleet.id), hashedPassword, existingUser.id]);
        }
        else {
            // Create new fleet owner user
            await (0, connection_1.runQuery)(`
        INSERT INTO users (name, email, password, role, organizationId, createdAt)
        VALUES (?, ?, ?, 'FLEET_OWNER', ?, ?);
      `, [
                `${fleet.ownerName} (${fleet.name})`,
                email,
                hashedPassword,
                String(fleet.id),
                new Date().toISOString()
            ]);
        }
    }
    // Also ensure any existing FLEET_OWNER users without organizationId are linked
    const unlinkedOwners = await (0, connection_1.allQuery)(`SELECT id, email, organizationId 
     FROM users 
     WHERE role = 'FLEET_OWNER' 
     AND (organizationId IS NULL OR organizationId = '' OR 
          organizationId NOT IN (SELECT CAST(id AS TEXT) FROM fleets));`);
    if (unlinkedOwners.length > 0 && fleets.length > 0) {
        // Link unlinked owners to fleets (round-robin assignment)
        for (let i = 0; i < unlinkedOwners.length; i++) {
            const fleet = fleets[i % fleets.length];
            await (0, connection_1.runQuery)("UPDATE users SET organizationId = ? WHERE id = ?;", [String(fleet.id), unlinkedOwners[i].id]);
        }
    }
}
/**
 * Fix existing station operator users by linking them to stations
 * This can be called independently to fix organizationId issues
 */
async function fixStationOperatorLinks() {
    await (0, connection_1.initializeDatabase)();
    // Get all stations
    const stations = await (0, connection_1.allQuery)("SELECT id, name FROM stations ORDER BY id ASC;");
    if (stations.length === 0) {
        console.log("No stations found. Please seed stations first.");
        return;
    }
    // Get all station operators without organizationId or with invalid organizationId
    const unlinkedOperators = await (0, connection_1.allQuery)(`SELECT id, email, organizationId 
     FROM users 
     WHERE role = 'STATION_OPERATOR' 
     AND (organizationId IS NULL OR organizationId = '' OR 
          organizationId NOT IN (SELECT CAST(id AS TEXT) FROM stations));`);
    if (unlinkedOperators.length === 0) {
        console.log("All station operators are properly linked.");
        return;
    }
    // Link unlinked operators to stations (round-robin assignment)
    for (let i = 0; i < unlinkedOperators.length; i++) {
        const station = stations[i % stations.length];
        await (0, connection_1.runQuery)("UPDATE users SET organizationId = ? WHERE id = ?;", [String(station.id), unlinkedOperators[i].id]);
        console.log(`Linked user ${unlinkedOperators[i].email} (ID: ${unlinkedOperators[i].id}) to station ${station.name} (ID: ${station.id})`);
    }
    console.log(`Fixed ${unlinkedOperators.length} station operator link(s).`);
}
/**
 * Fix existing fleet owner users by linking them to fleets
 * This can be called independently to fix organizationId issues
 */
async function fixFleetOwnerLinks() {
    await (0, connection_1.initializeDatabase)();
    // Get all fleets
    const fleets = await (0, connection_1.allQuery)("SELECT id, name FROM fleets ORDER BY id ASC;");
    if (fleets.length === 0) {
        console.log("No fleets found. Please seed fleets first.");
        return;
    }
    // Get all fleet owners without organizationId or with invalid organizationId
    const unlinkedOwners = await (0, connection_1.allQuery)(`SELECT id, email, organizationId 
     FROM users 
     WHERE role = 'FLEET_OWNER' 
     AND (organizationId IS NULL OR organizationId = '' OR 
          organizationId NOT IN (SELECT CAST(id AS TEXT) FROM fleets));`);
    if (unlinkedOwners.length === 0) {
        console.log("All fleet owners are properly linked.");
        return;
    }
    // Link unlinked owners to fleets (round-robin assignment)
    for (let i = 0; i < unlinkedOwners.length; i++) {
        const fleet = fleets[i % fleets.length];
        await (0, connection_1.runQuery)("UPDATE users SET organizationId = ? WHERE id = ?;", [String(fleet.id), unlinkedOwners[i].id]);
        console.log(`Linked user ${unlinkedOwners[i].email} (ID: ${unlinkedOwners[i].id}) to fleet ${fleet.name} (ID: ${fleet.id})`);
    }
    console.log(`Fixed ${unlinkedOwners.length} fleet owner link(s).`);
}
async function ensureFreightCustomersLinked() {
    // Default password for freight customers
    const defaultPassword = "freight123";
    const hashedPassword = await bcrypt_1.default.hash(defaultPassword, 10);
    // Create a few freight customer users
    const customerEmails = [
        "alicefreight@example.com",
        "bobfreight@example.com",
        "carolfreight@example.com"
    ];
    for (let i = 0; i < customerEmails.length; i++) {
        const email = customerEmails[i];
        const customerName = email.split("@")[0].replace("freight", "").replace(/([A-Z])/g, " $1").trim();
        const displayName = customerName.charAt(0).toUpperCase() + customerName.slice(1) + " Customer";
        // Check if user already exists
        const existingUser = await (0, connection_1.getQuery)("SELECT id FROM users WHERE LOWER(email) = LOWER(?);", [email]);
        if (existingUser) {
            // Update existing user - for freight customers, organizationId should be their user id
            await (0, connection_1.runQuery)(`
        UPDATE users
        SET name = ?, role = 'FREIGHT_CUSTOMER', organizationId = ?, password = ?
        WHERE id = ?;
      `, [displayName, String(existingUser.id), hashedPassword, existingUser.id]);
        }
        else {
            // Create new freight customer user
            // Note: We'll need to update organizationId after creation since we need the user id
            const insertResult = await (0, connection_1.runQuery)(`
        INSERT INTO users (name, email, password, role, organizationId, createdAt)
        VALUES (?, ?, ?, 'FREIGHT_CUSTOMER', NULL, ?);
      `, [displayName, email, hashedPassword, new Date().toISOString()]);
            // Update organizationId to match user id (for freight customers, orgId = userId)
            await (0, connection_1.runQuery)("UPDATE users SET organizationId = ? WHERE id = ?;", [String(insertResult.lastID), insertResult.lastID]);
        }
    }
    // Also ensure any existing FREIGHT_CUSTOMER users have organizationId set to their user id
    const unlinkedCustomers = await (0, connection_1.allQuery)(`SELECT id, email, organizationId 
     FROM users 
     WHERE role = 'FREIGHT_CUSTOMER' 
     AND (organizationId IS NULL OR organizationId = '' OR organizationId != CAST(id AS TEXT));`);
    for (const customer of unlinkedCustomers) {
        await (0, connection_1.runQuery)("UPDATE users SET organizationId = ? WHERE id = ?;", [String(customer.id), customer.id]);
    }
}
/**
 * Fix existing freight customer users by linking organizationId to their user id
 * This can be called independently to fix organizationId issues
 */
async function fixFreightCustomerLinks() {
    await (0, connection_1.initializeDatabase)();
    // Get all freight customers without correct organizationId
    const unlinkedCustomers = await (0, connection_1.allQuery)(`SELECT id, email, organizationId 
     FROM users 
     WHERE role = 'FREIGHT_CUSTOMER' 
     AND (organizationId IS NULL OR organizationId = '' OR organizationId != CAST(id AS TEXT));`);
    if (unlinkedCustomers.length === 0) {
        console.log("All freight customers are properly linked.");
        return;
    }
    // Link organizationId to user id (for freight customers, orgId = userId)
    for (const customer of unlinkedCustomers) {
        await (0, connection_1.runQuery)("UPDATE users SET organizationId = ? WHERE id = ?;", [String(customer.id), customer.id]);
        console.log(`Linked user ${customer.email} (ID: ${customer.id}) - organizationId set to ${customer.id}`);
    }
    console.log(`Fixed ${unlinkedCustomers.length} freight customer link(s).`);
}
async function runSeeder() {
    await seedDemoData();
    console.log("Seed completed: 10 fleets, 1000 trucks, 1000 drivers (+ Alice Driver), 7 stations, station operators linked.");
}
if (require.main === module) {
    runSeeder().catch((error) => {
        const message = error instanceof Error ? error.message : "Seeder failed";
        console.error(message);
        process.exit(1);
    });
}

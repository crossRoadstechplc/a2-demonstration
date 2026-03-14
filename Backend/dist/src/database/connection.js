"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.runQuery = runQuery;
exports.getQuery = getQuery;
exports.allQuery = allQuery;
exports.initializeDatabase = initializeDatabase;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const constants_1 = require("../config/constants");
const auth_types_1 = require("../modules/auth/auth.types");
let dbInstance = null;
function resolveDbPath() {
    const filePath = process.env.DB_FILE_PATH ?? constants_1.DB_FILE_PATH;
    return path_1.default.resolve(process.cwd(), filePath);
}
function getDb() {
    if (dbInstance) {
        return dbInstance;
    }
    const absoluteDbPath = resolveDbPath();
    const dbDirectory = path_1.default.dirname(absoluteDbPath);
    if (!fs_1.default.existsSync(dbDirectory)) {
        fs_1.default.mkdirSync(dbDirectory, { recursive: true });
    }
    dbInstance = new sqlite3_1.default.Database(absoluteDbPath);
    return dbInstance;
}
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().run(sql, params, function onRun(error) {
            if (error) {
                reject(error);
                return;
            }
            resolve({
                lastID: this.lastID,
                changes: this.changes
            });
        });
    });
}
function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().get(sql, params, (error, row) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(row);
        });
    });
}
function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().all(sql, params, (error, rows) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(rows);
        });
    });
}
async function createUsersTable() {
    const roleCheck = auth_types_1.USER_ROLES.map((role) => `'${role}'`).join(", ");
    await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN (${roleCheck})),
      organizationId TEXT,
      createdAt TEXT NOT NULL
    );
  `);
}
async function createStationsTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      status TEXT NOT NULL,
      maxQueueSize INTEGER NOT NULL DEFAULT 20,
      swapBayCount INTEGER NOT NULL DEFAULT 2,
      overnightChargingEnabled INTEGER NOT NULL DEFAULT 1,
      incidentThreshold INTEGER NOT NULL DEFAULT 5,
      operatingStatus TEXT NOT NULL DEFAULT 'ACTIVE'
    );
  `);
}
async function createFleetsTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS fleets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ownerName TEXT NOT NULL,
      region TEXT NOT NULL
    );
  `);
}
async function createTrucksTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS trucks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plateNumber TEXT NOT NULL UNIQUE,
      fleetId INTEGER NOT NULL,
      truckType TEXT NOT NULL,
      batteryId TEXT NOT NULL,
      status TEXT NOT NULL,
      currentSoc REAL NOT NULL,
      refrigerationPowerDraw REAL NOT NULL DEFAULT 0,
      temperatureTarget REAL NOT NULL DEFAULT 0,
      temperatureCurrent REAL NOT NULL DEFAULT 0,
      currentStationId INTEGER,
      assignedDriverId INTEGER,
      availability TEXT NOT NULL DEFAULT 'AVAILABLE',
      locationLat REAL,
      locationLng REAL,
      FOREIGN KEY (fleetId) REFERENCES fleets(id)
    );
  `);
}
async function ensureTruckColumns() {
    const columns = await allQuery("PRAGMA table_info(trucks);");
    const columnNames = new Set(columns.map((column) => column.name));
    if (!columnNames.has("refrigerationPowerDraw")) {
        await runQuery("ALTER TABLE trucks ADD COLUMN refrigerationPowerDraw REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("temperatureTarget")) {
        await runQuery("ALTER TABLE trucks ADD COLUMN temperatureTarget REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("temperatureCurrent")) {
        await runQuery("ALTER TABLE trucks ADD COLUMN temperatureCurrent REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("currentStationId")) {
        await runQuery("ALTER TABLE trucks ADD COLUMN currentStationId INTEGER;");
    }
    if (!columnNames.has("assignedDriverId")) {
        await runQuery("ALTER TABLE trucks ADD COLUMN assignedDriverId INTEGER;");
    }
    if (!columnNames.has("availability")) {
        await runQuery("ALTER TABLE trucks ADD COLUMN availability TEXT NOT NULL DEFAULT 'AVAILABLE';");
    }
    if (!columnNames.has("locationLat")) {
        await runQuery("ALTER TABLE trucks ADD COLUMN locationLat REAL;");
    }
    if (!columnNames.has("locationLng")) {
        await runQuery("ALTER TABLE trucks ADD COLUMN locationLng REAL;");
    }
}
async function createDriversTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      fleetId INTEGER NOT NULL,
      rating REAL NOT NULL,
      status TEXT NOT NULL,
      overallRating REAL NOT NULL DEFAULT 0,
      customerRating REAL NOT NULL DEFAULT 0,
      safetyScore REAL NOT NULL DEFAULT 100,
      speedViolations INTEGER NOT NULL DEFAULT 0,
      harshBrakes INTEGER NOT NULL DEFAULT 0,
      tripEfficiency REAL NOT NULL DEFAULT 80,
      completedTrips INTEGER NOT NULL DEFAULT 0,
      assignedTruckId INTEGER,
      FOREIGN KEY (fleetId) REFERENCES fleets(id)
    );
  `);
}
async function ensureDriverColumns() {
    const columns = await allQuery("PRAGMA table_info(drivers);");
    const columnNames = new Set(columns.map((column) => column.name));
    if (!columnNames.has("overallRating")) {
        await runQuery("ALTER TABLE drivers ADD COLUMN overallRating REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("customerRating")) {
        await runQuery("ALTER TABLE drivers ADD COLUMN customerRating REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("safetyScore")) {
        await runQuery("ALTER TABLE drivers ADD COLUMN safetyScore REAL NOT NULL DEFAULT 100;");
    }
    if (!columnNames.has("speedViolations")) {
        await runQuery("ALTER TABLE drivers ADD COLUMN speedViolations INTEGER NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("harshBrakes")) {
        await runQuery("ALTER TABLE drivers ADD COLUMN harshBrakes INTEGER NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("tripEfficiency")) {
        await runQuery("ALTER TABLE drivers ADD COLUMN tripEfficiency REAL NOT NULL DEFAULT 80;");
    }
    if (!columnNames.has("completedTrips")) {
        await runQuery("ALTER TABLE drivers ADD COLUMN completedTrips INTEGER NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("assignedTruckId")) {
        await runQuery("ALTER TABLE drivers ADD COLUMN assignedTruckId INTEGER;");
    }
}
async function createBatteriesTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS batteries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      capacityKwh REAL NOT NULL,
      soc REAL NOT NULL,
      health REAL NOT NULL,
      cycleCount INTEGER NOT NULL,
      temperature REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('READY', 'CHARGING', 'IN_TRUCK', 'MAINTENANCE')),
      stationId INTEGER,
      truckId INTEGER,
      FOREIGN KEY (stationId) REFERENCES stations(id) ON DELETE SET NULL,
      FOREIGN KEY (truckId) REFERENCES trucks(id) ON DELETE SET NULL
    );
  `);
}
async function createSwapTransactionsTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS swap_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      truckId INTEGER NOT NULL,
      stationId INTEGER NOT NULL,
      incomingBatteryId INTEGER NOT NULL,
      outgoingBatteryId INTEGER NOT NULL,
      arrivalSoc REAL NOT NULL,
      energyDeliveredKwh REAL NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (truckId) REFERENCES trucks(id),
      FOREIGN KEY (stationId) REFERENCES stations(id),
      FOREIGN KEY (incomingBatteryId) REFERENCES batteries(id),
      FOREIGN KEY (outgoingBatteryId) REFERENCES batteries(id)
    );
  `);
}
async function createChargingSessionsTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS charging_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stationId INTEGER NOT NULL,
      batteryId INTEGER NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT,
      energyAddedKwh REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      FOREIGN KEY (stationId) REFERENCES stations(id),
      FOREIGN KEY (batteryId) REFERENCES batteries(id)
    );
  `);
}
async function createReceiptsTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      swapId INTEGER NOT NULL,
      energyKwh REAL NOT NULL,
      energyCharge REAL NOT NULL,
      serviceCharge REAL NOT NULL,
      vat REAL NOT NULL,
      total REAL NOT NULL,
      eeuShare REAL NOT NULL,
      a2Share REAL NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (swapId) REFERENCES swap_transactions(id) ON DELETE CASCADE
    );
  `);
}
async function createDriverTelemetryTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS driver_telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driverId INTEGER NOT NULL,
      speed REAL NOT NULL,
      brakeForce REAL NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (driverId) REFERENCES drivers(id) ON DELETE CASCADE
    );
  `);
}
async function createShipmentsTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pickupLocation TEXT NOT NULL,
      deliveryLocation TEXT NOT NULL,
      cargoDescription TEXT NOT NULL,
      weight REAL NOT NULL,
      volume REAL NOT NULL,
      pickupWindow TEXT NOT NULL,
      requiresRefrigeration INTEGER NOT NULL DEFAULT 0,
      temperatureTarget REAL,
      customerId INTEGER,
      truckId INTEGER,
      driverId INTEGER,
      approvedLoad INTEGER NOT NULL DEFAULT 0,
      assignedAt TEXT,
      acceptedAt TEXT,
      pickupConfirmedAt TEXT,
      deliveryConfirmedAt TEXT,
      status TEXT NOT NULL CHECK(status IN ('REQUESTED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED')),
      FOREIGN KEY (truckId) REFERENCES trucks(id) ON DELETE SET NULL,
      FOREIGN KEY (driverId) REFERENCES drivers(id) ON DELETE SET NULL
    );
  `);
}
async function ensureStationColumns() {
    const columns = await allQuery("PRAGMA table_info(stations);");
    const columnNames = new Set(columns.map((column) => column.name));
    if (!columnNames.has("maxQueueSize")) {
        await runQuery("ALTER TABLE stations ADD COLUMN maxQueueSize INTEGER NOT NULL DEFAULT 20;");
    }
    if (!columnNames.has("swapBayCount")) {
        await runQuery("ALTER TABLE stations ADD COLUMN swapBayCount INTEGER NOT NULL DEFAULT 2;");
    }
    if (!columnNames.has("overnightChargingEnabled")) {
        await runQuery("ALTER TABLE stations ADD COLUMN overnightChargingEnabled INTEGER NOT NULL DEFAULT 1;");
    }
    if (!columnNames.has("incidentThreshold")) {
        await runQuery("ALTER TABLE stations ADD COLUMN incidentThreshold INTEGER NOT NULL DEFAULT 5;");
    }
    if (!columnNames.has("operatingStatus")) {
        await runQuery("ALTER TABLE stations ADD COLUMN operatingStatus TEXT NOT NULL DEFAULT 'ACTIVE';");
    }
}
async function ensureShipmentColumns() {
    const columns = await allQuery("PRAGMA table_info(shipments);");
    const columnNames = new Set(columns.map((column) => column.name));
    if (columns.length === 0) {
        return;
    }
    if (!columnNames.has("requiresRefrigeration")) {
        await runQuery("ALTER TABLE shipments ADD COLUMN requiresRefrigeration INTEGER NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("temperatureTarget")) {
        await runQuery("ALTER TABLE shipments ADD COLUMN temperatureTarget REAL;");
    }
    if (!columnNames.has("customerId")) {
        await runQuery("ALTER TABLE shipments ADD COLUMN customerId INTEGER;");
    }
    if (!columnNames.has("approvedLoad")) {
        await runQuery("ALTER TABLE shipments ADD COLUMN approvedLoad INTEGER NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("assignedAt")) {
        await runQuery("ALTER TABLE shipments ADD COLUMN assignedAt TEXT;");
    }
    if (!columnNames.has("acceptedAt")) {
        await runQuery("ALTER TABLE shipments ADD COLUMN acceptedAt TEXT;");
    }
    if (!columnNames.has("pickupConfirmedAt")) {
        await runQuery("ALTER TABLE shipments ADD COLUMN pickupConfirmedAt TEXT;");
    }
    if (!columnNames.has("deliveryConfirmedAt")) {
        await runQuery("ALTER TABLE shipments ADD COLUMN deliveryConfirmedAt TEXT;");
    }
}
async function createTariffConfigTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS tariff_config (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      eeuRatePerKwh REAL NOT NULL,
      a2ServiceRatePerKwh REAL NOT NULL,
      vatPercent REAL NOT NULL
    );
  `);
    await runQuery(`
    INSERT OR IGNORE INTO tariff_config (id, eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent)
    VALUES (1, 10, 10, 15);
  `);
}
async function createChargingWindowConfigTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS charging_window_config (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      startHour INTEGER NOT NULL,
      endHour INTEGER NOT NULL,
      label TEXT NOT NULL
    );
  `);
    await runQuery(`
    INSERT OR IGNORE INTO charging_window_config (id, startHour, endHour, label)
    VALUES (1, 20, 6, 'Overnight Window');
  `);
}
async function createStationIncidentsTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS station_incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stationId INTEGER NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL,
      reportedAt TEXT NOT NULL,
      FOREIGN KEY (stationId) REFERENCES stations(id) ON DELETE CASCADE
    );
  `);
}
async function createChargerFaultsTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS charger_faults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stationId INTEGER NOT NULL,
      chargerId TEXT NOT NULL,
      faultCode TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL,
      reportedAt TEXT NOT NULL,
      resolvedAt TEXT,
      FOREIGN KEY (stationId) REFERENCES stations(id) ON DELETE CASCADE
    );
  `);
}
async function createShipmentEventsTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS shipment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipmentId INTEGER NOT NULL,
      eventType TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (shipmentId) REFERENCES shipments(id) ON DELETE CASCADE
    );
  `);
}
async function createTruckArrivalEventsTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS truck_arrivals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stationId INTEGER NOT NULL,
      truckId INTEGER NOT NULL,
      driverId INTEGER NOT NULL,
      arrivedAt TEXT NOT NULL,
      FOREIGN KEY (stationId) REFERENCES stations(id),
      FOREIGN KEY (truckId) REFERENCES trucks(id),
      FOREIGN KEY (driverId) REFERENCES drivers(id)
    );
  `);
}
async function createBatteryEventsTable() {
    await runQuery(`
    CREATE TABLE IF NOT EXISTS battery_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batteryId INTEGER NOT NULL,
      eventType TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (batteryId) REFERENCES batteries(id) ON DELETE CASCADE
    );
  `);
}
async function initializeDatabase() {
    await new Promise((resolve, reject) => {
        const db = getDb();
        db.serialize(() => {
            db.run("PRAGMA journal_mode = WAL;");
            db.run("PRAGMA foreign_keys = ON;");
            db.run("SELECT 1;", (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    });
    await createUsersTable();
    await createStationsTable();
    await ensureStationColumns();
    await createFleetsTable();
    await createTrucksTable();
    await ensureTruckColumns();
    await createDriversTable();
    await ensureDriverColumns();
    await createBatteriesTable();
    await createSwapTransactionsTable();
    await createChargingSessionsTable();
    await createReceiptsTable();
    await createDriverTelemetryTable();
    await createShipmentsTable();
    await ensureShipmentColumns();
    await createTariffConfigTable();
    await createChargingWindowConfigTable();
    await createStationIncidentsTable();
    await createChargerFaultsTable();
    await createShipmentEventsTable();
    await createTruckArrivalEventsTable();
    await createBatteryEventsTable();
}

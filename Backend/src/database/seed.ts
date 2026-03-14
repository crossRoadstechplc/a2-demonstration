import { initializeDatabase, runQuery } from "./connection";

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
  { name: "Addis Hub", location: "Addis Ababa", capacity: 40, status: "ACTIVE" },
  { name: "Modjo", location: "Modjo", capacity: 24, status: "ACTIVE" },
  { name: "Adama", location: "Adama", capacity: 22, status: "ACTIVE" },
  { name: "Awash", location: "Awash", capacity: 16, status: "ACTIVE" },
  { name: "Mieso", location: "Mieso", capacity: 14, status: "ACTIVE" },
  { name: "Dire Dawa", location: "Dire Dawa", capacity: 22, status: "ACTIVE" },
  { name: "Dewelle", location: "Dewelle", capacity: 12, status: "ACTIVE" },
  { name: "Galafi", location: "Galafi", capacity: 12, status: "ACTIVE" },
  { name: "Semera", location: "Semera", capacity: 18, status: "ACTIVE" },
  { name: "Mille", location: "Mille", capacity: 18, status: "ACTIVE" },
  { name: "Gewane", location: "Gewane", capacity: 14, status: "ACTIVE" },
  { name: "Tendaho", location: "Tendaho", capacity: 10, status: "ACTIVE" },
  { name: "Logiya", location: "Logiya", capacity: 10, status: "ACTIVE" },
  { name: "Djibouti Gate", location: "Djibouti Border", capacity: 30, status: "ACTIVE" }
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

const truckTypes = ["STANDARD", "REFRIGERATED"] as const;
const truckStatuses = ["READY", "IN_TRANSIT", "MAINTENANCE"];
const driverStatuses = ["AVAILABLE", "ON_DUTY", "RESTING"];

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function pickRandom<T>(items: readonly T[]): T {
  return items[randomInt(items.length)];
}

export async function seedDemoData(): Promise<void> {
  await initializeDatabase();

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

  for (const station of stationSeed) {
    await runQuery(
      "INSERT INTO stations (name, location, capacity, status) VALUES (?, ?, ?, ?);",
      [station.name, station.location, station.capacity, station.status]
    );
  }

  const fleetIds: number[] = [];
  for (const fleet of fleetSeed) {
    const result = await runQuery(
      "INSERT INTO fleets (name, ownerName, region) VALUES (?, ?, ?);",
      [fleet.name, fleet.ownerName, fleet.region]
    );
    fleetIds.push(result.lastID);
  }

  for (let i = 1; i <= 200; i += 1) {
    const fleetId = pickRandom(fleetIds);
    const plateNumber = `ET-${String(i).padStart(4, "0")}`;
    const batteryId = `BAT-${String(i).padStart(4, "0")}`;
    const currentSoc = Number((30 + Math.random() * 70).toFixed(2));
    const truckType = pickRandom(truckTypes);
    const refrigerationPowerDraw = truckType === "REFRIGERATED" ? 8 : 0;
    const temperatureTarget = truckType === "REFRIGERATED" ? 4 : 0;
    const temperatureCurrent =
      truckType === "REFRIGERATED" ? Number((2 + Math.random() * 4).toFixed(2)) : 0;

    await runQuery(
      `
      INSERT INTO trucks
      (plateNumber, fleetId, truckType, batteryId, status, currentSoc, refrigerationPowerDraw, temperatureTarget, temperatureCurrent, currentStationId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
      [
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
      ]
    );
  }

  for (let i = 1; i <= 200; i += 1) {
    const fleetId = pickRandom(fleetIds);
    const name = `${pickRandom(firstNames)} ${pickRandom(lastNames)}`;
    const phone = `+2519${String(10000000 + i).padStart(8, "0")}`;
    const rating = Number((3.5 + Math.random() * 1.5).toFixed(2));

    await runQuery(
      "INSERT INTO drivers (name, phone, fleetId, rating, status) VALUES (?, ?, ?, ?, ?);",
      [name, phone, fleetId, rating, pickRandom(driverStatuses)]
    );
  }
}

async function runSeeder(): Promise<void> {
  await seedDemoData();
  console.log("Seed completed: 10 fleets, 200 trucks, 200 drivers, 14 stations.");
}

if (require.main === module) {
  runSeeder().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Seeder failed";
    console.error(message);
    process.exit(1);
  });
}

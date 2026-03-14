import { getQuery, initializeDatabase } from "../src/database/connection";
import { seedDemoData } from "../src/database/seed";

interface CountRow {
  count: number;
}

describe("Seed data", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  it("creates expected demo entity counts", async () => {
    await seedDemoData();

    const trucks = await getQuery<CountRow>("SELECT COUNT(*) as count FROM trucks;");
    const drivers = await getQuery<CountRow>("SELECT COUNT(*) as count FROM drivers;");
    const fleets = await getQuery<CountRow>("SELECT COUNT(*) as count FROM fleets;");

    expect(trucks?.count).toBe(200);
    expect(drivers?.count).toBe(200);
    expect(fleets?.count).toBe(10);
  });
});

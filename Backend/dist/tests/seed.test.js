"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("../src/database/connection");
const seed_1 = require("../src/database/seed");
describe("Seed data", () => {
    beforeAll(async () => {
        await (0, connection_1.initializeDatabase)();
    });
    it("creates expected demo entity counts", async () => {
        await (0, seed_1.seedDemoData)();
        const trucks = await (0, connection_1.getQuery)("SELECT COUNT(*) as count FROM trucks;");
        const drivers = await (0, connection_1.getQuery)("SELECT COUNT(*) as count FROM drivers;");
        const fleets = await (0, connection_1.getQuery)("SELECT COUNT(*) as count FROM fleets;");
        expect(trucks?.count).toBe(200);
        expect(drivers?.count).toBe(200);
        expect(fleets?.count).toBe(10);
    });
});

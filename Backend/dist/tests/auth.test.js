"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const connection_1 = require("../src/database/connection");
describe("Authentication", () => {
    beforeAll(async () => {
        await (0, connection_1.initializeDatabase)();
    });
    beforeEach(async () => {
        await (0, connection_1.runQuery)("DELETE FROM users;");
    });
    it("registers user", async () => {
        const response = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: "Alice Admin",
            email: "alice@example.com",
            password: "secret123",
            role: "ADMIN",
            organizationId: "ORG-001"
        });
        expect(response.status).toBe(201);
        expect(response.body.token).toBeDefined();
        expect(response.body.user.email).toBe("alice@example.com");
        expect(response.body.user.role).toBe("ADMIN");
    });
    it("logs in user", async () => {
        await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: "Bob Operator",
            email: "bob@example.com",
            password: "secret123",
            role: "A2_OPERATOR"
        });
        const response = await (0, supertest_1.default)(app_1.default).post("/auth/login").send({
            email: "bob@example.com",
            password: "secret123"
        });
        expect(response.status).toBe(200);
        expect(response.body.token).toBeDefined();
        expect(response.body.user.email).toBe("bob@example.com");
    });
    it("accesses protected route", async () => {
        const registerResponse = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: "Cara Fleet",
            email: "cara@example.com",
            password: "secret123",
            role: "FLEET_OWNER"
        });
        const token = registerResponse.body.token;
        const meResponse = await (0, supertest_1.default)(app_1.default)
            .get("/auth/me")
            .set("Authorization", `Bearer ${token}`);
        expect(meResponse.status).toBe(200);
        expect(meResponse.body.user.email).toBe("cara@example.com");
        expect(meResponse.body.user.role).toBe("FLEET_OWNER");
    });
    it("rejects invalid token", async () => {
        const response = await (0, supertest_1.default)(app_1.default)
            .get("/auth/me")
            .set("Authorization", "Bearer invalid-token");
        expect(response.status).toBe(401);
    });
});

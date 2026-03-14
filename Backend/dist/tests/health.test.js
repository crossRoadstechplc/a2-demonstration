"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
describe("GET /health", () => {
    it("returns status 200 and service health payload", async () => {
        const response = await (0, supertest_1.default)(app_1.default).get("/health");
        expect(response.status).toBe(200);
        expect(response.body.status).toBe("ok");
        expect(response.body.service).toBe("A2 Corridor Backend");
        expect(response.body.time).toBeDefined();
    });
});

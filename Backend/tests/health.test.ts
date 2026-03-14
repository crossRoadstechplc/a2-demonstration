import request from "supertest";

import app from "../src/app";

describe("GET /health", () => {
  it("returns status 200 and service health payload", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("A2 Corridor Backend");
    expect(response.body.time).toBeDefined();
  });
});

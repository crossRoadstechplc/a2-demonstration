import request from "supertest";

import app from "../src/app";
import { initializeDatabase, runQuery } from "../src/database/connection";

describe("Authentication", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await runQuery("DELETE FROM users;");
  });

  it("registers user", async () => {
    const response = await request(app).post("/auth/register").send({
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
    await request(app).post("/auth/register").send({
      name: "Bob Operator",
      email: "bob@example.com",
      password: "secret123",
      role: "A2_OPERATOR"
    });

    const response = await request(app).post("/auth/login").send({
      email: "bob@example.com",
      password: "secret123"
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
    expect(response.body.user.email).toBe("bob@example.com");
  });

  it("accesses protected route", async () => {
    const registerResponse = await request(app).post("/auth/register").send({
      name: "Cara Fleet",
      email: "cara@example.com",
      password: "secret123",
      role: "FLEET_OWNER"
    });

    const token = registerResponse.body.token as string;
    const meResponse = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.email).toBe("cara@example.com");
    expect(meResponse.body.user.role).toBe("FLEET_OWNER");
  });

  it("rejects invalid token", async () => {
    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
  });
});

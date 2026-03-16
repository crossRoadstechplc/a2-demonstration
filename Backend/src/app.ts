import express from "express";

import { SERVICE_NAME } from "./config/constants";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import authRouter from "./modules/auth/auth.routes";
import batteriesRouter from "./modules/batteries/batteries.routes";
import billingRouter from "./modules/billing/billing.routes";
import chargingRouter from "./modules/charging/charging.routes";
import corridorRouter from "./modules/corridor/corridor.routes";
import configRouter from "./modules/config/config.routes";
import demoRouter from "./modules/demo/demo.routes";
import dashboardRouter from "./modules/dashboard/dashboard.routes";
import freightRouter from "./modules/freight/freight.routes";
import simulationRouter from "./modules/simulation/simulation.routes";
import swapsRouter from "./modules/swaps/swaps.routes";

const app = express();

// Demo mode CORS: allow all origins so frontend can call backend from any local port.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());
app.use(requestLogger);
app.use("/auth", authRouter);
app.use(corridorRouter);
app.use(batteriesRouter);
app.use(chargingRouter);
app.use(swapsRouter);
app.use(billingRouter);
app.use(freightRouter);
app.use(dashboardRouter);
app.use(simulationRouter);
app.use(configRouter);
app.use(demoRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: SERVICE_NAME,
    time: new Date().toISOString()
  });
});

app.use(errorHandler);

export default app;

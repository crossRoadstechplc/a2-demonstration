"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const constants_1 = require("./config/constants");
const errorHandler_1 = require("./middleware/errorHandler");
const requestLogger_1 = require("./middleware/requestLogger");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const batteries_routes_1 = __importDefault(require("./modules/batteries/batteries.routes"));
const billing_routes_1 = __importDefault(require("./modules/billing/billing.routes"));
const charging_routes_1 = __importDefault(require("./modules/charging/charging.routes"));
const corridor_routes_1 = __importDefault(require("./modules/corridor/corridor.routes"));
const config_routes_1 = __importDefault(require("./modules/config/config.routes"));
const dashboard_routes_1 = __importDefault(require("./modules/dashboard/dashboard.routes"));
const freight_routes_1 = __importDefault(require("./modules/freight/freight.routes"));
const simulation_routes_1 = __importDefault(require("./modules/simulation/simulation.routes"));
const swaps_routes_1 = __importDefault(require("./modules/swaps/swaps.routes"));
const app = (0, express_1.default)();
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
app.use(express_1.default.json());
app.use(requestLogger_1.requestLogger);
app.use("/auth", auth_routes_1.default);
app.use(corridor_routes_1.default);
app.use(batteries_routes_1.default);
app.use(charging_routes_1.default);
app.use(swaps_routes_1.default);
app.use(billing_routes_1.default);
app.use(freight_routes_1.default);
app.use(dashboard_routes_1.default);
app.use(simulation_routes_1.default);
app.use(config_routes_1.default);
app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
        service: constants_1.SERVICE_NAME,
        time: new Date().toISOString()
    });
});
app.use(errorHandler_1.errorHandler);
exports.default = app;

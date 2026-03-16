"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const connection_1 = require("./database/connection");
const logger_1 = require("./utils/logger");
const PORT = 3049;
let httpServer = null;
async function startServer() {
    try {
        await (0, connection_1.initializeDatabase)();
        httpServer = app_1.default.listen(PORT, () => {
            (0, logger_1.logInfo)(`A2 Corridor Backend listening on port ${PORT}`);
        });
        globalThis.__A2_HTTP_SERVER__ = httpServer;
    }
    catch (error) {
        (0, logger_1.logError)(error instanceof Error ? error.message : "Failed to start the server");
        process.exit(1);
    }
}
function shutdown(signal) {
    if (!httpServer) {
        process.exit(0);
        return;
    }
    (0, logger_1.logInfo)(`Received ${signal}, shutting down server...`);
    httpServer.close(() => process.exit(0));
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
void startServer();

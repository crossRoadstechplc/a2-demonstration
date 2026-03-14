"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const logger_1 = require("../utils/logger");
function errorHandler(err, _req, res, _next) {
    const message = err instanceof Error ? err.message : "Internal server error";
    (0, logger_1.logError)(message);
    res.status(500).json({ error: message });
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_EXPIRES_IN = exports.JWT_SECRET = exports.DB_FILE_PATH = exports.SERVICE_NAME = void 0;
exports.SERVICE_NAME = "A2 Corridor Backend";
exports.DB_FILE_PATH = "data/a2_demo.db";
exports.JWT_SECRET = process.env.JWT_SECRET ?? "a2_demo_dev_secret";
exports.JWT_EXPIRES_IN = "1d";

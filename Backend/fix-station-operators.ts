/**
 * Quick fix script to link station operators to stations
 * Run with: npx ts-node fix-station-operators.ts
 */

import { fixStationOperatorLinks } from "./src/database/seed";

fixStationOperatorLinks()
  .then(() => {
    console.log("Fix completed successfully.");
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Fix failed";
    console.error(message);
    process.exit(1);
  });

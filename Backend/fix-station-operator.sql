-- Quick fix: Link station operators to stations
-- Run this SQL query to fix organizationId for station operators

-- Option 1: Link all unlinked STATION_OPERATOR users to stations (round-robin)
-- This will assign each unlinked operator to a station
UPDATE users
SET organizationId = (
  SELECT CAST(id AS TEXT)
  FROM stations
  WHERE stations.id = (
    SELECT id FROM stations
    ORDER BY id ASC
    LIMIT 1 OFFSET (
      (SELECT COUNT(*) FROM users u2 WHERE u2.role = 'STATION_OPERATOR' AND u2.id < users.id AND (u2.organizationId IS NULL OR u2.organizationId = ''))
      % (SELECT COUNT(*) FROM stations)
    )
  )
)
WHERE role = 'STATION_OPERATOR' 
  AND (organizationId IS NULL OR organizationId = '' OR organizationId NOT IN (SELECT CAST(id AS TEXT) FROM stations));

-- Option 2: Link a specific user to station 64
-- Replace 'your-email@example.com' with the actual email
-- UPDATE users 
-- SET organizationId = '64' 
-- WHERE email = 'your-email@example.com' AND role = 'STATION_OPERATOR';

-- Option 3: Link all STATION_OPERATOR users to station 64 (for testing)
-- UPDATE users 
-- SET organizationId = '64' 
-- WHERE role = 'STATION_OPERATOR';

-- ============================================
-- Quick fix: Link fleet owners to fleets
-- ============================================

-- Option 1: Link all unlinked FLEET_OWNER users to fleets (round-robin)
UPDATE users
SET organizationId = (
  SELECT CAST(id AS TEXT)
  FROM fleets
  WHERE fleets.id = (
    SELECT id FROM fleets
    ORDER BY id ASC
    LIMIT 1 OFFSET (
      (SELECT COUNT(*) FROM users u2 WHERE u2.role = 'FLEET_OWNER' AND u2.id < users.id AND (u2.organizationId IS NULL OR u2.organizationId = ''))
      % (SELECT COUNT(*) FROM fleets)
    )
  )
)
WHERE role = 'FLEET_OWNER' 
  AND (organizationId IS NULL OR organizationId = '' OR organizationId NOT IN (SELECT CAST(id AS TEXT) FROM fleets));

-- Option 2: Link a specific user to fleet 1
-- Replace 'your-email@example.com' with the actual email
-- UPDATE users 
-- SET organizationId = '1' 
-- WHERE email = 'your-email@example.com' AND role = 'FLEET_OWNER';

-- Option 3: Link all FLEET_OWNER users to fleet 1 (for testing)
-- UPDATE users 
-- SET organizationId = '1' 
-- WHERE role = 'FLEET_OWNER';

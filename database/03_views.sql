-- ============================================================
-- Police Record Management System — Views
-- File: 03_views.sql
-- Run THIRD, after 02_seed.sql.
-- ============================================================
-- IMPORTANT NOTE ON JOIN CARDINALITY:
-- We do NOT join multiple independent one-to-many children
-- into one flat view.  For example, if a FIR has 2 victims
-- AND 3 evidence items, a single JOIN would produce 2×3 = 6
-- duplicate rows (a Cartesian product).  Instead we create
-- separate views for each child relationship.
-- ============================================================

USE police_records_db;

-- ============================================================
-- VIEW 1: vw_pending_cases
-- Shows all FIRs with status = 'Pending'.
-- Joins with officer and station for human-readable output.
-- Join cardinality: case_fir 1:1 officer, case_fir 1:1 station
--   → no duplicates.
-- ============================================================
CREATE OR REPLACE VIEW vw_pending_cases AS
SELECT
    cf.fir_number,
    cf.case_type,
    cf.registration_date,
    cf.location       AS incident_location,
    cf.description,
    o.name             AS investigating_officer,
    o.designation      AS officer_designation,
    ps.station_name,
    ps.location        AS station_location
FROM case_fir cf
    INNER JOIN officer o        ON cf.officer_id  = o.officer_id
    INNER JOIN police_station ps ON cf.station_id  = ps.station_id
WHERE cf.status = 'Pending';

-- ============================================================
-- VIEW 2: vw_solved_cases
-- Same structure as vw_pending_cases but for status = 'Solved'.
-- Join cardinality: same — no duplicates.
-- ============================================================
CREATE OR REPLACE VIEW vw_solved_cases AS
SELECT
    cf.fir_number,
    cf.case_type,
    cf.registration_date,
    cf.location       AS incident_location,
    cf.description,
    o.name             AS investigating_officer,
    o.designation      AS officer_designation,
    ps.station_name,
    ps.location        AS station_location
FROM case_fir cf
    INNER JOIN officer o        ON cf.officer_id  = o.officer_id
    INNER JOIN police_station ps ON cf.station_id  = ps.station_id
WHERE cf.status = 'Solved';

-- ============================================================
-- VIEW 3: vw_officer_case_load
-- Shows how many FIRs each officer is handling, grouped by status.
-- Uses GROUP BY with COUNT — one row per (officer, status) pair.
-- Join cardinality: officer 1:M case_fir → GROUP BY collapses to 1 row each.
-- ============================================================
CREATE OR REPLACE VIEW vw_officer_case_load AS
SELECT
    o.officer_id,
    o.name             AS officer_name,
    o.designation,
    ps.station_name,
    cf.status          AS case_status,
    COUNT(cf.fir_number) AS case_count
FROM officer o
    INNER JOIN police_station ps ON o.station_id  = ps.station_id
    LEFT JOIN  case_fir cf       ON o.officer_id  = cf.officer_id
GROUP BY o.officer_id, o.name, o.designation, ps.station_name, cf.status;

-- ============================================================
-- VIEW 4: vw_station_case_summary
-- Shows total FIRs per station with breakdown by status.
-- Uses conditional aggregation (SUM + CASE) — one row per station.
-- Join cardinality: station 1:M case_fir → GROUP BY collapses.
-- ============================================================
CREATE OR REPLACE VIEW vw_station_case_summary AS
SELECT
    ps.station_id,
    ps.station_name,
    ps.location AS station_location,
    COUNT(cf.fir_number)                                              AS total_cases,
    SUM(CASE WHEN cf.status = 'Pending'              THEN 1 ELSE 0 END) AS pending_cases,
    SUM(CASE WHEN cf.status = 'Under Investigation'  THEN 1 ELSE 0 END) AS investigation_cases,
    SUM(CASE WHEN cf.status = 'Solved'               THEN 1 ELSE 0 END) AS solved_cases,
    SUM(CASE WHEN cf.status = 'Closed'               THEN 1 ELSE 0 END) AS closed_cases
FROM police_station ps
    LEFT JOIN case_fir cf ON ps.station_id = cf.station_id
GROUP BY ps.station_id, ps.station_name, ps.location;

-- ============================================================
-- VIEW 5: vw_criminal_full_record
-- Shows each criminal with every FIR they are linked to and
-- every arrest they have.  We join case_criminal and arrest
-- INDEPENDENTLY (not together), so we use two separate
-- sub-views or a careful LEFT JOIN.
--
-- Strategy: criminal LEFT JOIN case_criminal LEFT JOIN case_fir
--   gives one row per (criminal, linked FIR).
--   This is safe because case_criminal → case_fir is M:1.
--   We DO NOT join arrest here to avoid Cartesian products.
--
-- For arrest history, query the arrest table separately by criminal_id.
-- ============================================================
CREATE OR REPLACE VIEW vw_criminal_full_record AS
SELECT
    c.criminal_id,
    c.name          AS criminal_name,
    c.age,
    c.gender,
    c.address,
    cf.fir_number,
    cf.case_type,
    cf.status       AS case_status,
    cf.registration_date,
    cf.location     AS incident_location
FROM criminal c
    LEFT JOIN case_criminal cc ON c.criminal_id = cc.criminal_id
    LEFT JOIN case_fir cf      ON cc.fir_number = cf.fir_number;

-- ============================================================
-- VIEW 6: vw_fir_details
-- Shows each FIR with its officer and station information.
-- Join cardinality: case_fir 1:1 officer, case_fir 1:1 station
--   → exactly one row per FIR.  No child tables are joined here.
--
-- Child records (criminals, victims, witnesses, evidence, arrests)
-- should be queried SEPARATELY by fir_number to avoid
-- Cartesian product duplicates.
-- ============================================================
CREATE OR REPLACE VIEW vw_fir_details AS
SELECT
    cf.fir_number,
    cf.case_type,
    cf.registration_date,
    cf.location       AS incident_location,
    cf.description,
    cf.status,
    o.officer_id,
    o.name             AS investigating_officer,
    o.designation      AS officer_designation,
    o.contact_number   AS officer_contact,
    ps.station_id,
    ps.station_name,
    ps.location        AS station_location,
    ps.contact_number  AS station_contact
FROM case_fir cf
    INNER JOIN officer o        ON cf.officer_id  = o.officer_id
    INNER JOIN police_station ps ON cf.station_id  = ps.station_id;

-- ============================================================
-- Views created.
-- Run 04_procedures_triggers.sql next.
-- ============================================================


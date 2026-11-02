-- ============================================================
-- Police Record Management System — Demo Queries
-- File: 05_demo_queries.sql
-- Run LAST, after 04_procedures_triggers.sql.
-- These queries demonstrate every SQL concept needed for a
-- DBMS viva. Run them one at a time and observe the output.
-- ============================================================

USE police_records_db;

-- ============================================================
-- 1. BASIC SELECT + WHERE + ORDER BY
-- ============================================================

-- Q1.1: List all officers, ordered by name
-- Expected: 8 rows, alphabetically sorted.
SELECT officer_id, name, designation, contact_number, station_id
FROM officer
ORDER BY name;

-- Q1.2: Find all FIRs of type 'Cybercrime'
-- Expected: 2 rows (FIR-2024-002, FIR-2024-010).
SELECT fir_number, case_type, registration_date, status
FROM case_fir
WHERE case_type = 'Cybercrime';

-- Q1.3: FIRs registered after June 2024, ordered by date descending
-- Expected: FIR-2024-011 through FIR-2024-015.
SELECT fir_number, case_type, registration_date, status
FROM case_fir
WHERE registration_date > '2024-06-30'
ORDER BY registration_date DESC;

-- ============================================================
-- 2. INNER JOIN (two tables)
-- ============================================================

-- Q2.1: List each FIR with its investigating officer's name
-- Join cardinality: case_fir M:1 officer → one row per FIR.
-- Expected: 15 rows.
SELECT cf.fir_number, cf.case_type, cf.status,
       o.name AS officer_name, o.designation
FROM case_fir cf
    INNER JOIN officer o ON cf.officer_id = o.officer_id;

-- ============================================================
-- 3. LEFT JOIN
-- ============================================================

-- Q3.1: All officers with their FIR count (including officers with 0 FIRs)
-- LEFT JOIN ensures officers with no FIRs still appear.
-- Expected: 8 rows. Officers with 0 cases show case_count = 0.
SELECT o.officer_id, o.name, o.designation,
       COUNT(cf.fir_number) AS case_count
FROM officer o
    LEFT JOIN case_fir cf ON o.officer_id = cf.officer_id
GROUP BY o.officer_id, o.name, o.designation
ORDER BY case_count DESC;

-- ============================================================
-- 4. MULTI-TABLE JOIN (three or more tables)
-- ============================================================

-- Q4.1: For each arrest, show criminal name, FIR number, case type,
--        and arresting officer's name.
-- Joins: arrest → criminal, arrest → case_fir, arrest → officer
-- Expected: 8 rows (one per arrest).
SELECT a.arrest_id, a.arrest_date, a.location AS arrest_location,
       c.name AS criminal_name,
       cf.fir_number, cf.case_type,
       o.name AS arresting_officer
FROM arrest a
    INNER JOIN criminal c  ON a.criminal_id = c.criminal_id
    INNER JOIN case_fir cf ON a.fir_number  = cf.fir_number
    INNER JOIN officer o   ON a.officer_id  = o.officer_id
ORDER BY a.arrest_date;

-- Q4.2: List all evidence for each FIR along with station info
-- Joins: evidence → case_fir → police_station
-- Expected: 15 rows (one per evidence item).
SELECT e.evidence_id, e.evidence_type, e.collection_date,
       cf.fir_number, cf.case_type,
       ps.station_name
FROM evidence e
    INNER JOIN case_fir cf      ON e.fir_number  = cf.fir_number
    INNER JOIN police_station ps ON cf.station_id = ps.station_id
ORDER BY e.collection_date;

-- ============================================================
-- 5. GROUP BY + HAVING + Aggregate Functions
-- ============================================================

-- Q5.1: COUNT — Number of FIRs per station
-- Expected: 3 rows (5 FIRs each).
SELECT ps.station_name, COUNT(cf.fir_number) AS total_firs
FROM police_station ps
    INNER JOIN case_fir cf ON ps.station_id = cf.station_id
GROUP BY ps.station_name;

-- Q5.2: COUNT + HAVING — Stations with more than 4 FIRs
-- Expected: 3 rows (all stations have exactly 5 each).
SELECT ps.station_name, COUNT(cf.fir_number) AS total_firs
FROM police_station ps
    INNER JOIN case_fir cf ON ps.station_id = cf.station_id
GROUP BY ps.station_name
HAVING total_firs > 4;

-- Q5.3: AVG — Average age of criminals
-- Expected: single row, approximately 32.
SELECT AVG(age) AS average_criminal_age FROM criminal;

-- Q5.4: MAX + MIN — Oldest and youngest criminal
-- Expected: MIN = 22 (Naveen Gowda), MAX = 45 (Dinesh Babu).
SELECT MIN(age) AS youngest, MAX(age) AS oldest FROM criminal;

-- Q5.5: SUM (using conditional aggregation) — FIR status breakdown
-- Expected: single row with counts of each status.
SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN status = 'Pending'             THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN status = 'Under Investigation' THEN 1 ELSE 0 END) AS investigating,
    SUM(CASE WHEN status = 'Solved'              THEN 1 ELSE 0 END) AS solved,
    SUM(CASE WHEN status = 'Closed'              THEN 1 ELSE 0 END) AS closed
FROM case_fir;

-- Q5.6: Criminals involved in more than 1 case (repeat offenders)
-- Expected: Sunil Yadav (2 cases), Farooq Ahmed (2), Naveen Gowda (2).
SELECT c.criminal_id, c.name, COUNT(cc.fir_number) AS cases_involved
FROM criminal c
    INNER JOIN case_criminal cc ON c.criminal_id = cc.criminal_id
GROUP BY c.criminal_id, c.name
HAVING cases_involved > 1
ORDER BY cases_involved DESC;

-- ============================================================
-- 6. SUBQUERIES
-- ============================================================

-- Q6.1: Scalar subquery — FIRs handled by officers at Indiranagar station
-- The subquery finds the station_id for Indiranagar.
-- Expected: 5 FIRs.
SELECT fir_number, case_type, status
FROM case_fir
WHERE station_id = (
    SELECT station_id FROM police_station
    WHERE station_name = 'Indiranagar Police Station'
);

-- Q6.2: IN subquery — Criminals who have been arrested
-- Expected: 6 distinct criminals (those in the arrest table).
SELECT criminal_id, name, age, gender
FROM criminal
WHERE criminal_id IN (
    SELECT DISTINCT criminal_id FROM arrest
);

-- ============================================================
-- 7. CORRELATED SUBQUERIES
-- ============================================================

-- Q7.1: For each station, find the officer handling the most cases.
-- The inner query references the outer query's station_id.
-- Expected: one "top officer" per station (3 rows).
SELECT o.name AS officer_name, o.designation,
       ps.station_name,
       (SELECT COUNT(*) FROM case_fir cf
        WHERE cf.officer_id = o.officer_id) AS case_count
FROM officer o
    INNER JOIN police_station ps ON o.station_id = ps.station_id
WHERE (SELECT COUNT(*) FROM case_fir cf
       WHERE cf.officer_id = o.officer_id) = (
    SELECT MAX(cnt) FROM (
        SELECT COUNT(*) AS cnt
        FROM case_fir cf2
            INNER JOIN officer o2 ON cf2.officer_id = o2.officer_id
        WHERE o2.station_id = o.station_id
        GROUP BY o2.officer_id
    ) AS sub
);

-- ============================================================
-- 8. EXISTS and NOT EXISTS
-- ============================================================

-- Q8.1: EXISTS — Find criminals who have at least one arrest record
-- Expected: 6 criminals.
SELECT c.criminal_id, c.name
FROM criminal c
WHERE EXISTS (
    SELECT 1 FROM arrest a
    WHERE a.criminal_id = c.criminal_id
);

-- Q8.2: NOT EXISTS — Find criminals who have NEVER been arrested
-- Expected: 6 criminals (Prakash, Lakshmi, Pooja, Kiran, Savitha, + Anil
--           — wait, Anil was arrested in FIR-2024-006).
-- Actually: Prakash(5), Lakshmi(6), Pooja(9), Kiran(11), Savitha(12), Naveen? 
-- No — Naveen(7) was arrested. Let's check: arrested = {1,2,3,4,8,10,7}=7 unique
-- Not arrested = {5,6,9,11,12} = 5 criminals.
-- (Anil id=8 WAS arrested in FIR-2024-006)
SELECT c.criminal_id, c.name
FROM criminal c
WHERE NOT EXISTS (
    SELECT 1 FROM arrest a
    WHERE a.criminal_id = c.criminal_id
);

-- Q8.3: NOT EXISTS — FIRs that have no evidence collected yet
-- Expected: FIRs 003, 005 has evidence... let's check.
-- Evidence exists for: 001,002,003,004,005,006,008,010,011,012,013,014
-- Missing evidence: FIR-2024-007, FIR-2024-009, FIR-2024-015
SELECT cf.fir_number, cf.case_type, cf.status
FROM case_fir cf
WHERE NOT EXISTS (
    SELECT 1 FROM evidence e
    WHERE e.fir_number = cf.fir_number
);

-- ============================================================
-- 9. USING VIEWS
-- ============================================================

-- Q9.1: Query the pending cases view
-- Expected: FIR-2024-002, 004, 008, 010, 014 (5 pending cases).
SELECT * FROM vw_pending_cases;

-- Q9.2: Query the solved cases view
-- Expected: FIR-2024-003, 007, 011 (3 solved cases).
SELECT * FROM vw_solved_cases;

-- Q9.3: Officer case load
-- Expected: one row per (officer, status) combination.
SELECT * FROM vw_officer_case_load
ORDER BY officer_name, case_status;

-- Q9.4: Station case summary
-- Expected: 3 rows — one per station with status breakdowns.
SELECT * FROM vw_station_case_summary;

-- Q9.5: Criminal full record
-- Shows each criminal with every linked FIR.
-- Expected: 15 rows from case_criminal + any criminals with no links.
SELECT * FROM vw_criminal_full_record
ORDER BY criminal_name, fir_number;

-- Q9.6: FIR details view
-- Expected: 15 rows — one per FIR with officer and station info.
SELECT * FROM vw_fir_details
ORDER BY registration_date;

-- ============================================================
-- 10. STORED PROCEDURE CALLS
-- ============================================================

-- Q10.1: Assign officer 5 (SI Arun Patel) to FIR-2024-002
-- Before: officer_id = 2 (SI Priya Sharma)
-- After:  officer_id = 5 (SI Arun Patel)
SELECT fir_number, officer_id FROM case_fir WHERE fir_number = 'FIR-2024-002';
CALL sp_assign_officer_to_case('FIR-2024-002', 5);
SELECT fir_number, officer_id FROM case_fir WHERE fir_number = 'FIR-2024-002';
-- Expected: officer_id changed from 2 to 5.

-- Q10.2: Try assigning to a non-existent FIR (should fail)
-- Expected: Error "FIR not found..."
-- CALL sp_assign_officer_to_case('FIR-9999-999', 1);

-- Q10.3: Try assigning a non-existent officer (should fail)
-- Expected: Error "Officer not found..."
-- CALL sp_assign_officer_to_case('FIR-2024-001', 999);

-- Q10.4: Close case FIR-2024-003 (currently 'Solved')
-- Before: status = 'Solved'
-- After:  status = 'Closed'
SELECT fir_number, status FROM case_fir WHERE fir_number = 'FIR-2024-003';
CALL sp_close_case('FIR-2024-003');
SELECT fir_number, status FROM case_fir WHERE fir_number = 'FIR-2024-003';
-- Expected: status changed to 'Closed'.

-- Q10.5: Try closing FIR-2024-003 again (should fail — already Closed)
-- Expected: Error "Case is already closed..."
-- CALL sp_close_case('FIR-2024-003');

-- ============================================================
-- 11. TRIGGER DEMONSTRATIONS
-- ============================================================

-- Q11.1: trg_update_case_status_after_arrest
-- Insert an arrest for FIR-2024-004 (currently 'Pending').
-- The AFTER INSERT trigger should auto-change it to 'Under Investigation'.
SELECT fir_number, status FROM case_fir WHERE fir_number = 'FIR-2024-004';
-- Expected: 'Pending'
INSERT INTO arrest (arrest_date, location, criminal_id, fir_number, officer_id)
VALUES ('2024-10-01', 'MG Road, Bengaluru', 5, 'FIR-2024-004', 3);
SELECT fir_number, status FROM case_fir WHERE fir_number = 'FIR-2024-004';
-- Expected: 'Under Investigation' (auto-changed by trigger)

-- Q11.2: trg_block_arrest_on_closed_case
-- Try to insert an arrest for FIR-2024-005 (status = 'Closed').
-- The BEFORE INSERT trigger should reject this with an error.
SELECT fir_number, status FROM case_fir WHERE fir_number = 'FIR-2024-005';
-- Expected: 'Closed'
-- Uncomment the line below to test (it WILL fail):
-- INSERT INTO arrest (arrest_date, location, criminal_id, fir_number, officer_id)
-- VALUES ('2024-10-05', 'Test Location', 6, 'FIR-2024-005', 2);
-- Expected Error: "Cannot record arrest: the FIR is already closed."

-- ============================================================
-- 12. UPDATE + DELETE (preserving referential integrity)
-- ============================================================

-- Q12.1: UPDATE — Change a criminal's address
UPDATE criminal
SET address = '99, Koramangala 5th Block, Bengaluru'
WHERE criminal_id = 8;

SELECT criminal_id, name, address FROM criminal WHERE criminal_id = 8;
-- Expected: address updated for Anil Kumar.

-- Q12.2: UPDATE — Change a victim's contact number
UPDATE victim
SET contact_number = '9988776699'
WHERE victim_id = 3;

SELECT victim_id, name, contact_number FROM victim WHERE victim_id = 3;
-- Expected: Ramesh Babu's contact updated.

-- Q12.3: DELETE — Remove a case_criminal link (CASCADE-safe junction table)
-- This is safe because case_criminal is just a relationship — no independent data.
DELETE FROM case_criminal
WHERE fir_number = 'FIR-2024-009' AND criminal_id = 11;

SELECT * FROM case_criminal WHERE fir_number = 'FIR-2024-009';
-- Expected: only criminal_id = 2 remains for FIR-2024-009.

-- Q12.4: DELETE — Try to delete a station that has officers (should fail)
-- Expected Error: Cannot delete — FK constraint fk_officer_station.
-- DELETE FROM police_station WHERE station_id = 1;

-- Q12.5: DELETE — Try to delete a criminal who has arrest records (should fail)
-- Expected Error: Cannot delete — FK constraint fk_arrest_criminal.
-- DELETE FROM criminal WHERE criminal_id = 1;

-- Q12.6: DELETE — Safe deletion of a witness (no child dependencies)
-- First, let's see witnesses for FIR-2024-014:
SELECT * FROM witness WHERE fir_number = 'FIR-2024-014';
-- Delete the witness:
DELETE FROM witness WHERE witness_id = 10;
-- Verify:
SELECT * FROM witness WHERE fir_number = 'FIR-2024-014';
-- Expected: Kumar Swamy removed (no FK violations because witness has no children).

-- ============================================================
-- 13. BONUS: Useful analytical queries
-- ============================================================

-- Q13.1: Monthly FIR registration trend
SELECT
    DATE_FORMAT(registration_date, '%Y-%m') AS month,
    COUNT(*) AS firs_registered
FROM case_fir
GROUP BY month
ORDER BY month;

-- Q13.2: Most common case types
SELECT case_type, COUNT(*) AS occurrence
FROM case_fir
GROUP BY case_type
ORDER BY occurrence DESC;

-- Q13.3: Officers who have made arrests (with arrest count)
SELECT o.name, o.designation, COUNT(a.arrest_id) AS arrests_made
FROM officer o
    INNER JOIN arrest a ON o.officer_id = a.officer_id
GROUP BY o.officer_id, o.name, o.designation
ORDER BY arrests_made DESC;

-- ============================================================
-- End of demo queries.
-- All five SQL files are now complete.
-- ============================================================


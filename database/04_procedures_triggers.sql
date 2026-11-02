-- ============================================================
-- Police Record Management System — Stored Procedures & Triggers
-- File: 04_procedures_triggers.sql
-- Run FOURTH, after 03_views.sql.
-- ============================================================

USE police_records_db;

-- ============================================================
-- STORED PROCEDURE 1: sp_assign_officer_to_case
-- ============================================================
-- PURPOSE: Reassign a FIR to a different officer.
-- UPDATES ONLY officer_id in case_fir.
-- Does NOT change station_id because station_id records WHERE
-- the FIR was originally registered — that's a historical fact
-- that must never change even if the investigating officer is
-- from a different station.
--
-- STEPS:
--   1. Validate that the FIR exists.
--   2. Validate that the officer exists.
--   3. Update officer_id inside a transaction.
--   4. Handle errors with SIGNAL.
-- ============================================================
DELIMITER //

CREATE PROCEDURE sp_assign_officer_to_case(
    IN p_fir_number VARCHAR(30),
    IN p_officer_id INT
)
BEGIN
    DECLARE v_fir_exists   INT DEFAULT 0;
    DECLARE v_off_exists   INT DEFAULT 0;

    -- Check if FIR exists
    SELECT COUNT(*) INTO v_fir_exists
    FROM case_fir WHERE fir_number = p_fir_number;

    IF v_fir_exists = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'FIR not found: the specified FIR number does not exist.';
    END IF;

    -- Check if officer exists
    SELECT COUNT(*) INTO v_off_exists
    FROM officer WHERE officer_id = p_officer_id;

    IF v_off_exists = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Officer not found: the specified officer ID does not exist.';
    END IF;

    -- Perform the update inside a transaction
    START TRANSACTION;
        UPDATE case_fir
        SET officer_id = p_officer_id
        WHERE fir_number = p_fir_number;
    COMMIT;
END //

DELIMITER ;

-- ============================================================
-- STORED PROCEDURE 2: sp_close_case
-- ============================================================
-- PURPOSE: Set a FIR's status to 'Closed'.
-- DESIGN CHOICE: If the case is already Closed, we raise an
-- error instead of silently succeeding.  Why?
--   1. Idempotent "close" would hide double-clicks and bugs.
--   2. In a police system, closing an already-closed case
--      could indicate a process error that should be flagged.
--   3. It demonstrates SIGNAL usage for the DBMS viva.
-- ============================================================
DELIMITER //

CREATE PROCEDURE sp_close_case(
    IN p_fir_number VARCHAR(30)
)
BEGIN
    DECLARE v_current_status VARCHAR(30);

    -- Check if FIR exists; if not, the variable stays NULL
    SELECT status INTO v_current_status
    FROM case_fir
    WHERE fir_number = p_fir_number;

    IF v_current_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'FIR not found: the specified FIR number does not exist.';
    END IF;

    IF v_current_status = 'Closed' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Case is already closed: cannot close a case that is already closed.';
    END IF;

    START TRANSACTION;
        UPDATE case_fir
        SET status = 'Closed'
        WHERE fir_number = p_fir_number;
    COMMIT;
END //

DELIMITER ;

-- ============================================================
-- TRIGGER 1: trg_block_arrest_on_closed_case
-- ============================================================
-- TYPE:    BEFORE INSERT ON arrest
-- PURPOSE: Prevent recording an arrest on a case that is already
--          Closed.  Once a case is closed, no new arrests should
--          be made under it — that's legally inconsistent.
-- USES:    SIGNAL SQLSTATE '45000' to reject the INSERT.
-- ============================================================
DELIMITER //

CREATE TRIGGER trg_block_arrest_on_closed_case
BEFORE INSERT ON arrest
FOR EACH ROW
BEGIN
    DECLARE v_case_status VARCHAR(30);

    SELECT status INTO v_case_status
    FROM case_fir
    WHERE fir_number = NEW.fir_number;

    IF v_case_status = 'Closed' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot record arrest: the FIR is already closed.';
    END IF;
END //

DELIMITER ;

-- ============================================================
-- TRIGGER 2: trg_update_case_status_after_arrest
-- ============================================================
-- TYPE:    AFTER INSERT ON arrest
-- PURPOSE: When an arrest is made, automatically move the case
--          from 'Pending' to 'Under Investigation'.
--          If the case is already 'Under Investigation', 'Solved'
--          or 'Closed', do nothing — we should never downgrade
--          a Solved case or reopen a Closed one automatically.
--
-- EXECUTION ORDER:
--   1. trg_block_arrest_on_closed_case fires FIRST (BEFORE INSERT).
--      If case is Closed, the insert is rejected — this trigger
--      never fires.
--   2. The INSERT into arrest happens.
--   3. trg_update_case_status_after_arrest fires (AFTER INSERT).
--      It only changes Pending → Under Investigation.
--
-- INTERACTION WITH PROCEDURES:
--   - sp_close_case sets status to 'Closed'.
--   - After that, trg_block_arrest_on_closed_case prevents
--     any new arrests on that FIR.
--   - So this trigger will never see a 'Closed' status,
--     because the BEFORE trigger already blocked it.
-- ============================================================
DELIMITER //

CREATE TRIGGER trg_update_case_status_after_arrest
AFTER INSERT ON arrest
FOR EACH ROW
BEGIN
    DECLARE v_case_status VARCHAR(30);

    SELECT status INTO v_case_status
    FROM case_fir
    WHERE fir_number = NEW.fir_number;

    -- Only upgrade Pending → Under Investigation
    IF v_case_status = 'Pending' THEN
        UPDATE case_fir
        SET status = 'Under Investigation'
        WHERE fir_number = NEW.fir_number;
    END IF;
END //

DELIMITER ;

-- ============================================================
-- Procedures and triggers created.
-- Run 05_demo_queries.sql next to test everything.
-- ============================================================


-- ============================================================
-- Police Record Management System — Schema
-- File: 01_schema.sql
-- Run FIRST. Creates the database and all nine tables.
-- ============================================================
-- WHY InnoDB?  InnoDB supports foreign keys, transactions,
-- row-level locking and crash recovery — essential for a
-- system that stores legal records.
-- ============================================================

-- Create the database (idempotent)
CREATE DATABASE IF NOT EXISTS police_records_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE police_records_db;

-- ============================================================
-- TABLE 1: police_station
-- Stores police station information.
-- This is a "parent" table — officers and FIRs reference it.
-- ============================================================
CREATE TABLE IF NOT EXISTS police_station (
    station_id      INT             AUTO_INCREMENT,
    station_name    VARCHAR(100)    NOT NULL,
    location        VARCHAR(255)    NOT NULL,
    contact_number  VARCHAR(15)     NOT NULL,

    PRIMARY KEY (station_id),
    UNIQUE KEY uq_station_contact (contact_number)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE 2: officer
-- Each officer belongs to exactly one station (1:M).
-- ============================================================
CREATE TABLE IF NOT EXISTS officer (
    officer_id      INT             AUTO_INCREMENT,
    name            VARCHAR(100)    NOT NULL,
    designation     VARCHAR(75)     NOT NULL,
    contact_number  VARCHAR(15)     NOT NULL,
    station_id      INT             NOT NULL,

    PRIMARY KEY (officer_id),
    UNIQUE KEY uq_officer_contact (contact_number),

    -- FK: officer -> police_station
    -- RESTRICT: don't allow deleting a station that still has officers assigned.
    -- Deleting a station with active officers would orphan their records.
    CONSTRAINT fk_officer_station
        FOREIGN KEY (station_id) REFERENCES police_station(station_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Index on FK column for faster JOINs
CREATE INDEX idx_officer_station ON officer(station_id);

-- ============================================================
-- TABLE 3: case_fir
-- FIR (First Information Report) is the core record.
-- Each FIR is registered at one station and assigned to one officer.
-- fir_number is a human-readable PK (e.g., "FIR-2024-001").
-- ============================================================
CREATE TABLE IF NOT EXISTS case_fir (
    fir_number          VARCHAR(30)     NOT NULL,
    case_type           VARCHAR(100)    NOT NULL,
    registration_date   DATE            NOT NULL,
    location            VARCHAR(255)    NOT NULL,
    description         TEXT,
    status              VARCHAR(30)     NOT NULL DEFAULT 'Pending',
    officer_id          INT             NOT NULL,
    station_id          INT             NOT NULL,

    PRIMARY KEY (fir_number),

    -- CHECK: status can only be one of four valid values.
    -- This enforces data integrity at the database level.
    CONSTRAINT chk_case_status
        CHECK (status IN ('Pending', 'Under Investigation', 'Solved', 'Closed')),

    -- FK: case_fir -> officer
    -- RESTRICT: an officer who has FIRs assigned cannot be deleted.
    -- FIR records are legal documents and must not lose their investigating officer.
    CONSTRAINT fk_case_officer
        FOREIGN KEY (officer_id) REFERENCES officer(officer_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- FK: case_fir -> police_station
    -- RESTRICT: a station with registered FIRs cannot be deleted.
    -- station_id records WHERE the FIR was filed — that's a historical fact.
    CONSTRAINT fk_case_station
        FOREIGN KEY (station_id) REFERENCES police_station(station_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Indexes on FK columns and on status (frequently filtered)
CREATE INDEX idx_case_officer  ON case_fir(officer_id);
CREATE INDEX idx_case_station  ON case_fir(station_id);
CREATE INDEX idx_case_status   ON case_fir(status);

-- ============================================================
-- TABLE 4: criminal
-- Stores criminal profiles. Independent of cases initially;
-- linked via the junction table case_criminal.
-- ============================================================
CREATE TABLE IF NOT EXISTS criminal (
    criminal_id INT             AUTO_INCREMENT,
    name        VARCHAR(100)    NOT NULL,
    age         INT             NOT NULL,
    gender      VARCHAR(20)     NOT NULL,
    address     VARCHAR(255)    NOT NULL,

    PRIMARY KEY (criminal_id),

    -- CHECK: age must be a positive integer.
    CONSTRAINT chk_criminal_age CHECK (age > 0)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE 5: case_criminal (Junction / Bridge Table)
-- Implements the M:N relationship between case_fir and criminal.
-- One FIR can involve many criminals; one criminal can appear
-- in many FIRs.
-- ============================================================
CREATE TABLE IF NOT EXISTS case_criminal (
    fir_number  VARCHAR(30)  NOT NULL,
    criminal_id INT          NOT NULL,

    -- Composite PK prevents duplicate links.
    PRIMARY KEY (fir_number, criminal_id),

    -- FK: case_criminal -> case_fir
    -- CASCADE: if a FIR is somehow removed, the links go too.
    -- This is the ONLY table that uses CASCADE on delete because
    -- it is a pure relationship table with no independent data.
    CONSTRAINT fk_cc_fir
        FOREIGN KEY (fir_number) REFERENCES case_fir(fir_number)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    -- FK: case_criminal -> criminal
    -- RESTRICT: don't delete a criminal who is linked to cases.
    -- The criminal's involvement in cases is a legal record.
    CONSTRAINT fk_cc_criminal
        FOREIGN KEY (criminal_id) REFERENCES criminal(criminal_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Index on criminal_id (fir_number is already part of the PK)
CREATE INDEX idx_cc_criminal ON case_criminal(criminal_id);

-- ============================================================
-- TABLE 6: arrest
-- Records an arrest event. Links a criminal, a FIR and
-- the arresting officer.
-- ============================================================
CREATE TABLE IF NOT EXISTS arrest (
    arrest_id   INT             AUTO_INCREMENT,
    arrest_date DATE            NOT NULL,
    location    VARCHAR(255)    NOT NULL,
    criminal_id INT             NOT NULL,
    fir_number  VARCHAR(30)     NOT NULL,
    officer_id  INT             NOT NULL,

    PRIMARY KEY (arrest_id),

    -- FK: arrest -> criminal
    -- RESTRICT: can't delete a criminal who has arrest records.
    CONSTRAINT fk_arrest_criminal
        FOREIGN KEY (criminal_id) REFERENCES criminal(criminal_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- FK: arrest -> case_fir
    -- RESTRICT: can't delete a FIR that has arrest records.
    -- Arrest records are legal evidence.
    CONSTRAINT fk_arrest_fir
        FOREIGN KEY (fir_number) REFERENCES case_fir(fir_number)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- FK: arrest -> officer
    -- RESTRICT: can't delete an officer who has made arrests.
    CONSTRAINT fk_arrest_officer
        FOREIGN KEY (officer_id) REFERENCES officer(officer_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Indexes on FK columns
CREATE INDEX idx_arrest_criminal ON arrest(criminal_id);
CREATE INDEX idx_arrest_fir      ON arrest(fir_number);
CREATE INDEX idx_arrest_officer  ON arrest(officer_id);

-- ============================================================
-- TABLE 7: victim
-- Each victim is linked to exactly one FIR.
-- ============================================================
CREATE TABLE IF NOT EXISTS victim (
    victim_id       INT             AUTO_INCREMENT,
    name            VARCHAR(100)    NOT NULL,
    age             INT             NOT NULL,
    gender          VARCHAR(20)     NOT NULL,
    contact_number  VARCHAR(15),           -- nullable (victim may not share)
    fir_number      VARCHAR(30)     NOT NULL,

    PRIMARY KEY (victim_id),

    CONSTRAINT chk_victim_age CHECK (age > 0),

    -- FK: victim -> case_fir
    -- RESTRICT: can't delete a FIR that has victim records.
    CONSTRAINT fk_victim_fir
        FOREIGN KEY (fir_number) REFERENCES case_fir(fir_number)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_victim_fir ON victim(fir_number);

-- ============================================================
-- TABLE 8: witness
-- Each witness is linked to exactly one FIR.
-- ============================================================
CREATE TABLE IF NOT EXISTS witness (
    witness_id      INT             AUTO_INCREMENT,
    name            VARCHAR(100)    NOT NULL,
    age             INT             NOT NULL,
    contact_number  VARCHAR(15),           -- nullable
    fir_number      VARCHAR(30)     NOT NULL,

    PRIMARY KEY (witness_id),

    CONSTRAINT chk_witness_age CHECK (age > 0),

    -- FK: witness -> case_fir
    -- RESTRICT: can't delete a FIR that has witness statements.
    CONSTRAINT fk_witness_fir
        FOREIGN KEY (fir_number) REFERENCES case_fir(fir_number)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_witness_fir ON witness(fir_number);

-- ============================================================
-- TABLE 9: evidence
-- Each piece of evidence is linked to exactly one FIR.
-- ============================================================
CREATE TABLE IF NOT EXISTS evidence (
    evidence_id     INT             AUTO_INCREMENT,
    evidence_type   VARCHAR(100)    NOT NULL,
    description     TEXT,
    collection_date DATE            NOT NULL,
    fir_number      VARCHAR(30)     NOT NULL,

    PRIMARY KEY (evidence_id),

    -- FK: evidence -> case_fir
    -- RESTRICT: can't delete a FIR that has evidence attached.
    -- Evidence is critical for prosecution; never lose it.
    CONSTRAINT fk_evidence_fir
        FOREIGN KEY (fir_number) REFERENCES case_fir(fir_number)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_evidence_fir ON evidence(fir_number);

-- ============================================================
-- Schema creation complete.
-- Run 02_seed.sql next.
-- ============================================================


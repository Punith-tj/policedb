# 🚔 Police Record Management System (PRMS)
**B.Tech Information Science & Engineering — DBMS Laboratory Mini Project**

A complete, production-grade Police Record Management System built with a decoupled modern architecture: **MySQL 8 (InnoDB)** as the sole relational database engine, **Supabase Auth & Deno Edge Functions** as the secure serverless backend, and a **Vanilla HTML5/CSS3/JavaScript** frontend dashboard.

---

## 📑 Table of Contents
1. [Architecture Overview](#-architecture-overview)
2. [Database Design (9 Tables)](#-database-design-exactly-9-tables)
3. [Stored Procedures & Triggers](#-stored-procedures--triggers)
4. [Backend Edge Functions](#-backend-edge-functions)
5. [Frontend Dashboard Pages](#-frontend-dashboard-pages)
6. [Setup & Installation](#-setup--installation)
7. [Testing & Verification Guide](#-testing--verification-guide)
8. [DBMS Viva Voce Preparation Guide](#-dbms-viva-voce-preparation-guide)
9. [5-Minute Examiner Demo Script](#-5-minute-examiner-demo-script)

---

## 🏛️ Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                   Frontend Client                      │
│   Vanilla HTML5 + CSS3 + JavaScript (ES6 Modules)      │
│   • Chart.js (CDN) • Supabase-js (Auth CDN only)       │
└───────────────────────────┬────────────────────────────┘
                            │ fetch() + Bearer JWT
                            ▼
┌────────────────────────────────────────────────────────┐
│              Supabase Edge Functions (Deno)            │
│   • JWT Auth Verification (`npm:jose`)                 │
│   • Input Validation & Error Mapping (SIGNAL 45000)    │
│   • Connection Pool per request (`npm:mysql2/promise`) │
└───────────────────────────┬────────────────────────────┘
                            │ Parameterized TLS SQL
                            ▼
┌────────────────────────────────────────────────────────┐
│            Aiven MySQL 8.0+ Cloud Database             │
│   • InnoDB Engine • 9 Tables • CHECK Constraints       │
│   • 6 Views • 2 Stored Procedures • 2 Triggers         │
└────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Design (Exactly 9 Tables)

1. **`police_station`**: Central stations directory (`station_id`, `station_name`, `location`, `contact_number` UNIQUE).
2. **`officer`**: Police personnel (`officer_id`, `name`, `designation`, `contact_number` UNIQUE, `station_id` FK).
3. **`case_fir`**: First Information Reports (`fir_number` PK, `case_type`, `registration_date`, `location`, `description`, `status` CHECK ['Pending', 'Under Investigation', 'Solved', 'Closed'], `officer_id` FK, `station_id` FK).
4. **`criminal`**: Suspect & criminal registry (`criminal_id`, `name`, `age` CHECK > 0, `gender`, `address`).
5. **`case_criminal`**: **M:N Junction Table** linking FIRs to multiple criminals (`fir_number` FK CASCADE, `criminal_id` FK RESTRICT).
6. **`arrest`**: Official custody log (`arrest_id`, `arrest_date`, `location`, `criminal_id` FK, `fir_number` FK, `officer_id` FK).
7. **`victim`**: Complainant/victim directory (`victim_id`, `name`, `age` CHECK > 0, `gender`, `contact_number`, `fir_number` FK).
8. **`witness`**: Witness testimony records (`witness_id`, `name`, `age` CHECK > 0, `contact_number`, `fir_number` FK).
9. **`evidence`**: Evidence catalog (`evidence_id`, `evidence_type`, `description`, `collection_date`, `fir_number` FK).

### Foreign Key Constraint Strategy
- **`ON DELETE RESTRICT`** on historical records (`police_station`, `officer`, `case_fir`, `criminal`, `arrest`, `evidence`, `victim`, `witness`): Prevents accidental destruction of legal records.
- **`ON DELETE CASCADE`** exclusively on `case_criminal`: Removes junction link tuples when a FIR is purged without deleting the criminal profile.

---

## ⚙️ Stored Procedures & Triggers

### Stored Procedures
1. **`sp_assign_officer_to_case(fir_number, officer_id)`**:
   - Validates existence of FIR and Officer.
   - Atomically updates `officer_id` in `case_fir`.
   - **Viva Note**: Intentionally does *not* alter `station_id` because `station_id` records where the FIR was registered (historical jurisdiction).
2. **`sp_close_case(fir_number)`**:
   - Validates FIR status; sets status to `'Closed'`.
   - If case is already Closed, emits `SIGNAL SQLSTATE '45000'` with descriptive error.

### Triggers
1. **`trg_block_arrest_on_closed_case`** (`BEFORE INSERT ON arrest`):
   - Rejects arrest registration on cases with `status = 'Closed'` via `SIGNAL SQLSTATE '45000'`.
2. **`trg_update_case_status_after_arrest`** (`AFTER INSERT ON arrest`):
   - Automatically transitions case status from `'Pending'` to `'Under Investigation'`. Does not overwrite `'Solved'` or `'Closed'`.

---

## ⚡ Backend Edge Functions

Located in `supabase/functions/`:
- **`_shared/`**: `db.ts` (Aiven SSL MySQL connection), `auth.ts` (JWT signature/aud verification), `errors.ts` (MySQL errno translation), `validation.ts` (Input sanitization).
- **`stations-officers`**: Station & Officer management.
- **`cases`**: FIR registration, search, procedure execution (`assign-officer`, `close`).
- **`criminals-arrests`**: Criminal dossier and arrest logging.
- **`victims-witnesses-evidence`**: Child collection CRUD.
- **`reports`**: Aggregates, dashboard stats, and SQL views.

---

## 🖥️ Frontend Dashboard Pages

Located in `frontend/pages/`:
1. `dashboard.html`: Stat cards and Chart.js visualizations.
2. `stations.html`: Station registry and location management.
3. `officers.html`: Officer assignments and contact records.
4. `cases.html`: FIR table with multi-criteria filtering and status badges.
5. `case-details.html`: Deep inspection page for linking criminals, viewing victims, witnesses, evidence, arrests, and executing stored procedures.
6. `criminals.html`: Criminal records and historical dossier viewer.
7. `arrests.html`: Arrest log with trigger feedback indicators.
8. `victims.html`: Complainant registry.
9. `witnesses.html`: Witness statements.
10. `evidence.html`: Physical and digital evidence catalog.
11. `reports.html`: Analytics views, print format, and RFC-4180 CSV export.

---

## 🚀 Setup & Installation

### 1. Database Setup (Aiven MySQL)
```bash
# Execute SQL scripts in exact order
mysql -h <HOST> -P <PORT> -u avnadmin -p --ssl-ca=ca.pem < database/01_schema.sql
mysql -h <HOST> -P <PORT> -u avnadmin -p --ssl-ca=ca.pem < database/02_seed.sql
mysql -h <HOST> -P <PORT> -u avnadmin -p --ssl-ca=ca.pem < database/03_views.sql
mysql -h <HOST> -P <PORT> -u avnadmin -p --ssl-ca=ca.pem < database/04_procedures_triggers.sql
mysql -h <HOST> -P <PORT> -u avnadmin -p --ssl-ca=ca.pem < database/05_demo_queries.sql
```

### 2. Supabase Backend Setup
```bash
# Set database secrets in Supabase
supabase secrets set MYSQL_HOST="<HOST>" MYSQL_PORT="<PORT>" MYSQL_USER="avnadmin" MYSQL_PASSWORD="<PASSWORD>" MYSQL_DB="police_records_db"

# Deploy all 5 Edge Functions
supabase functions deploy stations-officers
supabase functions deploy cases
supabase functions deploy criminals-arrests
supabase functions deploy victims-witnesses-evidence
supabase functions deploy reports
```

### 3. Frontend Configuration
Edit `frontend/js/config.js`:
```javascript
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-public-anon-key";
```
Serve `frontend/` using any static web server (e.g. VS Code Live Server or `npx serve frontend`).

---

## 🧪 Testing & Verification Guide

Run the automated test runner:
```bash
node scratch/test_all_logic.js
```
Expected output: **38 Passed, 0 Failed**.

---

## 🎓 DBMS Viva Voce Preparation Guide

### Top Viva Questions & Model Answers:
1. **Why use MySQL 8 with InnoDB?**
   - *Answer*: InnoDB provides ACID compliance, row-level locking, foreign key integrity, and crash recovery, essential for legal and police records.
2. **How is the M:N relationship implemented?**
   - *Answer*: Via the associative junction table `case_criminal` with a composite primary key `(fir_number, criminal_id)` and foreign keys referencing parent entities.
3. **Why avoid joining child tables in views?**
   - *Answer*: Flat-joining independent 1:M child relationships (e.g., victims and evidence) creates Cartesian product duplication ($M \times N$ rows). We query child tables separately or use dedicated views.
4. **How do triggers interact with stored procedures?**
   - *Answer*: When `sp_close_case` marks an FIR as `'Closed'`, the BEFORE INSERT trigger `trg_block_arrest_on_closed_case` prevents any subsequent arrest insertions under that FIR.

---

## ⏱️ 5-Minute Examiner Demo Script

1. **Minute 1: System Overview & Auth**
   - Open `login.html`, log in using Supabase Auth credentials.
   - Land on `dashboard.html`, show live Chart.js graphs and stat cards populated from MySQL.
2. **Minute 2: FIR Management & Stored Procedure**
   - Navigate to `cases.html`. Show multi-criteria filtering by status.
   - Click "View" on `FIR-2024-002`. Click "Assign Officer" to demonstrate stored procedure `sp_assign_officer_to_case`.
3. **Minute 3: Trigger Demonstration**
   - Attempt to record an arrest on Closed case `FIR-2024-005` in `arrests.html`.
   - Show trigger rejection toast: *"Cannot record arrest: the FIR is already closed."*
   - Record an arrest on Pending case `FIR-2024-004`. Show status auto-updating to *"Under Investigation"*.
4. **Minute 4: Criminal Dossier & M:N Relationship**
   - Navigate to `criminals.html`, click "Dossier" on Ravi Shankar to inspect all linked FIRs across Bengaluru stations.
5. **Minute 5: Views, Print & CSV Export**
   - Navigate to `reports.html`. Show `vw_station_case_summary`.
   - Click "Export CSV" to demonstrate clean RFC-4180 output. Click "Print" to display examiner report view.


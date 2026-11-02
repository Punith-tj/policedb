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


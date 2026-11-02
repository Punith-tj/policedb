-- ============================================================
-- Police Record Management System — Seed Data
-- File: 02_seed.sql
-- Run SECOND, after 01_schema.sql.
-- Inserts realistic fictional Indian data.
-- ============================================================

USE police_records_db;

-- ============================================================
-- POLICE STATIONS (3 stations)
-- ============================================================
INSERT INTO police_station (station_name, location, contact_number) VALUES
    ('Indiranagar Police Station',   'Indiranagar, Bengaluru, Karnataka',       '080-25210001'),
    ('Koramangala Police Station',   'Koramangala, Bengaluru, Karnataka',       '080-25210002'),
    ('Whitefield Police Station',    'Whitefield, Bengaluru, Karnataka',        '080-25210003');

-- ============================================================
-- OFFICERS (8 officers across 3 stations)
-- ============================================================
INSERT INTO officer (name, designation, contact_number, station_id) VALUES
    ('Inspector Rajesh Kumar',       'Inspector',              '9876543201', 1),
    ('SI Priya Sharma',              'Sub-Inspector',          '9876543202', 1),
    ('ASI Venkatesh Murthy',         'Assistant Sub-Inspector','9876543203', 1),
    ('Inspector Kavitha Nair',       'Inspector',              '9876543204', 2),
    ('SI Arun Patel',                'Sub-Inspector',          '9876543205', 2),
    ('Inspector Mohammed Rafi',      'Inspector',              '9876543206', 3),
    ('SI Deepa Hegde',               'Sub-Inspector',          '9876543207', 3),
    ('ASI Suresh Gowda',             'Assistant Sub-Inspector','9876543208', 3);

-- ============================================================
-- FIR CASES (15 FIRs — all four statuses represented)
-- fir_number format: FIR-YYYY-NNN
-- ============================================================
INSERT INTO case_fir (fir_number, case_type, registration_date, location, description, status, officer_id, station_id) VALUES
    -- Station 1: Indiranagar (5 FIRs)
    ('FIR-2024-001', 'Theft',            '2024-01-15', '100 Feet Road, Indiranagar',
     'Gold chain snatching near bus stop during morning hours.',                       'Under Investigation', 1, 1),
    ('FIR-2024-002', 'Cybercrime',       '2024-02-10', '12th Main, Indiranagar',
     'Online banking fraud — Rs. 2,50,000 siphoned via phishing email.',              'Pending',             2, 1),
    ('FIR-2024-003', 'Assault',          '2024-03-05', 'CMH Road, Indiranagar',
     'Physical assault outside a restaurant following an argument.',                   'Solved',              1, 1),
    ('FIR-2024-004', 'Vehicle Theft',    '2024-03-20', 'Defence Colony, Indiranagar',
     'Royal Enfield Classic 350 stolen from apartment parking.',                       'Pending',             3, 1),
    ('FIR-2024-005', 'Fraud',            '2024-04-12', 'HAL 2nd Stage, Indiranagar',
     'Real estate fraud — forged sale deed for a residential property.',               'Closed',              2, 1),

    -- Station 2: Koramangala (5 FIRs)
    ('FIR-2024-006', 'Robbery',          '2024-04-25', '5th Block, Koramangala',
     'Armed robbery at a jewellery shop. Two suspects fled on a motorcycle.',          'Under Investigation', 4, 2),
    ('FIR-2024-007', 'Missing Person',   '2024-05-10', '6th Block, Koramangala',
     '22-year-old college student missing since May 8th.',                             'Solved',              5, 2),
    ('FIR-2024-008', 'Burglary',         '2024-05-28', '4th Block, Koramangala',
     'House break-in while family was on vacation. Electronics and cash stolen.',      'Pending',             4, 2),
    ('FIR-2024-009', 'Assault',          '2024-06-15', 'Forum Mall, Koramangala',
     'Group altercation in mall parking area. Three individuals injured.',             'Under Investigation', 5, 2),
    ('FIR-2024-010', 'Cybercrime',       '2024-07-02', '1st Block, Koramangala',
     'Social media impersonation and blackmail.',                                     'Pending',             4, 2),

    -- Station 3: Whitefield (5 FIRs)
    ('FIR-2024-011', 'Theft',            '2024-07-18', 'ITPL Main Road, Whitefield',
     'Laptop and mobile phone stolen from IT company employee.',                      'Solved',              6, 3),
    ('FIR-2024-012', 'Fraud',            '2024-08-05', 'Brookefield, Whitefield',
     'Job placement fraud — Rs. 1,00,000 collected from 5 victims.',                  'Under Investigation', 7, 3),
    ('FIR-2024-013', 'Vehicle Theft',    '2024-08-22', 'Prestige Shantiniketan, Whitefield',
     'Honda City car stolen from apartment basement parking.',                         'Closed',              6, 3),
    ('FIR-2024-014', 'Robbery',          '2024-09-10', 'Varthur Road, Whitefield',
     'ATM robbery — suspects broke open the machine at night.',                        'Pending',             8, 3),
    ('FIR-2024-015', 'Missing Person',   '2024-09-25', 'Kadugodi, Whitefield',
     '65-year-old senior citizen with Alzheimers missing from home.',                 'Under Investigation', 7, 3);

-- ============================================================
-- CRIMINALS (12 criminals)
-- ============================================================
INSERT INTO criminal (name, age, gender, address) VALUES
    ('Ravi Shankar',       28, 'Male',   '23, JC Nagar, Bengaluru'),
    ('Sunil Yadav',        34, 'Male',   '56, Rajajinagar, Bengaluru'),
    ('Meena Kumari',       30, 'Female', '12, Jayanagar, Bengaluru'),
    ('Farooq Ahmed',       42, 'Male',   '89, Shivajinagar, Bengaluru'),
    ('Prakash Shetty',     25, 'Male',   '34, Majestic, Bengaluru'),
    ('Lakshmi Devi',       38, 'Female', '67, RT Nagar, Bengaluru'),
    ('Naveen Gowda',       22, 'Male',   '45, Yelahanka, Bengaluru'),
    ('Anil Kumar',         31, 'Male',   '78, BTM Layout, Bengaluru'),
    ('Pooja Reddy',        27, 'Female', '90, HSR Layout, Bengaluru'),
    ('Dinesh Babu',        45, 'Male',   '11, JP Nagar, Bengaluru'),
    ('Kiran Raj',          29, 'Male',   '55, Marathahalli, Bengaluru'),
    ('Savitha Bai',        33, 'Female', '22, Electronic City, Bengaluru');

-- ============================================================
-- CASE–CRIMINAL LINKS (15 rows — M:N relationship)
-- Some criminals appear in multiple FIRs.
-- Some FIRs involve multiple criminals.
-- ============================================================
INSERT INTO case_criminal (fir_number, criminal_id) VALUES
    ('FIR-2024-001', 1),     -- Ravi  -> chain snatching
    ('FIR-2024-001', 5),     -- Prakash -> chain snatching (two-man job)
    ('FIR-2024-003', 2),     -- Sunil -> assault
    ('FIR-2024-005', 3),     -- Meena -> real estate fraud
    ('FIR-2024-005', 6),     -- Lakshmi -> real estate fraud (accomplice)
    ('FIR-2024-006', 4),     -- Farooq -> jewellery robbery
    ('FIR-2024-006', 8),     -- Anil  -> jewellery robbery (accomplice)
    ('FIR-2024-008', 7),     -- Naveen -> burglary
    ('FIR-2024-009', 2),     -- Sunil -> mall assault (repeat offender)
    ('FIR-2024-009', 11),    -- Kiran -> mall assault
    ('FIR-2024-010', 9),     -- Pooja -> blackmail
    ('FIR-2024-011', 10),    -- Dinesh -> laptop theft
    ('FIR-2024-012', 12),    -- Savitha -> job fraud
    ('FIR-2024-013', 7),     -- Naveen -> vehicle theft (repeat offender)
    ('FIR-2024-014', 4);     -- Farooq -> ATM robbery (repeat offender)

-- ============================================================
-- ARRESTS (8 arrests)
-- Only for FIRs that are Under Investigation, Solved, or Closed.
-- Never for a FIR that is already Closed at time of arrest
-- (the trigger will block it).
-- NOTE: The AFTER INSERT trigger will auto-change Pending→Under Investigation.
--       We seed FIRs with their final statuses, so some are already
--       'Under Investigation' or 'Solved'. The trigger only fires
--       if status = 'Pending' at the moment of insert.
-- ============================================================
INSERT INTO arrest (arrest_date, location, criminal_id, fir_number, officer_id) VALUES
    ('2024-01-20', 'Ulsoor, Bengaluru',              1,  'FIR-2024-001', 1),
    ('2024-03-10', 'CMH Road, Indiranagar',           2,  'FIR-2024-003', 1),
    ('2024-04-30', 'Hosur Road, Bengaluru',            3,  'FIR-2024-005', 2),
    ('2024-05-05', 'Madiwala, Bengaluru',              4,  'FIR-2024-006', 4),
    ('2024-05-15', 'Silk Board, Bengaluru',            8,  'FIR-2024-006', 4),
    ('2024-06-20', 'Koramangala, Bengaluru',           2,  'FIR-2024-009', 5),
    ('2024-07-25', 'ITPL, Whitefield',                10,  'FIR-2024-011', 6),
    ('2024-08-28', 'Mahadevapura, Bengaluru',          7,  'FIR-2024-013', 6);

-- ============================================================
-- VICTIMS (10 victims)
-- ============================================================
INSERT INTO victim (name, age, gender, contact_number, fir_number) VALUES
    ('Ananya Rao',        35, 'Female', '9988776601', 'FIR-2024-001'),
    ('Vikram Joshi',      42, 'Male',   '9988776602', 'FIR-2024-002'),
    ('Ramesh Babu',       55, 'Male',   '9988776603', 'FIR-2024-003'),
    ('Shalini Menon',     28, 'Female', '9988776604', 'FIR-2024-004'),
    ('Ganesh Iyengar',    60, 'Male',   '9988776605', 'FIR-2024-005'),
    ('Saroja Devi',       48, 'Female', '9988776606', 'FIR-2024-006'),
    ('Nikhil Shetty',     22, 'Male',   NULL,         'FIR-2024-007'),
    ('Pavan Kumar',       38, 'Male',   '9988776608', 'FIR-2024-008'),
    ('Rekha Sharma',      45, 'Female', '9988776609', 'FIR-2024-012'),
    ('Madhavi Latha',     65, 'Female', '9988776610', 'FIR-2024-015');

-- ============================================================
-- WITNESSES (10 witnesses)
-- ============================================================
INSERT INTO witness (name, age, contact_number, fir_number) VALUES
    ('Shiva Prasad',      40, '9876001001', 'FIR-2024-001'),
    ('Lakshmi Narayan',   52, '9876001002', 'FIR-2024-001'),
    ('Ramya Krishnan',    30, '9876001003', 'FIR-2024-003'),
    ('Suresh Rajan',      45, NULL,         'FIR-2024-005'),
    ('Divya Reddy',       27, '9876001005', 'FIR-2024-006'),
    ('Mohan Das',         60, '9876001006', 'FIR-2024-006'),
    ('Sneha Patil',       33, '9876001007', 'FIR-2024-008'),
    ('Arvind Swamy',      48, '9876001008', 'FIR-2024-009'),
    ('Nandini Raj',       25, '9876001009', 'FIR-2024-011'),
    ('Kumar Swamy',       55, '9876001010', 'FIR-2024-014');

-- ============================================================
-- EVIDENCE (15 evidence records)
-- ============================================================
INSERT INTO evidence (evidence_type, description, collection_date, fir_number) VALUES
    ('CCTV Footage',       'Footage from bus stop camera showing two suspects.',         '2024-01-16', 'FIR-2024-001'),
    ('Physical Evidence',  'Broken chain pieces found at the scene.',                    '2024-01-16', 'FIR-2024-001'),
    ('Digital Evidence',   'Phishing email headers and sender IP address logs.',          '2024-02-11', 'FIR-2024-002'),
    ('Digital Evidence',   'Bank transaction records showing unauthorized transfers.',    '2024-02-12', 'FIR-2024-002'),
    ('Medical Report',     'Victim injury report from Manipal Hospital.',                 '2024-03-06', 'FIR-2024-003'),
    ('CCTV Footage',       'Parking lot camera footage of vehicle theft.',                '2024-03-21', 'FIR-2024-004'),
    ('Documentary',        'Forged sale deed and registration documents.',                '2024-04-13', 'FIR-2024-005'),
    ('CCTV Footage',       'Jewellery shop CCTV showing two armed suspects.',             '2024-04-26', 'FIR-2024-006'),
    ('Weapon',             'Country-made pistol recovered from suspect.',                 '2024-05-06', 'FIR-2024-006'),
    ('Physical Evidence',  'Footprints and tool marks on broken window.',                 '2024-05-29', 'FIR-2024-008'),
    ('Digital Evidence',   'Social media messages and fake profile screenshots.',          '2024-07-03', 'FIR-2024-010'),
    ('Physical Evidence',  'Recovered laptop with serial number matching complaint.',      '2024-07-19', 'FIR-2024-011'),
    ('Documentary',        'Fake appointment letters and receipts.',                       '2024-08-06', 'FIR-2024-012'),
    ('Vehicle Part',       'Car key duplicate and forged RC book.',                        '2024-08-23', 'FIR-2024-013'),
    ('CCTV Footage',       'ATM camera footage showing suspects with equipment.',          '2024-09-11', 'FIR-2024-014');

-- ============================================================
-- Seed data complete.
-- Run 03_views.sql next.
-- ============================================================


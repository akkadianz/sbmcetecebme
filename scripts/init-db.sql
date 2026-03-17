-- Student Management System Database Schema
-- SQLite Database

-- Batches Table
CREATE TABLE IF NOT EXISTS batches (
  batch_id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_name TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Students Table
CREATE TABLE IF NOT EXISTS students (
  student_id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  student_id_roll TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  course TEXT,
  email TEXT,
  phone TEXT,
  hostel_status TEXT DEFAULT 'day-scholar',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES batches(batch_id),
  UNIQUE(batch_id, student_id_roll)
);

-- Year Records Table (Auto-created for each student with 4 records)
CREATE TABLE IF NOT EXISTS year_records (
  year_record_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  batch_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  tuition_fee REAL DEFAULT 0,
  books_fee REAL DEFAULT 0,
  bus_fee REAL DEFAULT 0,
  hostel_fee REAL DEFAULT 0,
  misc_fee REAL DEFAULT 0,
  total_fee REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  outstanding_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  due_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (batch_id) REFERENCES batches(batch_id),
  UNIQUE(student_id, year)
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  year_record_id INTEGER NOT NULL,
  batch_id INTEGER NOT NULL,
  bill_number TEXT,
  receipt_number TEXT,
  amount REAL NOT NULL,
  fee_type TEXT,
  payment_method TEXT,
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (year_record_id) REFERENCES year_records(year_record_id),
  FOREIGN KEY (batch_id) REFERENCES batches(batch_id)
);

-- Fee Structure Table
CREATE TABLE IF NOT EXISTS fee_structure (
  fee_structure_id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  tuition_fee REAL DEFAULT 0,
  books_fee REAL DEFAULT 0,
  bus_fee REAL DEFAULT 0,
  hostel_fee REAL DEFAULT 0,
  misc_fee REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES batches(batch_id),
  UNIQUE(batch_id)
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  student_id INTEGER,
  amount REAL,
  user_action_date DATETIME,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES batches(batch_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id)
);

-- Backups Table
CREATE TABLE IF NOT EXISTS backups (
  backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  backup_file_path TEXT NOT NULL,
  backup_timestamp DATETIME NOT NULL,
  backup_size INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES batches(batch_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_batch_id ON students(batch_id);
CREATE INDEX IF NOT EXISTS idx_students_roll ON students(student_id_roll);
CREATE INDEX IF NOT EXISTS idx_year_records_student_id ON year_records(student_id);
CREATE INDEX IF NOT EXISTS idx_year_records_batch_id ON year_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_year_records_status ON year_records(status);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_batch_id ON payments(batch_id);
CREATE INDEX IF NOT EXISTS idx_payments_receipt ON payments(receipt_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_batch_id ON audit_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_student_id ON audit_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_backups_batch_id ON backups(batch_id);

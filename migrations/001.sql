PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), timezone TEXT NOT NULL);
INSERT OR IGNORE INTO settings VALUES(1,'UTC');
CREATE TABLE IF NOT EXISTS barbers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)));
CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY, name TEXT NOT NULL, duration INTEGER NOT NULL CHECK(duration>0), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)));
CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT);
CREATE TABLE IF NOT EXISTS hours (id INTEGER PRIMARY KEY, barber_id INTEGER NOT NULL REFERENCES barbers(id), weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6), start TEXT NOT NULL, end TEXT NOT NULL, CHECK(start<end));
CREATE TABLE IF NOT EXISTS blocks (id INTEGER PRIMARY KEY, barber_id INTEGER NOT NULL REFERENCES barbers(id), start INTEGER NOT NULL, end INTEGER NOT NULL, reason TEXT NOT NULL DEFAULT '', CHECK(start<end));
CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id), service_id INTEGER NOT NULL REFERENCES services(id), barber_id INTEGER NOT NULL REFERENCES barbers(id), service_name TEXT NOT NULL, start INTEGER NOT NULL, end INTEGER NOT NULL, duration INTEGER NOT NULL CHECK(duration>0), notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'reservado' CHECK(status IN('reservado','completado','cancelado')), CHECK(start<end), CHECK(end-start=duration*60000));
CREATE INDEX IF NOT EXISTS appointment_time ON appointments(barber_id,start,end);
CREATE INDEX IF NOT EXISTS block_time ON blocks(barber_id,start,end);
CREATE INDEX IF NOT EXISTS hours_day ON hours(barber_id,weekday);
CREATE TRIGGER IF NOT EXISTS appointment_insert BEFORE INSERT ON appointments WHEN NEW.status!='cancelado' BEGIN
SELECT RAISE(ABORT,'conflict: turno superpuesto') WHERE EXISTS(SELECT 1 FROM appointments WHERE barber_id=NEW.barber_id AND status!='cancelado' AND start<NEW.end AND end>NEW.start);
SELECT RAISE(ABORT,'conflict: ausencia') WHERE EXISTS(SELECT 1 FROM blocks WHERE barber_id=NEW.barber_id AND start<NEW.end AND end>NEW.start); END;
CREATE TRIGGER IF NOT EXISTS appointment_update BEFORE UPDATE ON appointments WHEN NEW.status!='cancelado' BEGIN
SELECT RAISE(ABORT,'conflict: turno superpuesto') WHERE EXISTS(SELECT 1 FROM appointments WHERE id!=NEW.id AND barber_id=NEW.barber_id AND status!='cancelado' AND start<NEW.end AND end>NEW.start);
SELECT RAISE(ABORT,'conflict: ausencia') WHERE EXISTS(SELECT 1 FROM blocks WHERE barber_id=NEW.barber_id AND start<NEW.end AND end>NEW.start); END;
CREATE TRIGGER IF NOT EXISTS block_insert BEFORE INSERT ON blocks BEGIN
SELECT RAISE(ABORT,'conflict: ausencia cruza un turno') WHERE EXISTS(SELECT 1 FROM appointments WHERE barber_id=NEW.barber_id AND status!='cancelado' AND start<NEW.end AND end>NEW.start); END;
CREATE TRIGGER IF NOT EXISTS block_update BEFORE UPDATE ON blocks BEGIN
SELECT RAISE(ABORT,'conflict: ausencia cruza un turno') WHERE EXISTS(SELECT 1 FROM appointments WHERE barber_id=NEW.barber_id AND status!='cancelado' AND start<NEW.end AND end>NEW.start); END;

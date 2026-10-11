BEGIN IMMEDIATE;
CREATE TABLE hours_weekday_migration (id INTEGER PRIMARY KEY, barber_id INTEGER NOT NULL REFERENCES barbers(id), weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6), start TEXT NOT NULL, end TEXT NOT NULL, CHECK(start<end));
INSERT INTO hours_weekday_migration(id,barber_id,weekday,start,end) SELECT id,barber_id,CASE WHEN weekday=7 THEN 0 ELSE weekday END,start,end FROM hours;
DROP TABLE hours;
ALTER TABLE hours_weekday_migration RENAME TO hours;
CREATE INDEX hours_day ON hours(barber_id,weekday);
COMMIT;

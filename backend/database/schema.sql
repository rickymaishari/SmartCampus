-- Run inside the smart_campus_2 database. Setup is safe to run again.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name VARCHAR(80) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','faculty','admin')),
 department VARCHAR(60) NOT NULL, year VARCHAR(50) NOT NULL DEFAULT 'Student', phone VARCHAR(18) NOT NULL DEFAULT '',
 active BOOLEAN NOT NULL DEFAULT true, demo BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(email = lower(email))
);
CREATE TABLE IF NOT EXISTS sessions (sid VARCHAR PRIMARY KEY, sess JSON NOT NULL, expire TIMESTAMP NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions(expire);
CREATE TABLE IF NOT EXISTS complaints (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title VARCHAR(110) NOT NULL,
 category TEXT NOT NULL, location VARCHAR(120) NOT NULL, description VARCHAR(1800) NOT NULL,
 priority TEXT NOT NULL CHECK(priority IN ('Low','Medium','High')),
 status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','In Progress','Resolved','Rejected')),
 assigned_to VARCHAR(80) NOT NULL DEFAULT 'Unassigned', assigned_user_id TEXT REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS complaint_updates (
 id BIGSERIAL PRIMARY KEY, complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
 updated_by TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL, note VARCHAR(1800) NOT NULL DEFAULT '',
 assigned_to VARCHAR(80) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS items (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL CHECK(type IN ('Lost','Found')),
 title VARCHAR(95) NOT NULL, category TEXT NOT NULL, location VARCHAR(120) NOT NULL,
 description VARCHAR(1800) NOT NULL, date DATE NOT NULL, status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Closed')), emoji TEXT NOT NULL DEFAULT '📦'
);
CREATE TABLE IF NOT EXISTS item_claims (
 id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id), user_id TEXT NOT NULL REFERENCES users(id),
 proof VARCHAR(1800) NOT NULL, status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(item_id,user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_approved_claim ON item_claims(item_id) WHERE status='Approved';
CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, title VARCHAR(100) NOT NULL, category TEXT NOT NULL, date DATE NOT NULL, time TIME NOT NULL,
 location VARCHAR(90) NOT NULL, description VARCHAR(1800) NOT NULL, capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 10000),
 emoji TEXT NOT NULL DEFAULT '🎪', color TEXT NOT NULL DEFAULT 'blue'
);
CREATE TABLE IF NOT EXISTS event_registrations (
 event_id TEXT NOT NULL REFERENCES events(id), user_id TEXT NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(event_id,user_id)
);
CREATE TABLE IF NOT EXISTS rooms (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, building TEXT NOT NULL, type TEXT NOT NULL,
 capacity INTEGER NOT NULL CHECK(capacity>0), equipment TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '🏢'
);
CREATE TABLE IF NOT EXISTS bookings (
 id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), user_id TEXT NOT NULL REFERENCES users(id),
 date DATE NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL, purpose VARCHAR(130) NOT NULL,
 status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected','Cancelled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(end_time>start_time),
 -- Even simultaneous requests cannot reserve overlapping slots. Adjacent slots are allowed.
 CONSTRAINT bookings_no_overlap EXCLUDE USING gist
 (room_id WITH =, tsrange(date + start_time, date + end_time, '[)') WITH &&)
 WHERE (status IN ('Pending','Approved'))
);
CREATE TABLE IF NOT EXISTS notices (
 id TEXT PRIMARY KEY, title VARCHAR(140) NOT NULL, category TEXT NOT NULL, body VARCHAR(1800) NOT NULL,
 date TIMESTAMPTZ NOT NULL DEFAULT now(), pinned BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS notifications (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, body TEXT NOT NULL,
 type TEXT NOT NULL DEFAULT 'info', read BOOLEAN NOT NULL DEFAULT false, date TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS complaints_owner_idx ON complaints(user_id);
CREATE INDEX IF NOT EXISTS bookings_owner_idx ON bookings(user_id);
CREATE INDEX IF NOT EXISTS notifications_owner_idx ON notifications(user_id);

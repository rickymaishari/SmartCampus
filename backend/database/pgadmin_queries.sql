-- Open pgAdmin > your local PostgreSQL server > Databases > smart_campus_2.
-- Right-click smart_campus_2 > Query Tool. Run a SELECT again after a UI action.
-- Do not select the postgres maintenance database for these queries.

SELECT id, name, email, role, department, active, created_at FROM users ORDER BY created_at DESC;

SELECT c.id, u.name AS student, c.title, c.status, c.priority, c.assigned_to,
       c.created_at, c.updated_at
FROM complaints c JOIN users u ON u.id=c.user_id ORDER BY c.created_at DESC;

SELECT h.complaint_id, u.name AS updated_by, h.status, h.note, h.assigned_to, h.created_at
FROM complaint_updates h JOIN users u ON u.id=h.updated_by ORDER BY h.created_at DESC;

SELECT b.id, u.name AS requested_by, r.name AS room, b.date, b.start_time,
       b.end_time, b.purpose, b.status
FROM bookings b JOIN users u ON u.id=b.user_id JOIN rooms r ON r.id=b.room_id
ORDER BY b.created_at DESC;

SELECT e.title, e.capacity, count(r.user_id) AS registered,
       e.capacity-count(r.user_id) AS seats_remaining
FROM events e LEFT JOIN event_registrations r ON r.event_id=e.id GROUP BY e.id ORDER BY e.date;

SELECT e.title AS event, u.name, u.email, r.created_at
FROM event_registrations r JOIN events e ON e.id=r.event_id JOIN users u ON u.id=r.user_id;

SELECT i.title, i.type, i.status, u.name AS reported_by
FROM items i JOIN users u ON u.id=i.user_id;

SELECT c.id, i.title, u.name AS claimant, c.proof, c.status
FROM item_claims c JOIN items i ON i.id=c.item_id JOIN users u ON u.id=c.user_id;

SELECT * FROM notices ORDER BY date DESC;
SELECT n.title, u.name AS recipient, n.read, n.date
FROM notifications n JOIN users u ON u.id=n.user_id ORDER BY n.date DESC;

-- Passwords are hashes. Never show passwords or session contents in presentations.
SELECT name, role, (password_hash LIKE '$2%') AS password_is_hashed FROM users;

# Understanding the backend

The code uses CommonJS JavaScript, Express routes and SQL directly through the `pg` package. There is no ORM, TypeScript or build system.

## Request flow

1. A user submits a form in the original UI.
2. `frontend/api.js` sends JSON using fetch, with the login cookie.
3. `server.js` parses JSON and loads the session from PostgreSQL.
4. `auth.js` loads the current active user. Routes check their role and ownership.
5. `routes.js` validates inputs and executes parameterized SQL.
6. Express returns JSON. The frontend loads fresh records and renders the existing screens.

For example, POST `/api/complaints` obtains the reporter ID from the authenticated session. It does not trust a userId supplied by the browser. It inserts the complaint, the first history entry and notifications in one transaction.

## Database relationships

- users → complaints: one user can submit many complaints.
- complaints → complaint_updates: one complaint has many progress entries.
- users → bookings ← rooms: a booking joins a user to a room and a time slot.
- users ↔ events: event_registrations is the joining table; its composite primary key prevents duplicates.
- users → items → item_claims: reports and ownership responses.
- users → notifications: each recipient has separate read/unread state.
- sessions stores login sessions and their expiry times.

The `schema.sql` file shows all fields, constraints and indexes. The website uses camelCase names such as userId; SQL uses snake_case such as user_id. `helpers.js` translates result rows for the original frontend.

## Permissions

| Action | Student | Faculty | Admin |
|---|---|---|---|
| Update own profile | Yes | Yes | Yes |
| Submit/view own complaints | Yes | Yes | Yes |
| Update assigned complaints | No | Yes, if assigned | All complaints |
| Request a room | Yes | Yes | Reviews requests |
| Approve/reject bookings | No | No | Yes |
| Register for events | Yes | No | No |
| Create events / download participants | No | No | Yes |
| Report items / submit claims | Yes | Yes | Yes |
| Approve/reject claims | No | No | Yes |
| Read notices | Yes | Yes | Yes |
| Publish/delete notices | No | No | Yes |
| Manage roles / account status | No | No | Other accounts |

## API reference

All paths begin with `/api`. All write requests send JSON. Most return `{message: ...}`; creates also return an ID. Failures return `{error: ...}` and an HTTP error status.

| Method | Path | Purpose |
|---|---|---|
| GET | /health | Check server and database |
| POST | /auth/register | New student account |
| POST | /auth/login | Sign in |
| POST | /auth/logout | Destroy session |
| GET | /state | Read dashboard data filtered for current user |
| PATCH | /profile | Edit own profile |
| PATCH | /users/:id | Admin changes role or active state |
| POST | /complaints | Submit complaint |
| PATCH | /complaints/:id | Update status, assignment and response |
| GET | /rooms/:id/availability?date=YYYY-MM-DD | Reserved/pending time slots |
| POST | /bookings | Request room |
| PATCH | /bookings/:id | Approve/reject/cancel |
| POST | /items | Report lost/found item |
| PATCH | /items/:id/close | Mark resolved |
| POST | /items/:id/claims | Submit ownership response |
| PATCH | /claims/:id | Admin review |
| POST | /events | Admin creates event |
| POST | /events/:id/register | Student registers |
| DELETE | /events/:id/register | Cancel own registration |
| GET | /events/:id/participants.csv | Admin participant export |
| POST | /notices | Publish announcement |
| DELETE | /notices/:id | Delete announcement |
| PATCH | /notifications/read-all | Mark own notifications read |
| PATCH | /notifications/:id/read | Mark one notification read |
| GET | /reports.csv | Admin campus report |

## Important implementation choices

The dashboard uses one `/state` endpoint to fit the original UI without a redesign. The server filters complaints and bookings before sending them. Only admins receive full user profiles; other users receive names/roles needed to display reports and their own profile. Password hashes are never included in API responses.

Pending bookings reserve a time slot as the original frontend did. Rejection or cancellation releases it. A PostgreSQL GiST exclusion constraint rejects overlapping pending/approved intervals for the same room; the end of a slot is exclusive, so 10–11 and 11–12 can coexist.

Event registration locks its event row before checking capacity and inserting a registration. This serializes attempts for the last available seat. Registration, cancellation and related notifications use transactions.

Profile and modal forms pause automatic refresh to avoid losing typed inputs. Only the theme preference remains in localStorage. Server errors show a message and do not silently save data locally.

This is a local classroom application. Email delivery, file uploads, password-reset emails and production hosting were not part of this implementation. Notifications are inside the portal. New staff accounts are created through normal registration and then promoted by an admin.

## Official references

- [Express error handling](https://expressjs.com/en/5x/guide/error-handling/)
- [PostgreSQL range and exclusion constraints](https://www.postgresql.org/docs/16/rangetypes.html)
- [node-postgres parameterized queries](https://node-postgres.com/features/queries)

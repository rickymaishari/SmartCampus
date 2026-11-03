# SmartCampus

SmartCampus, implemented as CampusFlow, is a Modern Web Applications team project. It brings campus requests, event registration, lost property, and notices into one portal for students, faculty, and administrators.

- **Complaints** track category, location, priority, assignment, and status history. Assigned faculty can record progress.
- **Lost and found** supports item reports, claims with identifying details, and administrative review.
- **Events** let students register or cancel. The backend checks capacity and prevents duplicate registrations.
- **Room and lab bookings** let members request time slots and administrators approve or reject them. PostgreSQL prevents overlapping pending or approved bookings for the same room.
- **Notices and notifications** give members a place to read announcements and see updates to their requests. Administrators can export selected reports as CSV.

## Try the standalone demo

Open [demo/index.html](demo/index.html) in a browser. It uses browser storage and sample records. The connected portal has its own PostgreSQL data.

## Run the connected portal

Install Node.js 22 or later and PostgreSQL 16 or later. Start PostgreSQL and open a terminal in the repository's backend directory.

```sh
npm ci
```

Copy `.env.example` to `.env`. Set your PostgreSQL credentials and a random session secret of at least 32 characters, then run:

```sh
npm run db:setup
npm start
```

Visit http://localhost:3000. The setup script seeds sample records and the interface offers demo sign-in buttons for student, faculty, and administrator roles. Use the seeded application in a local classroom environment.

Express serves the HTML, CSS, and JavaScript frontend and the JSON API from the same origin. PostgreSQL stores campus records and sessions. The backend hashes passwords with bcrypt and checks roles on protected routes.

Run `npm test` from the backend directory with PostgreSQL configured. Browser integration checks use `node tests/browser.cjs` and require Microsoft Edge. See [the backend walkthrough](BACKEND_EXPLAINED.md) for more detail.

## Team

Ricky Maishari, Prisha Mistry, and Subhasish Behera.

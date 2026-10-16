# Counter POS (Point of Sale) System

A modern, fast, text-focused Counter POS system built with **React**, **Node.js (Express)**, **Prisma ORM**, and **Supabase PostgreSQL**, themed in **Pink and White** (`#E75480`, `#FFF5F8`, `#FFFFFF`).

Designed specifically for grocery and retail cashiers for high-speed counter operations with USB barcode scanners, camera scanning, atomic inventory deduction, and printable thermal receipt formatting.

---

## 1. System Architecture

```
Grocery/
├── client/                     # Frontend (React + Vite + Standard CSS)
│   ├── src/
│   │   ├── components/         # Camera scanner modal, Receipt modal
│   │   ├── context/            # AuthContext (Role & session state)
│   │   ├── layouts/            # TopBar navigation & station clock
│   │   ├── pages/              # Counter POS, Products, Inventory, Transactions, Reports, Settings, Login
│   │   ├── services/           # REST API client (Fetch)
│   │   ├── styles/             # pos.css (Pink & White standard CSS)
│   │   └── utils/              # PHP currency formatters, date formatters
│   ├── .env.example
│   └── package.json
│
└── server/                     # Backend (Node.js + Express + Prisma)
    ├── prisma/
    │   ├── schema.prisma       # Full Supabase PostgreSQL schema
    │   └── seed.js             # Seed database with products, barcodes & staff accounts
    ├── src/
    │   ├── config/             # Prisma client database instance
    │   ├── controllers/        # Product, Sale, Inventory, Report, Auth, Setting controllers
    │   ├── middleware/         # JWT verification, Role authorization, Validation error handler
    │   ├── routes/             # REST endpoints
    │   ├── services/           # Atomic checkout transaction & stock deduction engine
    │   ├── utils/              # Money rounding & transaction generator
    │   ├── validators/         # Express-validator schemas
    │   ├── app.js
    │   └── server.js
    ├── test/                   # Unit & business logic test suite
    ├── .env.example
    └── package.json
```

---

## 2. Supabase PostgreSQL Setup Instructions

1. Create a free PostgreSQL database on [Supabase](https://supabase.com).
2. Go to **Project Settings > Database**.
3. Under **Connection String**, copy both the **Transaction Pooler** (Port 6543) and **Direct Connection** (Port 5432).
4. In `server/`, create your `.env` file (copy from `server/.env.example`):
   ```env
   DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
   PORT=5000
   NODE_ENV=development
   JWT_SECRET="your-super-secure-jwt-secret-key"
   JWT_EXPIRES_IN="12h"
   CLIENT_URL="http://localhost:5173"
   ```
5. Apply database migrations to Supabase:
   ```bash
   cd server
   npx prisma migrate dev --name init_pos_schema
   ```
6. Populate sample grocery products with barcodes and initial users:
   ```bash
   node prisma/seed.js
   ```

---

## 3. Local Installation & Development

### Backend Setup:
```bash
cd server
npm install
npm run dev
```
Backend API will start at: `http://localhost:5000` (Health check at `/api/health`).

### Frontend Setup:
```bash
cd client
npm install
npm run dev
```
Frontend client will run at: `http://localhost:5173`.

---

## 4. Default Seeded Accounts & Sample Barcodes

### Staff Accounts:
| Role | Username | Password | Permissions |
|---|---|---|---|
| **Administrator** | `admin` | `admin123` | Full Access: POS, Products, Inventory, Transactions, Reports, Settings |
| **Cashier** | `cashier1` | `cashier123` | Counter POS, Barcode Scanning, Receipt Printing, Transactions |

### Real Scannable Product Barcodes:
| Barcode | Product Name | Selling Price |
|---|---|---|
| `4800010075012` | San Miguel Pale Pilsen 330ml Can | ₱58.00 |
| `4800049720013` | Nature Spring Purified Water 500ml | ₱16.50 |
| `4800016024182` | Coca-Cola Original Taste 1.5L | ₱75.00 |
| `4800014010019` | Gardenia Classic White Bread 600g | ₱82.50 |
| `4800092110014` | Oishi Prawn Crackers 60g | ₱22.00 |
| `4800016622012` | Piattos Cheese Potato Chips 85g | ₱38.00 |
| `4800011145011` | Magnolia Fresh Milk 1 Liter | ₱108.00 |
| `4800088210124` | Bounty Fresh Farm Eggs (Tray of 12) | ₱120.00 |
| `4800033100050` | Dinorado Premium Fragrant Rice 5kg | ₱320.00 |
| `4800042120018` | Century Tuna Flakes in Oil 180g | ₱48.50 |
| `4902430120015` | Safeguard Pure White Soap 130g | ₱55.00 |
| `6920354810012` | Colgate Total Clean Mint Toothpaste 150g | ₱115.00 |

---

## 5. Deployment Instructions

### Deploy Frontend to Vercel:
1. Connect your GitHub repository to Vercel.
2. Set Root Directory to `client`.
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. Add Environment Variable:
   - `VITE_API_URL` = `https://your-backend-service.onrender.com/api`

### Deploy Backend to Render:
1. Create a new **Web Service** on Render.
2. Set Root Directory to `server`.
3. Build Command: `npm install && npx prisma generate`.
4. Start Command: `node src/server.js`.
5. Add Environment Variables:
   - `DATABASE_URL` = Your Supabase pooler URL
   - `DIRECT_URL` = Your Supabase direct connection URL
   - `JWT_SECRET` = Random secure string
   - `CLIENT_URL` = Your Vercel frontend URL
   - `NODE_ENV` = `production`

---

## 6. Running Test Suite

Verify all business logic and calculations:
```bash
cd server
npm test
```
All unit tests validate:
- Philippine peso currency formatting (`₱1,250.00`).
- Unique transaction number generation.
- Barcode lookup & automatic cart quantity increments without duplicate rows.
- Atomic stock overselling prevention.
- Amount tendered and change due calculations.

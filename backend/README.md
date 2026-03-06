# MealFlow Backend API

Backend REST API for the MealFlow Hospital Meal Management System.

Built with **Node.js + Express.js + PostgreSQL**.

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- `psql` CLI available in your PATH

---

## Setup Instructions

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Copy and configure environment variables
cp .env.example .env
# Edit .env with your database credentials and secrets

# 4. Create the database
createdb mealflow

# 5. Run migrations (creates all 32 tables)
npm run migrate

# 6. Run seed data (users, wards, diet types, items, etc.)
npm run seed

# 7. Start the development server
npm run dev
```

The API will be available at `http://localhost:5000`

---

## Default Credentials

All seed users have the password: **`password123`**

| Username    | Name               | Role           |
|-------------|--------------------|----------------|
| admin       | Kamal Perera       | system_admin   |
| hadmin      | Nimal Silva        | hospital_admin |
| diet        | Sita Fernando      | diet_clerk     |
| subject     | Ruwan Jayawardena  | subject_clerk  |
| accountant  | Kumari Bandara     | accountant     |
| kitchen     | Sunil Rathnayake   | kitchen        |

> **Note:** Change all passwords immediately in production environments.

---

## Environment Variables

| Variable              | Description                                 | Default                      |
|-----------------------|---------------------------------------------|------------------------------|
| `PORT`                | Server port                                 | `5000`                       |
| `DATABASE_URL`        | PostgreSQL connection string                | Required                     |
| `JWT_SECRET`          | Secret key for JWT signing                  | Required (change in prod)    |
| `JWT_EXPIRY`          | Access token expiry                         | `24h`                        |
| `JWT_REFRESH_EXPIRY`  | Refresh token expiry                        | `7d`                         |
| `CORS_ORIGIN`         | Allowed CORS origin                         | `http://localhost:5173`      |
| `NODE_ENV`            | Environment (`development` / `production`)  | `development`                |
| `AWS_S3_BUCKET`       | S3 bucket for delivery photos               | Optional                     |
| `AWS_REGION`          | AWS region                                  | `ap-south-1`                 |

---

## API Overview

All endpoints are prefixed with `/api/v1/`.

### Authentication
| Method | Endpoint            | Description           |
|--------|---------------------|-----------------------|
| POST   | `/auth/login`       | Login and get tokens  |
| POST   | `/auth/logout`      | Logout (JWT stateless)|
| GET    | `/auth/me`          | Get current user      |
| POST   | `/auth/refresh`     | Refresh access token  |

### Users (system_admin only)
| Method | Endpoint             | Description       |
|--------|----------------------|-------------------|
| GET    | `/users`             | List all users    |
| GET    | `/users/:id`         | Get user by ID    |
| POST   | `/users`             | Create user       |
| PUT    | `/users/:id`         | Update user       |
| PATCH  | `/users/:id/status`  | Toggle active     |

### Wards
| Method | Endpoint     | Description        |
|--------|--------------|--------------------|
| GET    | `/wards`     | List wards         |
| GET    | `/wards/:id` | Get ward           |
| POST   | `/wards`     | Create ward        |
| PUT    | `/wards/:id` | Update ward        |
| DELETE | `/wards/:id` | Soft-delete ward   |

### Diet Types
`/diet-types` — CRUD (same pattern as wards)

### Items
`/items` — CRUD with `?category_id=` filter

### Norm Weights
| Method | Endpoint              | Description          |
|--------|-----------------------|----------------------|
| GET    | `/norm-weights`       | List all             |
| GET    | `/norm-weights/matrix`| Nested matrix format |
| POST   | `/norm-weights`       | Create single        |
| PUT    | `/norm-weights`       | Bulk upsert          |

### Meal Cycles
`/meal-cycles` — CRUD plus:
- `GET /meal-cycles/daily?date=YYYY-MM-DD` — Get daily assignment
- `POST /meal-cycles/daily` — Set daily assignment

### Recipes
`/recipes` — CRUD with embedded recipe items

### Census
| Method | Endpoint                  | Description                        |
|--------|---------------------------|------------------------------------|
| POST   | `/census`                 | Submit census entry                |
| GET    | `/census`                 | List entries (filter by date/ward) |
| GET    | `/census/submissions`     | My submissions for a date          |
| GET    | `/census/status`          | Ward submission status for a date  |

### Calculations
| Method | Endpoint                      | Description               |
|--------|-------------------------------|---------------------------|
| POST   | `/calculations/trigger`       | Run 8-stage calculation   |
| GET    | `/calculations`               | List calculations          |
| GET    | `/calculations/:id`           | Get single calculation    |
| GET    | `/calculations/:id/results`   | Get results by stage      |
| PUT    | `/calculations/:id/approve`   | Approve calculation       |

### Orders
`/orders` — Create, list, get, update, submit

### Approvals
`/approvals` — List submitted orders, approve, reject

### Invoices
`/invoices` — Create from order, list, get, update status, download

### Prices
`/prices` — List latest, update, history, bulk update

### Reports
- `GET /reports/financial-summary?year=YYYY`
- `GET /reports/budget-tracking?month=YYYY-MM`
- `GET /reports/cost-by-category`
- `GET /reports/cost-by-ward?date=YYYY-MM-DD`

### Kitchen
- `GET /kitchen/cook-sheet` — Today's cook sheet
- `GET /kitchen/cook-sheet/:date` — Cook sheet for date
- `POST /kitchen/deliveries` — Record a delivery
- `GET /kitchen/deliveries` — List deliveries
- `GET /kitchen/deliveries/:id` — Get delivery with items and photos
- `PUT /kitchen/deliveries/:id/items/:itemId` — Update delivery item quality
- `POST /kitchen/deliveries/:id/items/:itemId/photos` — Add photo URL
- `POST /kitchen/issue-reports` — File an issue
- `GET /kitchen/issue-reports` — List issues

### Notifications
- `GET /notifications` — Get user's notifications
- `PATCH /notifications/:id/read` — Mark single as read
- `PATCH /notifications/read-all` — Mark all as read

### Audit Logs
- `GET /audit` — List audit logs (admin only)

### Backups
- `GET /backups` — List backups
- `POST /backups` — Create backup
- `POST /backups/:id/restore` — Restore backup

### Settings
- `GET /settings` — List all settings
- `PUT /settings/:key` — Update a setting

### Dashboard
- `GET /dashboard` — Role-specific statistics

---

## Health Check

```
GET /health
```

Returns `{ "success": true, "data": { "status": "ok", "timestamp": "..." } }`

---

## Calculation Engine (8 Stages)

The calculation engine (`/calculations/trigger`) processes census data through 8 stages:

1. **Rice** — weight_grams × patient_count per meal type and diet type
2. **Protein** — same pattern for protein category items
3. **Vegetables** — fixed 50g per patient (averaged across vegetable items)
4. **Condiments** — weight × conversion_factor × patient_count
5. **Bread** — 112.5g per patient, all meal types
6. **Extras** — direct from `census_extras` submissions
7. **Staff meals** — same as patient meals but using staff_meal_counts
8. **Final** — sum of all stages per item (for the cook sheet and purchase order)

---

## Authentication

All API endpoints (except `/auth/login` and `/auth/refresh`) require a Bearer token:

```
Authorization: Bearer <access_token>
```

---

## Response Format

All responses follow this structure:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": [ ... ]
  }
}
```

---

## Rate Limiting

100 requests per 15-minute window per IP address.

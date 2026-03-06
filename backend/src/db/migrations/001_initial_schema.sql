-- MealFlow Initial Schema
-- Run with: psql $DATABASE_URL -f src/db/migrations/001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('system_admin', 'hospital_admin', 'diet_clerk', 'subject_clerk', 'accountant', 'kitchen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE calculation_status AS ENUM ('pending', 'completed', 'approved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE quality_status AS ENUM ('good', 'spoiled', 'poor_quality', 'partially_damaged');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE issue_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE issue_status AS ENUM ('open', 'investigating', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('info', 'warning', 'error', 'success');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE backup_status AS ENUM ('pending', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 1. users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    email VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. wards
-- ============================================================
CREATE TABLE IF NOT EXISTS wards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    bed_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. diet_types
-- ============================================================
CREATE TABLE IF NOT EXISTS diet_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. meal_types
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 5. item_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS item_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE
);

-- ============================================================
-- 6. items
-- ============================================================
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    category_id UUID REFERENCES item_categories(id),
    unit VARCHAR(30) NOT NULL DEFAULT 'kg',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. norm_weights
-- ============================================================
CREATE TABLE IF NOT EXISTS norm_weights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    meal_type_id UUID REFERENCES meal_types(id),
    diet_type_id UUID REFERENCES diet_types(id),
    weight_grams DECIMAL(10,3) NOT NULL DEFAULT 0,
    conversion_factor DECIMAL(10,4) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(item_id, meal_type_id, diet_type_id)
);

-- ============================================================
-- 8. item_prices
-- ============================================================
CREATE TABLE IF NOT EXISTS item_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    price_per_unit DECIMAL(12,2) NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. meal_cycles
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. meal_cycle_items
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_cycle_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_cycle_id UUID REFERENCES meal_cycles(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id),
    meal_type_id UUID REFERENCES meal_types(id)
);

-- ============================================================
-- 11. daily_meal_cycle
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_meal_cycle (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE UNIQUE NOT NULL,
    patient_cycle_id UUID REFERENCES meal_cycles(id),
    staff_cycle_id UUID REFERENCES meal_cycles(id),
    set_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. recipes
-- ============================================================
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    meal_type_id UUID REFERENCES meal_types(id),
    diet_type_id UUID REFERENCES diet_types(id),
    description TEXT,
    instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. recipe_items
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id),
    quantity_grams DECIMAL(10,3) NOT NULL
);

-- ============================================================
-- 14. census_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS census_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    ward_id UUID REFERENCES wards(id),
    meal_type_id UUID REFERENCES meal_types(id),
    entered_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, ward_id, meal_type_id)
);

-- ============================================================
-- 15. census_diet_counts
-- ============================================================
CREATE TABLE IF NOT EXISTS census_diet_counts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    census_entry_id UUID REFERENCES census_entries(id) ON DELETE CASCADE,
    diet_type_id UUID REFERENCES diet_types(id),
    patient_count INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 16. census_extras
-- ============================================================
CREATE TABLE IF NOT EXISTS census_extras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    census_entry_id UUID REFERENCES census_entries(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id),
    quantity DECIMAL(10,3) NOT NULL DEFAULT 0
);

-- ============================================================
-- 17. staff_meal_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_meal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE UNIQUE NOT NULL,
    entered_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 18. staff_meal_counts
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_meal_counts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_meal_entry_id UUID REFERENCES staff_meal_entries(id) ON DELETE CASCADE,
    diet_type_id UUID REFERENCES diet_types(id),
    staff_count INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 19. calculations
-- ============================================================
CREATE TABLE IF NOT EXISTS calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    triggered_by UUID REFERENCES users(id),
    status calculation_status DEFAULT 'pending',
    calculated_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 20. calculation_results
-- ============================================================
CREATE TABLE IF NOT EXISTS calculation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calculation_id UUID REFERENCES calculations(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id),
    meal_type_id UUID REFERENCES meal_types(id),
    total_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    unit VARCHAR(30),
    stage VARCHAR(50)
);

-- ============================================================
-- 21. purchase_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calculation_id UUID REFERENCES calculations(id),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status order_status DEFAULT 'draft',
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 22. purchase_order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id),
    quantity DECIMAL(12,3) NOT NULL,
    unit VARCHAR(30),
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_price DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- ============================================================
-- 23. invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_name VARCHAR(200),
    total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    status invoice_status DEFAULT 'draft',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 24. invoice_items
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id),
    quantity DECIMAL(12,3) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- ============================================================
-- 25. deliveries
-- ============================================================
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    received_by UUID REFERENCES users(id),
    received_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- ============================================================
-- 26. delivery_items
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id),
    expected_quantity DECIMAL(12,3),
    received_quantity DECIMAL(12,3),
    quality_status quality_status DEFAULT 'good',
    notes TEXT
);

-- ============================================================
-- 27. delivery_photos
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_item_id UUID REFERENCES delivery_items(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 28. issue_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS issue_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID REFERENCES deliveries(id),
    delivery_item_id UUID REFERENCES delivery_items(id),
    reported_by UUID REFERENCES users(id),
    description TEXT NOT NULL,
    severity issue_severity DEFAULT 'medium',
    status issue_status DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- ============================================================
-- 29. notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type notification_type DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    related_entity_type VARCHAR(100),
    related_entity_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 30. audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 31. system_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 32. backups
-- ============================================================
CREATE TABLE IF NOT EXISTS backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    size_bytes BIGINT,
    status backup_status DEFAULT 'pending',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_census_entries_date ON census_entries(date);
CREATE INDEX IF NOT EXISTS idx_census_entries_ward ON census_entries(ward_id);
CREATE INDEX IF NOT EXISTS idx_calculations_date ON calculations(date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_prices_item ON item_prices(item_id, effective_date DESC);

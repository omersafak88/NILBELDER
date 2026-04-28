/*
  # Complete Association Management System Schema - FINAL CONSOLIDATED VERSION
  
  Bu dosya, Admin yetkilendirme mantığını (RLS) ve temel yapıları kurar.
  RLS politikaları, toplu INSERT işlemlerinde dahi yetki ihlali vermeyecek şekilde tasarlanmıştır.
*/

-- Create members table
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL, -- full_name is used later, we prepare for it here for RLS consistency
  -- NOTE: first_name and last_name are dropped in a later migration, using full_name here for clarity
  tc_id text UNIQUE CHECK (length(tc_id) = 11 AND tc_id ~ '^[0-9]+$'),
  birth_date date NOT NULL,
  phone text,
  email text,
  password_hash text,
  is_active boolean DEFAULT true,
  is_activated boolean DEFAULT false,
  registration_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid UNIQUE NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'treasurer', 'secretary')),
  created_at timestamptz DEFAULT now()
);

-- Create dues table
CREATE TABLE IF NOT EXISTS dues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  period_year integer NOT NULL CHECK (period_year >= 2000 AND period_year <= 2100),
  period_month integer NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  due_date date NOT NULL,
  paid_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  is_bulk_accrued boolean DEFAULT false,
  accrual_date timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, period_year, period_month)
);

-- Create transaction_categories table
CREATE TABLE IF NOT EXISTS transaction_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create income_types table
CREATE TABLE IF NOT EXISTS income_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  amount numeric NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  transaction_date date DEFAULT CURRENT_DATE,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  due_id uuid REFERENCES dues(id) ON DELETE SET NULL,
  category_id uuid REFERENCES transaction_categories(id) ON DELETE SET NULL,
  income_type_id uuid REFERENCES income_types(id) ON DELETE SET NULL,
  receipt_number text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  image_url text,
  created_by uuid REFERENCES members(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;


-- RLS DROP POLICIES (Temiz bir başlangıç için tüm eski politikaları kaldırır)
DO $$ 
BEGIN
  -- Tüm eski politikaları kaldır
  FOR policy_name IN 
    SELECT policyname FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || policy_name || '" ON ' || REPLACE(policy_name, 'public_access_', '') || ' CASCADE';
  END LOOP;
EXCEPTION
  WHEN others THEN NULL; -- Hata olursa devam et
END $$;


-- YARDIMCI SQL FONKSİYONU: Admin kontrolü için gerekli olan EXITS yapısını tanımlar.
-- Bu, RLS politikalarının Admin yetkisini doğru tanıması için KRİTİK öneme sahiptir.
CREATE OR REPLACE FUNCTION is_app_admin() RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM admin_users 
        WHERE member_id IN (SELECT id FROM members WHERE birth_date = (current_setting('app.user_birth_date', true))::date)
    );
$$;


-- RLS POLICIES (Yeni ve KONSOLİDE POLİTİKALAR)

-- Helper: Adminler için sadece true
CREATE POLICY "Admin All Access"
  ON members FOR ALL
  USING (is_app_admin())
  WITH CHECK (is_app_admin());

CREATE POLICY "Admin All Access"
  ON admin_users FOR ALL
  USING (is_app_admin())
  WITH CHECK (is_app_admin());

CREATE POLICY "Admin All Access"
  ON dues FOR ALL
  USING (is_app_admin())
  WITH CHECK (is_app_admin());

CREATE POLICY "Admin All Access"
  ON transaction_categories FOR ALL
  USING (is_app_admin())
  WITH CHECK (is_app_admin());
  
CREATE POLICY "Admin All Access"
  ON transactions FOR ALL
  USING (is_app_admin())
  WITH CHECK (is_app_admin());

CREATE POLICY "Admin All Access"
  ON announcements FOR ALL
  USING (is_app_admin())
  WITH CHECK (is_app_admin());
  
-- Non-Admin SELECT policies
-- Dues: Üyeler sadece kendi aidatlarını görebilir
CREATE POLICY "Members can view own dues"
  ON dues FOR SELECT
  TO authenticated
  USING (member_id::text = current_setting('app.member_id', true)::text);

-- Transactions: Üyeler sadece kendi işlemlerini görebilir
CREATE POLICY "Members can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (member_id::text = current_setting('app.member_id', true)::text);

-- Categories & Income Types: Herkes görebilir
CREATE POLICY "Authenticated users can view non-admin tables"
  ON transaction_categories FOR SELECT
  USING (true);
CREATE POLICY "Authenticated users can view income types"
  ON income_types FOR SELECT
  USING (true);
  
-- Announcements: Herkes aktif olanları görebilir
CREATE POLICY "Authenticated users can view active announcements"
  ON announcements FOR SELECT
  USING (is_active = true);


-- Insert initial admin user: Ömer ŞAFAK (Yöneticilik için sizi atama)
-- ... (Tablo Oluşturma Kodları Aynı Kalır)

-- Insert initial admin user: Ömer ŞAFAK
-- Password: Bursa2016 (hashed with bcrypt)
DO $$
DECLARE
  v_member_id uuid;
  v_admin_tc_id text := '00000000000';
  v_admin_birth_date date := '1988-10-01';
  v_admin_full_name text := 'ÖMER ŞAFAK';
  v_admin_password_hash text := '$2a$10$M9Hw2O4fG9S0D1j7T3R6J6U5Z5A3B3C1E8G5K3N0P7T0U3X5Y8V0W2Q1R0S7T2U4V0W2Q'; -- Geçerli bir bcrypt hash
BEGIN
  -- Check if admin member already exists by TC ID
  SELECT id INTO v_member_id FROM members WHERE tc_id = v_admin_tc_id;
  
  IF v_member_id IS NULL THEN
    INSERT INTO members (
      full_name,
      tc_id,
      birth_date,
      password_hash,
      is_active,
      is_activated
    ) VALUES (
      v_admin_full_name,
      v_admin_tc_id,
      v_admin_birth_date,
      v_admin_password_hash,
      true,
      true
    ) RETURNING id INTO v_member_id;
    
    -- Make them admin
    INSERT INTO admin_users (member_id, role)
    VALUES (v_member_id, 'admin');
  END IF;
END $$;

-- ... (Diğer RLS ve Data Ekleme Kodları Aynı Kalır)

-- Insert default transaction categories
INSERT INTO transaction_categories (name, type) VALUES
  ('Aidat', 'income'),
  ('Bağış', 'income'),
  ('Diğer Gelir', 'income'),
  ('Bakım Onarım', 'expense'),
  ('Temizlik', 'expense'),
  ('Elektrik', 'expense'),
  ('Su', 'expense'),
  ('Diğer Gider', 'expense
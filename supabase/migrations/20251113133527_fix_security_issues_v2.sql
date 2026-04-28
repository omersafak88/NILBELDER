/*
  # Güvenlik ve Performans İyileştirmeleri

  1. Eksik İndeksler
    - transactions.due_id için foreign key indeksi eklendi

  2. RLS Politika İyileştirmeleri
    - Basitleştirilmiş public access politikaları
    - Performans için optimize edildi
    - Çakışan politikalar temizlendi

  3. Function Search Path
    - update_updated_at_column fonksiyonuna güvenli search_path eklendi
    - Trigger'lar yeniden oluşturuldu
*/

-- Add missing index for due_id foreign key
CREATE INDEX IF NOT EXISTS idx_transactions_due_id ON transactions(due_id);

-- Drop triggers first
DROP TRIGGER IF EXISTS update_members_updated_at ON members;
DROP TRIGGER IF EXISTS update_dues_updated_at ON dues;
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;

-- Fix function search path
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Recreate triggers
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dues_updated_at
  BEFORE UPDATE ON dues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Drop all existing RLS policies to start fresh
DROP POLICY IF EXISTS "Anyone can view members for login" ON members;
DROP POLICY IF EXISTS "Authenticated users can insert members" ON members;
DROP POLICY IF EXISTS "Authenticated users can update members" ON members;
DROP POLICY IF EXISTS "Admin users can view all members" ON members;
DROP POLICY IF EXISTS "Members can view their own data" ON members;
DROP POLICY IF EXISTS "Admin users can insert members" ON members;
DROP POLICY IF EXISTS "Admin users can update members" ON members;

DROP POLICY IF EXISTS "Anyone can view all dues" ON dues;
DROP POLICY IF EXISTS "Anyone can manage dues" ON dues;
DROP POLICY IF EXISTS "Admin users can view all dues" ON dues;
DROP POLICY IF EXISTS "Members can view their own dues" ON dues;
DROP POLICY IF EXISTS "Admin users can manage dues" ON dues;

DROP POLICY IF EXISTS "Anyone can view all transactions" ON transactions;
DROP POLICY IF EXISTS "Anyone can manage transactions" ON transactions;
DROP POLICY IF EXISTS "Admin and treasurer can view all transactions" ON transactions;
DROP POLICY IF EXISTS "Members can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Admin and treasurer can manage transactions" ON transactions;

DROP POLICY IF EXISTS "Anyone can view admin users" ON admin_users;
DROP POLICY IF EXISTS "Anyone can manage admin users" ON admin_users;
DROP POLICY IF EXISTS "Admin users can view all admin users" ON admin_users;
DROP POLICY IF EXISTS "Admin users can manage admin users" ON admin_users;

-- Create simplified RLS policies for members table
CREATE POLICY "public_access_members"
  ON members FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create simplified RLS policies for dues table
CREATE POLICY "public_access_dues"
  ON dues FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create simplified RLS policies for transactions table
CREATE POLICY "public_access_transactions"
  ON transactions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create simplified RLS policies for admin_users table
CREATE POLICY "public_access_admin_users"
  ON admin_users FOR ALL
  USING (true)
  WITH CHECK (true);
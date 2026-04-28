/*
  # Gelir Türleri ve Duyurular

  1. Yeni Tablolar
    - `income_types` - Gelir türlerini tanımlama (aidat, bağış, vb.)
      - `id` (uuid, primary key)
      - `name` (text) - Gelir türü adı
      - `is_active` (boolean) - Aktif mi?
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `announcements` - Duyurular
      - `id` (uuid, primary key)
      - `title` (text) - Başlık
      - `content` (text) - İçerik
      - `image_url` (text, nullable) - Görsel URL'i
      - `is_active` (boolean) - Aktif mi?
      - `created_by` (uuid, foreign key to members) - Oluşturan
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Tablo Güncellemeleri
    - `transactions` tablosuna `income_type_id` eklendi
    - `dues` tablosuna `is_bulk_accrued` ve `accrual_date` eklendi

  3. Güvenlik
    - Tüm tablolar için RLS etkinleştirildi
    - Public erişim politikaları eklendi

  4. Varsayılan Veriler
    - Aidat, Bağış, Diğer gelir türleri eklendi
*/

-- Create income_types table
CREATE TABLE IF NOT EXISTS income_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  image_url text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES members(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add income_type_id to transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'income_type_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN income_type_id uuid REFERENCES income_types(id);
  END IF;
END $$;

-- Add bulk accrual fields to dues
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dues' AND column_name = 'is_bulk_accrued'
  ) THEN
    ALTER TABLE dues ADD COLUMN is_bulk_accrued boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dues' AND column_name = 'accrual_date'
  ) THEN
    ALTER TABLE dues ADD COLUMN accrual_date timestamptz;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_income_type_id ON transactions(income_type_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements(created_by);

-- Enable RLS
ALTER TABLE income_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "public_access_income_types" ON income_types;
DROP POLICY IF EXISTS "public_access_announcements" ON announcements;

-- Create RLS policies
CREATE POLICY "public_access_income_types"
  ON income_types FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "public_access_announcements"
  ON announcements FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_income_types_updated_at ON income_types;
DROP TRIGGER IF EXISTS update_announcements_updated_at ON announcements;

CREATE TRIGGER update_income_types_updated_at
  BEFORE UPDATE ON income_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default income types
INSERT INTO income_types (name) VALUES 
  ('Aidat'),
  ('Bağış'),
  ('Diğer')
ON CONFLICT DO NOTHING;
/*
  # Dernek Yönetim Sistemi - Veritabanı Şeması

  ## Yeni Tablolar
  
  ### 1. `members` - Üye Bilgileri
    - `id` (uuid, primary key) - Benzersiz üye kimliği
    - `first_name` (text) - Üye adı
    - `last_name` (text) - Üye soyadı
    - `tc_id` (text, unique) - TC Kimlik Numarası (11 haneli, giriş için kullanılacak)
    - `birth_date` (date) - Doğum tarihi (giriş için kullanılacak)
    - `phone` (text, optional) - Cep telefonu numarası
    - `email` (text, optional) - E-posta adresi
    - `is_active` (boolean) - Üyelik durumu
    - `registration_date` (timestamptz) - Kayıt tarihi
    - `created_at` (timestamptz) - Oluşturulma zamanı
    - `updated_at` (timestamptz) - Güncellenme zamanı

  ### 2. `dues` - Aidat Kayıtları
    - `id` (uuid, primary key) - Benzersiz aidat kaydı kimliği
    - `member_id` (uuid, foreign key) - Üye referansı
    - `amount` (decimal) - Aidat tutarı
    - `period_year` (integer) - Aidat yılı
    - `period_month` (integer) - Aidat ayı
    - `due_date` (date) - Son ödeme tarihi
    - `paid_date` (date, optional) - Ödeme tarihi
    - `status` (text) - Ödeme durumu (pending, paid, overdue)
    - `notes` (text, optional) - Notlar
    - `created_at` (timestamptz) - Oluşturulma zamanı
    - `updated_at` (timestamptz) - Güncellenme zamanı

  ### 3. `transactions` - Gelir-Gider Defterleri
    - `id` (uuid, primary key) - Benzersiz işlem kimliği
    - `type` (text) - İşlem tipi (income, expense)
    - `category` (text) - Kategori (dues, donation, salary, rent, utilities, etc.)
    - `amount` (decimal) - Tutar
    - `description` (text) - Açıklama
    - `transaction_date` (date) - İşlem tarihi
    - `member_id` (uuid, foreign key, optional) - İlgili üye (aidat ödemeleri için)
    - `due_id` (uuid, foreign key, optional) - İlgili aidat kaydı
    - `receipt_number` (text, optional) - Fiş/Makbuz numarası
    - `created_by` (uuid) - İşlemi oluşturan kullanıcı
    - `created_at` (timestamptz) - Oluşturulma zamanı
    - `updated_at` (timestamptz) - Güncellenme zamanı

  ### 4. `admin_users` - Yönetici Kullanıcılar
    - `id` (uuid, primary key) - Benzersiz yönetici kimliği
    - `member_id` (uuid, foreign key) - İlgili üye kaydı
    - `role` (text) - Rol (admin, treasurer, secretary)
    - `created_at` (timestamptz) - Oluşturulma zamanı

  ## Güvenlik
    - Tüm tablolarda Row Level Security (RLS) etkinleştirildi
    - Yönetici kullanıcılar tüm kayıtlara erişebilir
    - Normal üyeler sadece kendi kayıtlarını görebilir
    - Kimlik doğrulama için TC Kimlik No ve doğum tarihi kullanılacak

  ## Önemli Notlar
    1. TC Kimlik numarası benzersiz olmalı ve 11 haneli olmalı
    2. Aidat kayıtları üyelere bağlıdır
    3. Gelir-gider kayıtları kategorilere ayrılmıştır
    4. Aidat ödemeleri hem dues hem de transactions tablosunda izlenir
    5. Üye durumu aktif/pasif olarak işaretlenebilir
*/

-- Create members table
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  tc_id text UNIQUE NOT NULL CHECK (length(tc_id) = 11 AND tc_id ~ '^[0-9]+$'),
  birth_date date NOT NULL,
  phone text,
  email text,
  is_active boolean DEFAULT true,
  registration_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create dues table
CREATE TABLE IF NOT EXISTS dues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL CHECK (amount > 0),
  period_year integer NOT NULL CHECK (period_year >= 2000 AND period_year <= 2100),
  period_month integer NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  due_date date NOT NULL,
  paid_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, period_year, period_month)
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  amount decimal(10,2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  due_id uuid REFERENCES dues(id) ON DELETE SET NULL,
  receipt_number text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'treasurer', 'secretary')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(member_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_members_tc_id ON members(tc_id);
CREATE INDEX IF NOT EXISTS idx_members_active ON members(is_active);
CREATE INDEX IF NOT EXISTS idx_dues_member_id ON dues(member_id);
CREATE INDEX IF NOT EXISTS idx_dues_status ON dues(status);
CREATE INDEX IF NOT EXISTS idx_dues_period ON dues(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_member_id ON transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_member_id ON admin_users(member_id);

-- Enable Row Level Security
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for members table
CREATE POLICY "Admin users can view all members"
  ON members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Members can view their own data"
  ON members FOR SELECT
  TO authenticated
  USING (id::text = auth.uid()::text);

CREATE POLICY "Admin users can insert members"
  ON members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Admin users can update members"
  ON members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id::text = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id::text = auth.uid()::text
    )
  );

-- RLS Policies for dues table
CREATE POLICY "Admin users can view all dues"
  ON dues FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Members can view their own dues"
  ON dues FOR SELECT
  TO authenticated
  USING (member_id::text = auth.uid()::text);

CREATE POLICY "Admin users can manage dues"
  ON dues FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id::text = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id::text = auth.uid()::text
    )
  );

-- RLS Policies for transactions table
CREATE POLICY "Admin and treasurer can view all transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id::text = auth.uid()::text
      AND admin_users.role IN ('admin', 'treasurer')
    )
  );

CREATE POLICY "Members can view their own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (member_id::text = auth.uid()::text);

CREATE POLICY "Admin and treasurer can manage transactions"
  ON transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id::text = auth.uid()::text
      AND admin_users.role IN ('admin', 'treasurer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id::text = auth.uid()::text
      AND admin_users.role IN ('admin', 'treasurer')
    )
  );

-- RLS Policies for admin_users table
CREATE POLICY "Admin users can view all admin users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.member_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Admin users can manage admin users"
  ON admin_users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.member_id::text = auth.uid()::text
      AND au.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.member_id::text = auth.uid()::text
      AND au.role = 'admin'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
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
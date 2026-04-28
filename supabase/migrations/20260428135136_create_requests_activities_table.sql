/*
  # Talepler/Faaliyetler Tablosu

  1. New Tables
    - `requests_activities`
      - `id` (uuid, primary key) - Benzersiz kayit kimliği
      - `type` (text, not null) - 'request' (talep) veya 'activity' (faaliyet)
      - `description` (text, not null) - Talep/faaliyet aciklamasi
      - `result_status` (text, nullable) - Sadece talepler icin: 'positive' veya 'negative'
      - `result_description` (text, nullable) - Sadece talepler icin: sonuc aciklamasi
      - `created_by` (uuid, foreign key) - Kaydi olusturan yonetici
      - `created_at` (timestamptz) - Olusturulma tarihi
      - `updated_at` (timestamptz) - Guncellenme tarihi

  2. Security
    - Enable RLS on `requests_activities` table
    - Only admin users can select, insert, update, delete
*/

CREATE TABLE IF NOT EXISTS requests_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('request', 'activity')),
  description text NOT NULL DEFAULT '',
  result_status text CHECK (result_status IS NULL OR result_status IN ('positive', 'negative')),
  result_description text,
  created_by uuid REFERENCES members(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE requests_activities ENABLE ROW LEVEL SECURITY;

-- Only admins can view
CREATE POLICY "Admins can view requests_activities"
  ON requests_activities
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id = auth.uid()
    )
  );

-- Only admins can insert
CREATE POLICY "Admins can insert requests_activities"
  ON requests_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id = auth.uid()
    )
  );

-- Only admins can update
CREATE POLICY "Admins can update requests_activities"
  ON requests_activities
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id = auth.uid()
    )
  );

-- Only admins can delete
CREATE POLICY "Admins can delete requests_activities"
  ON requests_activities
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id = auth.uid()
    )
  );

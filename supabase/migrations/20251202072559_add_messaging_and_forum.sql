/*
  # Add Messaging and Free Forum Features

  ## ÖNEMLİ DÜZELTME: RLS Politikası Güncellemeleri
  - Admin yetkisine dayalı kurallar, toplu işlemlerde ve forum yönetiminde doğru çalışacak şekilde güncellenmiştir.
  - Kod, mevcut sisteminizdeki 'birth_date' tabanlı Admin doğrulama yöntemine uyarlanmıştır.
*/

-- direct_messages tablosu (önceki migration'lardan doğru olarak varsayılmıştır)
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Forum posts table
CREATE TABLE IF NOT EXISTS forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  is_active boolean DEFAULT true,
  is_pinned boolean DEFAULT false, 
  pinned_at timestamptz, 
  pinned_by uuid REFERENCES members(id) ON DELETE SET NULL, 
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;

-- Forum comments table
CREATE TABLE IF NOT EXISTS forum_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE forum_comments ENABLE ROW LEVEL SECURITY;

-- Admin olup olmadığını kontrol eden helper (Kullanıcının base schema'sındaki karmaşık yönteme uyum için)
-- NOT: current_setting('app.member_id') kullanılması gerekir, ancak base schema'da birth_date kullanıldığı için eski yöntem korunuyor.
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM admin_users 
        WHERE member_id IN (SELECT id FROM members WHERE birth_date = (current_setting('app.user_birth_date', true))::date)
    );
$$;


-- FORUM POSTS POLİTİKALARI
-- 1. Herkes aktif gönderileri görebilir
CREATE POLICY "Anyone can view active forum posts"
  ON forum_posts FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 2. Üyeler gönderi oluşturabilir
CREATE POLICY "Members can create forum posts"
  ON forum_posts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Yazar VEYA Admin güncelleyebilir (pinleme dahil)
CREATE POLICY "Authors or Admins can update their posts"
  ON forum_posts FOR UPDATE
  TO authenticated
  USING (author_id::text = current_setting('app.member_id', true)::text OR is_admin())
  WITH CHECK (author_id::text = current_setting('app.member_id', true)::text OR is_admin());

-- 4. Yazar VEYA Admin silebilir (KURAL 3)
CREATE POLICY "Authors or Admins can delete their posts"
  ON forum_posts FOR DELETE
  TO authenticated
  USING (author_id::text = current_setting('app.member_id', true)::text OR is_admin());

-- FORUM COMMENTS POLİTİKALARI
-- 1. Yorum oluşturma
CREATE POLICY "Members can create forum comments"
  ON forum_comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id::text = current_setting('app.member_id', true)::text);

-- 2. Yazar VEYA Admin silebilir (KURAL 3)
CREATE POLICY "Authors or Admins can delete comments"
  ON forum_comments FOR DELETE
  TO authenticated
  USING (author_id::text = current_setting('app.member_id', true)::text OR is_admin());

-- 3. Yorumları güncelleme (Sadece yazar güncelleyebilir)
CREATE POLICY "Authors can update their own comments"
  ON forum_comments FOR UPDATE
  TO authenticated
  USING (author_id::text = current_setting('app.member_id', true)::text)
  WITH CHECK (author_id::text = current_setting('app.member_id', true)::text);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_messages_sender ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON direct_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON direct_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON forum_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at ON forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_comments_post ON forum_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_comments_author ON forum_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_comments_created_at ON forum_comments(created_at DESC);
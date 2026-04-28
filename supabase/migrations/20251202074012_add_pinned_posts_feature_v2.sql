/*
  # Add Pinned Posts Feature

  ## Changes to Existing Tables

  1. `announcements` table
    - Add `is_pinned` (boolean, default false)
    - Add `pinned_at` (timestamp, nullable)
    - Add `pinned_by` (uuid, references members, nullable)

  2. `forum_posts` table
    - Add `is_pinned` (boolean, default false)
    - Add `pinned_at` (timestamp, nullable)
    - Add `pinned_by` (uuid, references members, nullable)

  ## Security
    - Update RLS policies to allow admins to pin/unpin posts
*/

-- Add pinned columns to announcements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'is_pinned'
  ) THEN
    ALTER TABLE announcements ADD COLUMN is_pinned boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'pinned_at'
  ) THEN
    ALTER TABLE announcements ADD COLUMN pinned_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'pinned_by'
  ) THEN
    ALTER TABLE announcements ADD COLUMN pinned_by uuid REFERENCES members(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add pinned columns to forum_posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'forum_posts' AND column_name = 'is_pinned'
  ) THEN
    ALTER TABLE forum_posts ADD COLUMN is_pinned boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'forum_posts' AND column_name = 'pinned_at'
  ) THEN
    ALTER TABLE forum_posts ADD COLUMN pinned_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'forum_posts' AND column_name = 'pinned_by'
  ) THEN
    ALTER TABLE forum_posts ADD COLUMN pinned_by uuid REFERENCES members(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Drop old policies if they exist and create new ones
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can pin announcements" ON announcements;
  DROP POLICY IF EXISTS "Admins can pin forum posts" ON forum_posts;
END $$;

CREATE POLICY "Admins can update all announcements"
  ON announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id IN (SELECT id FROM members WHERE username = current_user)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id IN (SELECT id FROM members WHERE username = current_user)
    )
  );

CREATE POLICY "Authors and admins can update forum posts"
  ON forum_posts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id IN (SELECT id FROM members WHERE username = current_user)
    ) OR
    author_id IN (SELECT id FROM members WHERE username = current_user)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.member_id IN (SELECT id FROM members WHERE username = current_user)
    ) OR
    author_id IN (SELECT id FROM members WHERE username = current_user)
  );

CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(is_pinned, pinned_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_pinned ON forum_posts(is_pinned, pinned_at DESC);
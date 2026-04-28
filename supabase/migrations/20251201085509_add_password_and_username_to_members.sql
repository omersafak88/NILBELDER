/*
  # Add password and username to members table
  
  1. Changes
    - Add `username` column (nullable initially for existing users, will store phone number)
    - Add `password_hash` column (nullable initially for existing users)
    - Add `is_activated` boolean column to track if account is activated
  
  2. Notes
    - TC ID will remain in the table temporarily for activation process
    - After activation, TC ID will be cleared for that member
    - Username will be used as the login identifier (phone number)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'username'
  ) THEN
    ALTER TABLE members ADD COLUMN username text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE members ADD COLUMN password_hash text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'is_activated'
  ) THEN
    ALTER TABLE members ADD COLUMN is_activated boolean DEFAULT false;
  END IF;
END $$;
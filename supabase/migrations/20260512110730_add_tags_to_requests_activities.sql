/*
  # Add tags column to requests_activities table

  1. Modified Tables
    - `requests_activities`
      - Added `tags` (text array, default empty array) - stores comma-separated tags for categorization

  2. Notes
    - Tags are stored as a text array for efficient querying
    - Default is an empty array so existing records are unaffected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests_activities' AND column_name = 'tags'
  ) THEN
    ALTER TABLE requests_activities ADD COLUMN tags text[] DEFAULT '{}';
  END IF;
END $$;

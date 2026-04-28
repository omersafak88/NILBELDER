/*
  # Consolidate member names into single column

  ## Changes
  - Add full_name column to members table
  - Migrate existing first_name and last_name data to full_name
  - Remove first_name and last_name columns
  
  ## Security
  - No RLS changes needed
  - Existing policies remain effective
  
  ## Data Migration
  - Combines first_name and last_name into full_name
  - Preserves all existing member data
*/

-- Add full_name column
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS full_name text;

-- Migrate existing data
UPDATE members 
SET full_name = CONCAT(first_name, ' ', last_name)
WHERE full_name IS NULL;

-- Make full_name required
ALTER TABLE members 
ALTER COLUMN full_name SET NOT NULL;

-- Drop old columns
ALTER TABLE members 
DROP COLUMN IF EXISTS first_name,
DROP COLUMN IF EXISTS last_name;
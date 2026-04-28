/*
  # Make tc_id nullable for activated accounts

  ## Changes
  - Remove NOT NULL constraint from members.tc_id column
  - This allows TC IDs to be removed after account activation for privacy

  ## Security
  - No RLS changes needed
  - Existing policies remain effective
*/

ALTER TABLE members 
ALTER COLUMN tc_id DROP NOT NULL;
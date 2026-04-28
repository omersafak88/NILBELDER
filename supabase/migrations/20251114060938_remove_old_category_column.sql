/*
  # Remove old category column from transactions table

  1. Changes
    - Remove the old `category` column from transactions table
    - System now uses `category_id` foreign key instead
  
  2. Notes
    - This is safe because we're using the new category_id system
    - All existing data uses category_id
*/

ALTER TABLE transactions 
DROP COLUMN IF EXISTS category;

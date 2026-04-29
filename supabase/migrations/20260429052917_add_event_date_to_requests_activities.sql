/*
  # Add event_date column to requests_activities

  1. Changes
    - Add `event_date` (date) column to `requests_activities` table
    - Default value is current date
    - Allows users to specify the date of the request or activity
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests_activities' AND column_name = 'event_date'
  ) THEN
    ALTER TABLE requests_activities ADD COLUMN event_date date DEFAULT CURRENT_DATE;
  END IF;
END $$;

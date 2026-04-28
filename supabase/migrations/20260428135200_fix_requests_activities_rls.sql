/*
  # Fix RLS policies for requests_activities table

  The project uses application-level auth (not Supabase Auth),
  so RLS policies need to match the existing pattern.

  1. Changes
    - Drop auth.uid()-based policies that won't work
    - Add public_access policy matching other tables
    - Add updated_at trigger
*/

-- Drop the auth.uid()-based policies
DROP POLICY IF EXISTS "Admins can view requests_activities" ON requests_activities;
DROP POLICY IF EXISTS "Admins can insert requests_activities" ON requests_activities;
DROP POLICY IF EXISTS "Admins can update requests_activities" ON requests_activities;
DROP POLICY IF EXISTS "Admins can delete requests_activities" ON requests_activities;

-- Match existing project pattern
CREATE POLICY "public_access_requests_activities"
  ON requests_activities FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_requests_activities_updated_at
  BEFORE UPDATE ON requests_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add tier column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro'));

-- Create index for tier queries
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON profiles(tier);

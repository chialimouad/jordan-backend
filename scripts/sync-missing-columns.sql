-- Sync Missing Columns for User Entity
-- Run this script to add missing columns to the users table

-- Chat Settings columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS "readReceipts" boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "typingIndicator" boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "autoDownloadMedia" boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "receiveDMs" boolean DEFAULT true;

-- Location
ALTER TABLE users ADD COLUMN IF NOT EXISTS "locationEnabled" boolean DEFAULT false;

-- Verify the columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('readReceipts', 'typingIndicator', 'autoDownloadMedia', 'receiveDMs', 'locationEnabled');

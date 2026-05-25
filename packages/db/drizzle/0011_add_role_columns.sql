-- Add role-based access control columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
ADD COLUMN IF NOT EXISTS isPremium boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS isAdmin boolean NOT NULL DEFAULT false;
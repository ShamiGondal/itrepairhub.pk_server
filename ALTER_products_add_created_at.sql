-- Add created_at column to products table
-- This migration adds the created_at timestamp column to the products table
-- Run this if your database was created before the created_at column was added

USE itrepairhub;

ALTER TABLE `products` 
ADD COLUMN `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER `section`;

-- Optional: Update existing records to have a created_at timestamp
-- Uncomment the line below if you want to set created_at for existing products
-- UPDATE `products` SET `created_at` = CURRENT_TIMESTAMP WHERE `created_at` IS NULL;


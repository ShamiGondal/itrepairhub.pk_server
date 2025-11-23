-- Add created_at column to products table
-- Run this command in MySQL Workbench

ALTER TABLE `products`
ADD COLUMN `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER `section`;

-- Add index for better query performance on created_at
ALTER TABLE `products`
ADD INDEX `idx_created_at` (`created_at`);


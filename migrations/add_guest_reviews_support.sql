-- Migration: Add guest review support
-- Allows guests to post reviews using email verification

USE itrepairhub;

-- Step 1: Add guest_email column to reviews table
ALTER TABLE `reviews` 
ADD COLUMN `guest_email` VARCHAR(255) NULL AFTER `user_id`,
ADD COLUMN `guest_name` VARCHAR(255) NULL AFTER `guest_email`,
ADD INDEX `idx_guest_email` (`guest_email`);

-- Step 2: Make user_id nullable (guest reviews won't have user_id)
ALTER TABLE `reviews` 
MODIFY COLUMN `user_id` INT NULL;

-- Step 3: Note about validation
-- Application-level validation will ensure either user_id OR guest_email is provided
-- MySQL CHECK constraints are enforced at application level for better compatibility

-- Step 4: Add comment to document the change
ALTER TABLE `reviews` 
MODIFY COLUMN `user_id` INT NULL COMMENT 'User ID for logged-in user reviews, NULL for guest reviews';


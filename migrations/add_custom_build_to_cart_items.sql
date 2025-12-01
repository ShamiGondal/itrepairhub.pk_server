-- Migration: Add custom_build_id support to cart_items table
-- This allows custom PC builds to be added to cart

-- Add custom_build_id column
ALTER TABLE `cart_items` 
ADD COLUMN `custom_build_id` INT NULL AFTER `service_id`;

-- Add foreign key constraint
ALTER TABLE `cart_items`
ADD CONSTRAINT `fk_cart_items_custom_build` 
FOREIGN KEY (`custom_build_id`) REFERENCES `custom_pc_builds`(`id`) ON DELETE RESTRICT;

-- Update check constraint to allow custom_build_id
ALTER TABLE `cart_items`
DROP CHECK `chk_cart_item_type`;

ALTER TABLE `cart_items`
ADD CONSTRAINT `chk_cart_item_type` 
CHECK (`product_id` IS NOT NULL OR `service_id` IS NOT NULL OR `custom_build_id` IS NOT NULL);

-- Add unique constraint for custom builds (one custom build per cart)
ALTER TABLE `cart_items`
ADD UNIQUE KEY `unique_cart_custom_build` (`cart_id`, `custom_build_id`);

-- Add index for performance
ALTER TABLE `cart_items`
ADD INDEX `idx_custom_build_id` (`custom_build_id`);


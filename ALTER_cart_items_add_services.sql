-- ALTER commands to add service support to cart_items table
-- Run these commands in MySQL Workbench or your database client

USE itrepairhub;

-- Step 1: Drop existing unique constraint on product_id
ALTER TABLE `cart_items` DROP INDEX `unique_cart_product`;

-- Step 2: Make product_id nullable
ALTER TABLE `cart_items` MODIFY COLUMN `product_id` INT NULL COMMENT 'For product items';

-- Step 3: Add service_id column
ALTER TABLE `cart_items` ADD COLUMN `service_id` INT NULL COMMENT 'For service items' AFTER `product_id`;

-- Step 4: Add foreign key for service_id
ALTER TABLE `cart_items` ADD CONSTRAINT `fk_cart_items_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT;

-- Step 5: Add constraint to ensure either product_id or service_id is set
ALTER TABLE `cart_items` ADD CONSTRAINT `chk_cart_item_type` CHECK (`product_id` IS NOT NULL OR `service_id` IS NOT NULL);

-- Step 6: Add unique constraint for products
ALTER TABLE `cart_items` ADD UNIQUE KEY `unique_cart_product` (`cart_id`, `product_id`);

-- Step 7: Add unique constraint for services
ALTER TABLE `cart_items` ADD UNIQUE KEY `unique_cart_service` (`cart_id`, `service_id`);

-- Step 8: Add index for service_id
ALTER TABLE `cart_items` ADD INDEX `idx_service_id` (`service_id`);


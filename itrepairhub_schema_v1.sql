-- Set default engine and character set
SET default_storage_engine=InnoDB;
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS itrepairhub;
USE itrepairhub;

-- ---------------------------------
-- 1. Core: Users & Guest
-- ---------------------------------

CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone_number` VARCHAR(50) NULL,
  `password_hash` VARCHAR(255) NULL,
  `auth_provider` ENUM('local', 'google') NOT NULL DEFAULT 'local',
  `provider_id` VARCHAR(255) NULL,
  `role` ENUM('customer', 'business', 'admin', 'technician') NOT NULL DEFAULT 'customer',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `phone_number` (`phone_number`),
  INDEX `idx_email` (`email`),
  INDEX `idx_provider_id` (`provider_id`),
  INDEX `idx_role` (`role`)
) COMMENT='Central table for REGISTERED users.';

CREATE TABLE `companies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_name` VARCHAR(255) NOT NULL,
  `contact_person_id` INT NULL,
  `tax_id` VARCHAR(100) NULL,
  `contract_status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`contact_person_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) COMMENT='Stores B2B client information.';

CREATE TABLE `addresses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `label` VARCHAR(100) NULL COMMENT 'e.g., Home, Work, Company HQ',
  `line_1` VARCHAR(255) NOT NULL,
  `line_2` VARCHAR(255) NULL,
  `city` VARCHAR(100) NOT NULL,
  `state` VARCHAR(100) NULL,
  `postal_code` VARCHAR(20) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) COMMENT='Saved addresses for REGISTERED users only.';

CREATE TABLE `guest_details` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone_number` VARCHAR(50) NOT NULL,
  `address_line_1` VARCHAR(255) NULL,
  `address_line_2` VARCHAR(255) NULL,
  `city` VARCHAR(100) NULL,
  `state` VARCHAR(100) NULL,
  `postal_code` VARCHAR(20) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) COMMENT='Stores contact/address for GUEST checkout/booking.';

-- ---------------------------------
-- 2. Module: Service Bookings & Pricing
-- ---------------------------------

CREATE TABLE `service_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `image_url` VARCHAR(1024) NULL,
  `slug` VARCHAR(255) NOT NULL,
  `seo_title` VARCHAR(255) NULL,
  `meta_description` TEXT NULL,
  UNIQUE KEY `slug` (`slug`),
  INDEX `idx_slug` (`slug`)
) COMMENT='Categories for services.';

CREATE TABLE `services` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `category_id` INT NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `short_description` TEXT NULL,
  `long_description` TEXT NULL,
  `specifications` JSON NULL,
  `service_type` ENUM('hardware', 'software') NOT NULL,
  `price_type` ENUM('variable', 'fixed') NOT NULL,
  `price` DECIMAL(10, 2) NULL,
  `discount_percentage` DECIMAL(5, 2) DEFAULT 0.00,
  `average_rating` DECIMAL(3, 2) DEFAULT 0.00,
  `review_count` INT DEFAULT 0,
  `warranty_info` VARCHAR(255) NULL,
  `seo_title` VARCHAR(255) NULL,
  `meta_description` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `section` VARCHAR(100) NULL,
  UNIQUE KEY `slug` (`slug`),
  FOREIGN KEY (`category_id`) REFERENCES `service_categories`(`id`) ON DELETE SET NULL,
  INDEX `idx_slug` (`slug`),
  INDEX `idx_section` (`section`)
) COMMENT='Catalog of services.';

CREATE TABLE `service_images` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `service_id` INT NOT NULL,
  `image_url` VARCHAR(1024) NOT NULL,
  `alt_text` VARCHAR(255) NULL,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE,
  INDEX `idx_service_order` (`service_id`, `display_order`)
) COMMENT='Gallery images for services';

CREATE TABLE `bookings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `guest_id` INT NULL,
  `service_id` INT NOT NULL,
  `address_id` INT NULL,
  `technician_id` INT NULL,
  `quoted_amount` DECIMAL(10, 2) NULL,
  `discount_amount` DECIMAL(10, 2) DEFAULT 0.00,
  `total_amount` DECIMAL(10, 2) NULL,
  `coupon_code` VARCHAR(50) NULL,
  `booking_date` DATE NOT NULL,
  `booking_time` TIME NOT NULL,
  `status` ENUM('pending', 'confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  `admin_notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`guest_id`) REFERENCES `guest_details`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`address_id`) REFERENCES `addresses`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_booking_owner` CHECK (`user_id` IS NOT NULL OR `guest_id` IS NOT NULL)
) COMMENT='Service appointments with financial snapshots.';

CREATE TABLE `consultations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NULL,
  `type` ENUM('on_site', 'online_meeting') NOT NULL,
  `scheduled_at` DATETIME NOT NULL,
  `status` ENUM('requested', 'scheduled', 'completed') NOT NULL DEFAULT 'requested',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) COMMENT='Free consultations.';

-- ---------------------------------
-- 3. Module: E-Commerce & Pricing
-- ---------------------------------

CREATE TABLE `product_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `image_url` VARCHAR(1024) NULL,
  `slug` VARCHAR(255) NOT NULL,
  `seo_title` VARCHAR(255) NULL,
  `meta_description` TEXT NULL,
  UNIQUE KEY `slug` (`slug`),
  INDEX `idx_slug` (`slug`)
) COMMENT='Categories for products.';

CREATE TABLE `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `category_id` INT NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `sku` VARCHAR(100) NOT NULL,
  `condition` ENUM('new', 'used') NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `discount_percentage` DECIMAL(5, 2) DEFAULT 0.00,
  `stock_quantity` INT NOT NULL DEFAULT 0,
  `average_rating` DECIMAL(3, 2) DEFAULT 0.00,
  `review_count` INT DEFAULT 0,
  `warranty_info` VARCHAR(255) NULL,
  `specifications` JSON NULL,
  `short_description` TEXT NULL,
  `long_description` TEXT NULL,
  `seo_title` VARCHAR(255) NULL,
  `meta_description` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `section` VARCHAR(100) NULL,
  UNIQUE KEY `slug` (`slug`),
  UNIQUE KEY `sku` (`sku`),
  FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE SET NULL,
  INDEX `idx_slug` (`slug`),
  INDEX `idx_sku` (`sku`),
  INDEX `idx_section` (`section`)
) COMMENT='Catalog for products.';

CREATE TABLE `product_images` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `image_url` VARCHAR(1024) NOT NULL,
  `alt_text` VARCHAR(255) NULL,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  INDEX `idx_product_order` (`product_id`, `display_order`)
) COMMENT='Gallery images for products';

CREATE TABLE `promo_codes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) NOT NULL,
  `discount_type` ENUM('percentage', 'fixed_amount') NOT NULL,
  `discount_value` DECIMAL(10, 2) NOT NULL,
  `min_order_amount` DECIMAL(10, 2) DEFAULT 0.00,
  `usage_limit` INT DEFAULT NULL,
  `used_count` INT DEFAULT 0,
  `expires_at` DATETIME NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `code` (`code`)
) COMMENT='Engine for handling cart-level discounts';

-- ---------------------------------
-- 4. Procurement & Orders
-- ---------------------------------

CREATE TABLE `sell_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL COMMENT 'MUST be Registered',
  `request_type` ENUM('check_price', 'sell_item') NOT NULL,
  `device_type` VARCHAR(100) NOT NULL,
  `brand` VARCHAR(100) NULL,
  `model` VARCHAR(100) NULL,
  `specifications` JSON NOT NULL,
  `condition_notes` JSON NULL,
  `user_requested_price` DECIMAL(10, 2) NULL,
  `estimated_price` DECIMAL(10, 2) NULL,
  `final_offer_price` DECIMAL(10, 2) NULL,
  `address_id` INT NULL COMMENT 'Pickup/delivery address for the sell request',
  `contact_number` VARCHAR(50) NULL COMMENT 'Optional contact number for pickup coordination',
  `status` ENUM('submitted', 'inspection_pending', 'purchased', 'rejected') NOT NULL DEFAULT 'submitted',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`address_id`) REFERENCES `addresses`(`id`) ON DELETE SET NULL
) COMMENT='Inbox for selling items (Registered Users Only).';

CREATE TABLE `sell_request_images` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sell_request_id` INT NOT NULL,
  `image_url` VARCHAR(1024) NOT NULL,
  `alt_text` VARCHAR(255) NULL,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`sell_request_id`) REFERENCES `sell_requests`(`id`) ON DELETE CASCADE,
  INDEX `idx_request_images` (`sell_request_id`)
) COMMENT='Images uploaded by users for sell/price-check requests';

CREATE TABLE `custom_pc_builds` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `total_estimated_price` DECIMAL(10, 2) NOT NULL,
  `configuration_data` JSON NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`)
) COMMENT='Saved user PC configurations.';

CREATE TABLE `pc_compatibility_rules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rule_type` ENUM('max_quantity', 'socket_compatibility', 'form_factor', 'power_requirement', 'memory_type', 'storage_interface', 'custom') NOT NULL,
  `category_id` INT NULL COMMENT 'Applies to products in this category (e.g., RAM category)',
  `rule_name` VARCHAR(255) NOT NULL,
  `rule_config` JSON NOT NULL COMMENT 'Flexible JSON configuration for different rule types',
  `error_message` TEXT NOT NULL COMMENT 'User-friendly error message when rule is violated',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE CASCADE,
  INDEX `idx_category_active` (`category_id`, `is_active`),
  INDEX `idx_rule_type` (`rule_type`)
) COMMENT='Dynamic compatibility rules for PC Builder validation.';

CREATE TABLE `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `guest_id` INT NULL,
  `address_id` INT NULL,
  `subtotal` DECIMAL(10, 2) NOT NULL,
  `discount_amount` DECIMAL(10, 2) DEFAULT 0.00,
  `total_amount` DECIMAL(10, 2) NOT NULL,
  `coupon_code` VARCHAR(50) NULL,
  `order_status` ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  `payment_status` ENUM('unpaid', 'paid', 'refunded') NOT NULL DEFAULT 'unpaid',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`guest_id`) REFERENCES `guest_details`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`address_id`) REFERENCES `addresses`(`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_order_owner` CHECK (`user_id` IS NOT NULL OR `guest_id` IS NOT NULL)
) COMMENT='Main table for purchases.';

CREATE TABLE `order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `product_id` INT NULL,
  `custom_build_id` INT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `price_at_purchase` DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`custom_build_id`) REFERENCES `custom_pc_builds`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_item` CHECK (`product_id` IS NOT NULL OR `custom_build_id` IS NOT NULL)
) COMMENT='Line items for an order.';

CREATE TABLE `carts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `guest_id` INT NULL,
  `session_id` VARCHAR(255) NULL,
  `coupon_code` VARCHAR(50) NULL,
  `subtotal` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(10, 2) DEFAULT 0.00,
  `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`guest_id`) REFERENCES `guest_details`(`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_cart_owner` CHECK (`user_id` IS NOT NULL OR `guest_id` IS NOT NULL OR `session_id` IS NOT NULL),
  INDEX `idx_user_cart` (`user_id`),
  INDEX `idx_guest_cart` (`guest_id`),
  INDEX `idx_session_cart` (`session_id`)
) COMMENT='Shopping cart for products.';

CREATE TABLE `cart_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cart_id` INT NOT NULL,
  `product_id` INT NULL,
  `service_id` INT NULL,
  `custom_build_id` INT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `price_at_added` DECIMAL(10, 2) NOT NULL,
  `discount_percentage` DECIMAL(5, 2) DEFAULT 0.00,
  `discounted_price` DECIMAL(10, 2) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`custom_build_id`) REFERENCES `custom_pc_builds`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_cart_item_type` CHECK (`product_id` IS NOT NULL OR `service_id` IS NOT NULL OR `custom_build_id` IS NOT NULL),
  UNIQUE KEY `unique_cart_product` (`cart_id`, `product_id`),
  UNIQUE KEY `unique_cart_service` (`cart_id`, `service_id`),
  UNIQUE KEY `unique_cart_custom_build` (`cart_id`, `custom_build_id`),
  INDEX `idx_cart_items` (`cart_id`),
  INDEX `idx_product_id` (`product_id`),
  INDEX `idx_service_id` (`service_id`),
  INDEX `idx_custom_build_id` (`custom_build_id`)
) COMMENT='Individual items in shopping cart.';

CREATE TABLE `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `guest_id` INT NULL,
  `order_id` INT NULL,
  `booking_id` INT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `gateway` ENUM('stripe', 'local_gateway', 'cash') NOT NULL,
  `transaction_id` VARCHAR(255) NULL,
  `status` ENUM('pending', 'succeeded', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`guest_id`) REFERENCES `guest_details`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_payment_owner` CHECK (`user_id` IS NOT NULL OR `guest_id` IS NOT NULL)
) COMMENT='Dedicated table to track all payment transactions.';

-- ---------------------------------
-- 7. Content: Site Media & Reviews
-- ---------------------------------

CREATE TABLE `site_media` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `media_type` ENUM('image', 'video') NOT NULL,
  `url` VARCHAR(1024) NOT NULL,
  `alt_text` VARCHAR(255) NULL,
  `section` VARCHAR(100) NOT NULL,
  `device_version` ENUM('desktop', 'mobile', 'all') NOT NULL DEFAULT 'all',
  `title` VARCHAR(255) NULL,
  `display_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_media_filter` (`section`, `device_version`, `media_type`, `is_active`)
) COMMENT='Manages all site-wide media.';

CREATE TABLE `reviews` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL COMMENT 'User ID for logged-in user reviews, NULL for guest reviews',
  `guest_email` VARCHAR(255) NULL,
  `guest_name` VARCHAR(255) NULL,
  `product_id` INT NULL,
  `service_id` INT NULL,
  `rating` TINYINT NOT NULL,
  `title` VARCHAR(100) NULL,
  `comment` TEXT NULL,
  `is_verified_purchase` TINYINT(1) NOT NULL DEFAULT 0,
  `is_approved` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_review_target` CHECK (`product_id` IS NOT NULL OR `service_id` IS NOT NULL),
  CONSTRAINT `reviews_chk_1` CHECK ((`rating` between 1 and 5)),
  INDEX `idx_guest_email` (`guest_email`)
) COMMENT='Stores user reviews for products and services, including guest reviews.';

-- ---------------------------------
-- 8. Contact & Online Queries
-- ---------------------------------

CREATE TABLE `online_queries` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL COMMENT 'Optional: logged-in user submitting the query/complaint',
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NULL,
  `full_name` VARCHAR(255) NULL,
  `type` ENUM('query', 'complaint') NOT NULL DEFAULT 'query',
  `related_to` ENUM('product', 'service', 'other') NOT NULL DEFAULT 'other',
  `product_id` INT NULL,
  `service_id` INT NULL,
  `subject` VARCHAR(255) NULL,
  `message` TEXT NOT NULL,
  `status` ENUM('new', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'new',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE SET NULL,
  INDEX `idx_online_queries_status` (`status`),
  INDEX `idx_online_queries_created` (`created_at`),
  INDEX `idx_online_queries_email` (`email`)
) COMMENT='Stores online queries and complaints submitted via the contact page.';
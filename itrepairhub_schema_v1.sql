-- Set default engine and character set
SET default_storage_engine=InnoDB;
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS itrepairhub;
USE itrepairhub;

-- ---------------------------------
-- 1. Core: Users, Companies, & Addresses
-- ---------------------------------

CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `phone_number` VARCHAR(50) NULL UNIQUE,
  `password_hash` VARCHAR(255) NULL,
  `auth_provider` ENUM('local', 'google') NOT NULL DEFAULT 'local',
  `provider_id` VARCHAR(255) NULL,
  `role` ENUM('customer', 'business', 'admin', 'technician') NOT NULL DEFAULT 'customer',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_email` (`email`),
  INDEX `idx_provider_id` (`provider_id`),
  INDEX `idx_role` (`role`)
) COMMENT='Central table for all users. Role "technician" is used for bookings.';

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
) COMMENT='Normalized table for storing user addresses.';

-- ---------------------------------
-- 2. Module 1: Service Bookings
-- ---------------------------------

CREATE TABLE `service_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE COMMENT 'For SEO-friendly URLs',
  `seo_title` VARCHAR(255) NULL,
  `meta_description` TEXT NULL,
  INDEX `idx_slug` (`slug`)
) COMMENT='Categories for services (e.g., Mobile, Laptop, Software).';

CREATE TABLE `services` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `category_id` INT NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `image_url` VARCHAR(1024) NULL COMMENT 'Primary image for the service',
  `short_description` TEXT NULL,
  `long_description` TEXT NULL,
  `service_type` ENUM('hardware', 'software') NOT NULL,
  `price_type` ENUM('variable', 'fixed') NOT NULL,
  `price` DECIMAL(10, 2) NULL COMMENT 'Used only if price_type is fixed',
  `warranty_info` VARCHAR(255) NULL COMMENT 'e.g., 30-day service warranty',
  `seo_title` VARCHAR(255) NULL,
  `meta_description` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `section` VARCHAR(100) NULL COMMENT 'e.g., featured_services, homepage' AFTER `is_active`,
  FOREIGN KEY (`category_id`) REFERENCES `service_categories`(`id`) ON DELETE SET NULL,
  INDEX `idx_slug` (`slug`),
  INDEX `idx_section` (`section`)
) COMMENT='Catalog of all repair and software services offered.';

CREATE TABLE `bookings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL COMMENT 'The customer who booked',
  `service_id` INT NOT NULL,
  `address_id` INT NOT NULL COMMENT 'The location for the service',
  `technician_id` INT NULL COMMENT 'The assigned technician (FK to users.id)',
  `booking_date` DATE NOT NULL,
  `booking_time` TIME NOT NULL,
  `status` ENUM('pending', 'confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  `admin_notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`address_id`) REFERENCES `addresses`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`technician_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) COMMENT='Transaction table for service appointments.';

CREATE TABLE `consultations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL COMMENT 'Null if booked by a non-registered guest',
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NULL,
  `type` ENUM('on_site', 'online_meeting') NOT NULL,
  `scheduled_at` DATETIME NOT NULL,
  `status` ENUM('requested', 'scheduled', 'completed') NOT NULL DEFAULT 'requested',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) COMMENT='For free on-site or online consultations.';

-- ---------------------------------
-- 3. Modules 2 & 3: E-Commerce (New & Used)
-- ---------------------------------

CREATE TABLE `product_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `seo_title` VARCHAR(255) NULL,
  `meta_description` TEXT NULL,
  INDEX `idx_slug` (`slug`)
) COMMENT='Categories for products (e.g., Used Market, Laptops, Accessories).';

CREATE TABLE `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `category_id` INT NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `sku` VARCHAR(100) NOT NULL UNIQUE,
  `condition` ENUM('new', 'used') NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `stock_quantity` INT NOT NULL DEFAULT 0,
  `warranty_info` VARCHAR(255) NULL COMMENT 'e.g., 1 Year IT Hub Warranty',
  `specifications` JSON NULL COMMENT 'Flexible specs (RAM, CPU, etc.)',
  `description` TEXT NULL,
  `image_urls` JSON NULL COMMENT 'JSON array of image URLs for gallery',
  `seo_title` VARCHAR(255) NULL,
  `meta_description` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `section` VARCHAR(100) NULL COMMENT 'e.g., featured_products, daily_deal' AFTER `is_active`,
  FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE SET NULL,
  INDEX `idx_slug` (`slug`),
  INDEX `idx_sku` (`sku`),
  INDEX `idx_section` (`section`)
) COMMENT='Catalog for all physical items (new and used).';

-- ---------------------------------
-- 4. Modules 3 & 5: Procurement (Sell-to-Us)
-- ---------------------------------

CREATE TABLE `sell_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `request_type` ENUM('check_price', 'sell_item') NOT NULL COMMENT 'Distinguishes a price check from a sell offer',
  `device_type` VARCHAR(100) NOT NULL,
  `brand` VARCHAR(100) NULL,
  `model` VARCHAR(100) NULL,
  `specifications` JSON NOT NULL COMMENT 'User-submitted specs',
  `condition_notes` TEXT NULL,
  `estimated_price` DECIMAL(10, 2) NULL COMMENT 'Price from your prediction model',
  `final_offer_price` DECIMAL(10, 2) NULL COMMENT 'Manual price offered by your team',
  `status` ENUM('submitted', 'inspection_pending', 'purchased', 'rejected') NOT NULL DEFAULT 'submitted',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) COMMENT='Inbox for users selling items to you or checking prices.';

-- ---------------------------------
-- 5. Module 4 & Payments: PC Builder & Orders
-- ---------------------------------

CREATE TABLE `pc_components` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `type` ENUM('CPU', 'GPU', 'RAM', 'Motherboard', 'Casing', 'PSU', 'Storage') NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `specs` JSON NULL,
  `stock_quantity` INT NOT NULL DEFAULT 0,
  `image_url` VARCHAR(1024) NULL,
  INDEX `idx_type` (`type`)
) COMMENT='Inventory for the PC Builder module.';

CREATE TABLE `custom_pc_builds` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `total_estimated_price` DECIMAL(10, 2) NOT NULL,
  `configuration_data` JSON NOT NULL COMMENT 'JSON array of pc_components.id',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) COMMENT='Saved user PC configurations.';

CREATE TABLE `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `address_id` INT NOT NULL COMMENT 'The shipping address',
  `total_amount` DECIMAL(10, 2) NOT NULL,
  `order_status` ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  `payment_status` ENUM('unpaid', 'paid', 'refunded') NOT NULL DEFAULT 'unpaid',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`address_id`) REFERENCES `addresses`(`id`) ON DELETE RESTRICT,
  INDEX `idx_status` (`order_status`)
) COMMENT='Main table for all product/PC build purchases.';

CREATE TABLE `order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `product_id` INT NULL COMMENT 'FK to products table',
  `custom_build_id` INT NULL COMMENT 'FK to custom_pc_builds table',
  `quantity` INT NOT NULL DEFAULT 1,
  `price_at_purchase` DECIMAL(10, 2) NOT NULL COMMENT 'Locks in the price',
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`custom_build_id`) REFERENCES `custom_pc_builds`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_item` CHECK (`product_id` IS NOT NULL OR `custom_build_id` IS NOT NULL)
) COMMENT='Line items for an order (either a product or a custom PC).';

CREATE TABLE `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `order_id` INT NULL,
  `booking_id` INT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `gateway` ENUM('stripe', 'local_gateway', 'cash') NOT NULL,
  `transaction_id` VARCHAR(255) NULL COMMENT 'ID from the payment gateway',
  `status` ENUM('pending', 'succeeded', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE SET NULL,
  INDEX `idx_transaction_id` (`transaction_id`)
) COMMENT='Dedicated table to track all payment transactions.';

-- ---------------------------------
-- 6. NEW: Site Content & Media
-- ---------------------------------

CREATE TABLE `site_media` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `media_type` ENUM('image', 'video') NOT NULL,
  `url` VARCHAR(1024) NOT NULL COMMENT 'URL to the image or video',
  `alt_text` VARCHAR(255) NULL COMMENT 'Crucial for image SEO',
  `section` VARCHAR(100) NOT NULL COMMENT 'e.g., hero_slider, about_video',
  `device_version` ENUM('desktop', 'mobile', 'all') NOT NULL DEFAULT 'all' COMMENT 'Specifies if media is for desktop, mobile, or all devices',
  `title` VARCHAR(255) NULL COMMENT 'Internal reference title',
  `display_order` INT NOT NULL DEFAULT 0 COMMENT 'For sorting items in a carousel',
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- NEW, more comprehensive index for filtering
  INDEX `idx_media_filter` (`section`, `device_version`, `media_type`, `is_active`)
) COMMENT='Manages all site-wide media like hero images and videos.';
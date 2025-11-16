# Postman Guide: Upload Hero Section Images

This guide shows you how to upload media (images/videos) to the hero section using Postman.

## Prerequisites

1. You need an **admin account** in the database
2. Postman installed
3. Backend server running on `http://localhost:4000`

## Step 1: Create Admin User (if not exists)

If you don't have an admin user, you can create one directly in MySQL:

```sql
INSERT INTO users (full_name, email, password_hash, role, auth_provider) 
VALUES (
  'Admin User', 
  'admin@itrepairhub.com', 
  '$2a$10$YourHashedPasswordHere',  -- Use bcrypt to hash your password
  'admin', 
  'local'
);
```

Or register a user first, then update their role:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

## Step 2: Login to Get JWT Token

### Request Setup:
- **Method**: `POST`
- **URL**: `http://localhost:4000/v1/auth/login`
- **Headers**:
  ```
  Content-Type: application/json
  ```
- **Body** (raw JSON):
  ```json
  {
    "email": "admin@itrepairhub.com",
    "password": "your-password"
  }
  ```

### Response:
You'll get a response like:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "full_name": "Admin User",
      "email": "admin@itrepairhub.com",
      "role": "admin"
    }
  }
}
```

**Copy the `token` value** - you'll need it for the next step.

## Step 3: Upload Hero Section Image

### Request Setup:
- **Method**: `POST`
- **URL**: `http://localhost:4000/v1/media`
- **Headers**:
  ```
  Content-Type: application/json
  Authorization: Bearer YOUR_JWT_TOKEN_HERE
  ```
  Replace `YOUR_JWT_TOKEN_HERE` with the token from Step 2.

- **Body** (raw JSON):
  ```json
  {
    "media_type": "image",
    "url": "https://utfs.io/f/your-uploadthing-file-url",
    "alt_text": "Hero image showing IT repair services",
    "section": "hero_slider",
    "title": "Hero Image 1",
    "display_order": 1,
    "is_active": true
  }
  ```

### Field Descriptions:
- `media_type`: `"image"` or `"video"` (required)
- `url`: The UploadThing file URL (required)
  - For now, you can use any image URL for testing
  - Later, upload via UploadThing frontend and use that URL
- `alt_text`: SEO-friendly alt text for images (required for images)
- `section`: `"hero_slider"` for hero section (required)
- `title`: Internal reference title (optional)
- `display_order`: Order in which images appear (0, 1, 2, etc.)
- `is_active`: `true` to show, `false` to hide

### Example for Multiple Hero Images:

**Image 1:**
```json
{
  "media_type": "image",
  "url": "https://example.com/hero1.jpg",
  "alt_text": "Expert IT repair services at your location",
  "section": "hero_slider",
  "title": "Hero Image 1",
  "display_order": 1,
  "is_active": true
}
```

**Image 2:**
```json
{
  "media_type": "image",
  "url": "https://example.com/hero2.jpg",
  "alt_text": "Custom PC building and configuration",
  "section": "hero_slider",
  "title": "Hero Image 2",
  "display_order": 2,
  "is_active": true
}
```

## Step 4: Verify Upload

### Get All Hero Section Images:
- **Method**: `GET`
- **URL**: `http://localhost:4000/v1/media/section/hero_slider?is_active=true`
- **Headers**: None required (public endpoint)

### Get Single Media:
- **Method**: `GET`
- **URL**: `http://localhost:4000/v1/media/1`
- **Headers**: None required

## Step 5: Update Media (Optional)

- **Method**: `PUT`
- **URL**: `http://localhost:4000/v1/media/1` (replace 1 with media ID)
- **Headers**:
  ```
  Content-Type: application/json
  Authorization: Bearer YOUR_JWT_TOKEN_HERE
  ```
- **Body** (raw JSON):
  ```json
  {
    "alt_text": "Updated alt text",
    "display_order": 0,
    "is_active": true
  }
  ```

## Step 6: Delete Media (Optional)

- **Method**: `DELETE`
- **URL**: `http://localhost:4000/v1/media/1` (replace 1 with media ID)
- **Headers**:
  ```
  Authorization: Bearer YOUR_JWT_TOKEN_HERE
  ```

## Quick Test with Sample Image URL

For testing, you can use a sample image URL:

```json
{
  "media_type": "image",
  "url": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920",
  "alt_text": "IT repair and computer services",
  "section": "hero_slider",
  "title": "Test Hero Image",
  "display_order": 1,
  "is_active": true
}
```

## Common Sections

- `hero_slider` - Hero section carousel images
- `about_video` - About page video
- `service_images` - Service category images
- `product_images` - Product images
- `category_images` - Category images
- `general` - General media

## Troubleshooting

### 401 Unauthorized
- Check that your JWT token is valid and not expired
- Make sure you're using `Bearer ` prefix in Authorization header

### 403 Forbidden
- Your user must have `role: "admin"` in the database
- Check user role: `SELECT id, email, role FROM users WHERE email = 'your-email@example.com';`

### 400 Bad Request
- Check that all required fields are present
- `alt_text` is required for images
- `media_type` must be `"image"` or `"video"`
- `section` must be a valid section name

### 500 Server Error
- Check server logs for detailed error
- Verify database connection
- Check that `site_media` table exists


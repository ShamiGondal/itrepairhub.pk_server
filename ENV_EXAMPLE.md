# Environment Variables

Add these to your `.env` file in the `server` directory:

## Database Configuration
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=itrepairhub
DB_POOL_LIMIT=10
```

## Server Configuration
```
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

## JWT Configuration
```
JWT_SECRET=itrepairhub.pk
```

## UploadThing Configuration
```
UPLOADTHING_SECRET=your_uploadthing_secret_key_here
UPLOADTHING_TOKEN=your_uploadthing_token_here
UPLOADTHING_APP_ID=your_uploadthing_app_id_here
```

## Google OAuth (Optional)
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/v1/auth/google/callback
```


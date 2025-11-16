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
UPLOADTHING_SECRET=sk_live_be660b67bc1e2790eadc6483871415010c7821297bf33ba29af663afb376ff90
UPLOADTHING_TOKEN=eyJhcGlLZXkiOiJza19saXZlX2JlNjYwYjY3YmMxZTI3OTBlYWRjNjQ4Mzg3MTQxNTAxMGM3ODIxMjk3YmYzM2JhMjlhZjY2M2FmYjM3NmZmOTAiLCJhcHBJZCI6Inp4eWU1YW85dnQiLCJyZWdpb25zIjpbInNlYTEiXX0=
UPLOADTHING_APP_ID=zxye5ao9vt
```

## Google OAuth (Optional)
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/v1/auth/google/callback
```


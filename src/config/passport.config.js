import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { getDb } from './db.config.js';

export function configurePassport() {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL,
  } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_CALLBACK_URL) {
    // Google auth is optional; skip configuration if env vars are missing
    return passport;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const db = getDb();
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
          const fullName = profile.displayName || '';

          // Find existing google user or create one
          const [rows] = await db.query(
            'SELECT id, full_name, email, role FROM users WHERE auth_provider = ? AND provider_id = ? LIMIT 1',
            ['google', profile.id]
          );

          let user;
          if (rows.length > 0) {
            user = rows[0];
          } else {
            const [result] = await db.query(
              'INSERT INTO users (full_name, email, auth_provider, provider_id) VALUES (?, ?, ?, ?)',
              [fullName, email, 'google', profile.id]
            );

            user = {
              id: result.insertId,
              full_name: fullName,
              email,
              role: 'customer',
            };
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  return passport;
}



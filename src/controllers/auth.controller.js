import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../config/db.config.js';

const JWT_EXPIRES_IN = '7d';

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT secret not configured');
  }

  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      full_name: user.full_name,
      email: user.email,
    },
    secret,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export async function register(req, res) {
  try {
    const { full_name, email, password, phone_number } = req.body;
    if (!full_name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'full_name, email, and password are required' });
    }

    const db = getDb();

    // Check if user already exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO users (full_name, email, phone_number, password_hash, auth_provider, role) VALUES (?, ?, ?, ?, ?, ?)',
      [full_name, email, phone_number || null, passwordHash, 'local', 'customer']
    );

    const user = {
      id: result.insertId,
      full_name,
      email,
      role: 'customer',
    };

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Registration failed' });
  }
}

/**
 * B2B Registration - Creates user and company
 * SEO-optimized: Fast transaction-based insert
 */
export async function registerB2B(req, res) {
  try {
    const { full_name, email, password, phone_number, company_name, tax_id } = req.body;

    // Validation
    if (!full_name || !email || !password || !company_name || !tax_id) {
      return res.status(400).json({
        success: false,
        message: 'full_name, email, password, company_name, and tax_id (NTN) are required',
      });
    }

    const db = getDb();

    // Check if user already exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    // Check if company with same tax_id exists
    const [existingCompany] = await db.query('SELECT id FROM companies WHERE tax_id = ? LIMIT 1', [tax_id]);
    if (existingCompany.length > 0) {
      return res.status(409).json({ success: false, message: 'Company with this NTN number already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Use transaction to ensure both user and company are created together
    await db.query('START TRANSACTION');

    try {
      // Create user with 'business' role for B2B accounts
      const [userResult] = await db.query(
        'INSERT INTO users (full_name, email, phone_number, password_hash, auth_provider, role) VALUES (?, ?, ?, ?, ?, ?)',
        [full_name, email, phone_number || null, passwordHash, 'local', 'business']
      );

      const userId = userResult.insertId;

      // Create company with user as contact person
      const [companyResult] = await db.query(
        'INSERT INTO companies (company_name, contact_person_id, tax_id, contract_status) VALUES (?, ?, ?, ?)',
        [company_name, userId, tax_id, 'active']
      );

      await db.query('COMMIT');

      const user = {
        id: userId,
        full_name,
        email,
        role: 'business',
      };

      const token = signToken(user);

      return res.status(201).json({
        success: true,
        data: {
          user,
          token,
          company: {
            id: companyResult.insertId,
            company_name,
            tax_id,
          },
        },
        message: 'B2B account created successfully',
      });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Email or NTN number already in use' });
    }
    return res.status(500).json({ success: false, message: 'B2B registration failed' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    const db = getDb();

    // Execute database query with error handling
    let rows;
    try {
      [rows] = await db.query(
        'SELECT id, full_name, email, password_hash, role, auth_provider FROM users WHERE email = ? LIMIT 1',
        [email]
      );
    } catch (dbError) {
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection error. Please check if MySQL is running and configured correctly.' 
      });
    }

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const userRow = rows[0];

    if (userRow.auth_provider !== 'local') {
      return res.status(400).json({
        success: false,
        message: `Please log in using ${userRow.auth_provider}`,
      });
    }

    const isMatch = await bcrypt.compare(password, userRow.password_hash || '');
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = {
      id: userRow.id,
      full_name: userRow.full_name,
      email: userRow.email,
      role: userRow.role,
    };

    const token = signToken(user);

    return res.status(200).json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (err) {
    if (err.message && err.message.includes('timeout')) {
      return res.status(503).json({ success: false, message: 'Database connection timeout. Please check if MySQL is running.' });
    }
    return res.status(500).json({ 
      success: false, 
      message: 'Login failed',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined
    });
  }
}

// Called after successful passport Google auth
export function googleCallbackHandler(req, res) {
  try {
    const user = req.user;
    const token = signToken(user);

    const redirectBase = process.env.GOOGLE_SUCCESS_REDIRECT || 'http://localhost:3000/auth/success';
    const redirectUrl = `${redirectBase}?token=${encodeURIComponent(token)}`;

    return res.redirect(302, redirectUrl);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Google auth failed' });
  }
}

// Handle Google Identity Services credential token (new method)
export async function googleCredentialAuth(req, res) {
  try {
    const { credential, email, name, sub, picture, isRegisterPage, isB2B, company_name, tax_id, phone_number } = req.body;

    // For B2B without credential (second step), email and sub are required
    // For regular flow, credential is required
    if (!isB2B && !credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required',
      });
    }

    if (!email || !sub) {
      return res.status(400).json({
        success: false,
        message: 'Email and sub are required',
      });
    }

    const db = getDb();

    // PRIORITY: Handle B2B registration with company details (second step of B2B flow)
    // This happens when user has authenticated with Google and is now submitting company details
    // We MUST create user first, then company, in a transaction
    // IMPORTANT: This check must come FIRST before any login checks to prevent "No account found" error
    // Check for B2B registration with all required fields
    // Handle both boolean true and string "true" for isB2B
    const isB2BFlag = isB2B === true || isB2B === 'true' || isB2B === 1;
    const isRegisterFlag = isRegisterPage === true || isRegisterPage === 'true' || isRegisterPage === 1;
    const hasCompanyName = company_name && String(company_name).trim() !== '';
    const hasTaxId = tax_id && String(tax_id).trim() !== '';
    
    const isB2BRegistration = isB2BFlag && hasCompanyName && hasTaxId && isRegisterFlag;

    if (isB2BRegistration) {
      // Check if company with same tax_id exists
      const [existingCompany] = await db.query('SELECT id FROM companies WHERE tax_id = ? LIMIT 1', [tax_id]);
      if (existingCompany.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Company with this NTN number already exists',
        });
      }

      // Check if user already exists with this Google provider_id (user might have completed registration already)
      const [existingByProvider] = await db.query(
        'SELECT id, full_name, email, role, auth_provider FROM users WHERE provider_id = ? AND auth_provider = ? LIMIT 1',
        [sub, 'google']
      );

      if (existingByProvider.length > 0) {
        // User already exists, just log them in
        const user = {
          id: existingByProvider[0].id,
          full_name: existingByProvider[0].full_name,
          email: existingByProvider[0].email,
          role: existingByProvider[0].role,
        };
        const token = signToken(user);
        return res.status(200).json({
          success: true,
          data: { user, token },
          message: 'Successfully signed in with Google',
        });
      }

      // Check if user exists with same email but different auth provider
      const [existingByEmail] = await db.query(
        'SELECT id, full_name, email, role, auth_provider, provider_id FROM users WHERE email = ? LIMIT 1',
        [email]
      );

      if (existingByEmail.length > 0) {
        const existingUser = existingByEmail[0];
        // If user exists with local auth, we can link Google account
        if (existingUser.auth_provider === 'local') {
          // Update user to link Google account
          await db.query(
            'UPDATE users SET auth_provider = ?, provider_id = ? WHERE id = ?',
            ['google', sub, existingUser.id]
          );
          const user = {
            id: existingUser.id,
            full_name: existingUser.full_name,
            email: existingUser.email,
            role: existingUser.role,
          };
          const token = signToken(user);
          return res.status(200).json({
            success: true,
            data: { user, token },
            message: 'Your account has been linked with Google',
            accountLinked: true,
          });
        }
        // If email exists with different Google account, return error
        if (existingUser.auth_provider === 'google' && existingUser.provider_id !== sub) {
          return res.status(409).json({
            success: false,
            message: 'This email is already associated with a different Google account.',
          });
        }
      }

      // NEW USER: Create user first, then company (in transaction)
      // This is the key fix - we create the user immediately without checking login flow
      // No user exists, so we proceed directly to create user + company
      await db.query('START TRANSACTION');

      try {
        // Step 1: Create user FIRST (this is critical - user must exist before company)
        const [userResult] = await db.query(
          'INSERT INTO users (full_name, email, phone_number, auth_provider, provider_id, role) VALUES (?, ?, ?, ?, ?, ?)',
          [name || email.split('@')[0], email, phone_number || null, 'google', sub, 'business']
        );

        const userId = userResult.insertId;

        // Step 2: Create company with the newly created user's ID (foreign key relationship)
        const [companyResult] = await db.query(
          'INSERT INTO companies (company_name, contact_person_id, tax_id, contract_status) VALUES (?, ?, ?, ?)',
          [company_name, userId, tax_id, 'active']
        );

        await db.query('COMMIT');

        const user = {
          id: userId,
          full_name: name || email.split('@')[0],
          email,
          role: 'business',
        };

        const token = signToken(user);

        return res.status(201).json({
          success: true,
          data: {
            user,
            token,
            company: {
              id: companyResult.insertId,
              company_name,
              tax_id,
            },
          },
          message: 'B2B account created successfully with Google',
        });
      } catch (err) {
        await db.query('ROLLBACK');
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({
            success: false,
            message: 'Email or NTN number already in use',
          });
        }
        // Re-throw to be caught by outer catch
        throw err;
      }
    }

    // If B2B but missing company details, return special response (first step of B2B flow)
    if (isB2BFlag && (!hasCompanyName || !hasTaxId)) {
      // First, check if user exists with this Google provider_id
      const [existingByProvider] = await db.query(
        'SELECT id, full_name, email, role, auth_provider FROM users WHERE provider_id = ? AND auth_provider = ? LIMIT 1',
        [sub, 'google']
      );

      if (existingByProvider.length > 0) {
        // User already exists, log them in
        const user = {
          id: existingByProvider[0].id,
          full_name: existingByProvider[0].full_name,
          email: existingByProvider[0].email,
          role: existingByProvider[0].role,
        };
        const token = signToken(user);
        return res.status(200).json({
          success: true,
          data: { user, token },
          message: 'Successfully signed in with Google',
        });
      }

      // Check if email exists
      const [existingByEmail] = await db.query(
        'SELECT id, full_name, email, role, auth_provider, provider_id FROM users WHERE email = ? LIMIT 1',
        [email]
      );

      if (existingByEmail.length > 0) {
        const existingUser = existingByEmail[0];
        // If user exists with local auth, link Google account
        if (existingUser.auth_provider === 'local') {
          await db.query(
            'UPDATE users SET auth_provider = ?, provider_id = ? WHERE id = ?',
            ['google', sub, existingUser.id]
          );
          const user = {
            id: existingUser.id,
            full_name: existingUser.full_name,
            email: existingUser.email,
            role: existingUser.role,
          };
          const token = signToken(user);
          return res.status(200).json({
            success: true,
            data: { user, token },
            message: 'Your account has been linked with Google',
            accountLinked: true,
          });
        }
        // If email exists but with different Google account, return error
        if (existingUser.auth_provider === 'google' && existingUser.provider_id !== sub) {
          return res.status(409).json({
            success: false,
            message: 'This email is already associated with a different Google account.',
          });
        }
      }

      // New user for B2B - return company details form
      return res.status(200).json({
        success: true,
        requiresCompanyDetails: true,
        googleData: {
          email,
          name: name || email.split('@')[0],
          sub,
          picture,
        },
        message: 'Please provide company details to complete B2B registration',
      });
    }

    // Regular Google auth flow (non-B2B)
    // First, check if user exists with this Google provider_id
    const [existingByProvider] = await db.query(
      'SELECT id, full_name, email, role, auth_provider FROM users WHERE provider_id = ? AND auth_provider = ? LIMIT 1',
      [sub, 'google']
    );

    if (existingByProvider.length > 0) {
      // User already has Google account linked, log them in
      const user = {
        id: existingByProvider[0].id,
        full_name: existingByProvider[0].full_name,
        email: existingByProvider[0].email,
        role: existingByProvider[0].role,
      };

      const token = signToken(user);

      return res.status(200).json({
        success: true,
        data: {
          user,
          token,
        },
        message: 'Successfully signed in with Google',
      });
    }

    // Check if email exists with any auth provider
    const [existingByEmail] = await db.query(
      'SELECT id, full_name, email, role, auth_provider, provider_id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (existingByEmail.length > 0) {
      const existingUser = existingByEmail[0];

      // If user exists with local auth, link Google account
      if (existingUser.auth_provider === 'local') {
        // Update user to link Google account
        await db.query(
          'UPDATE users SET auth_provider = ?, provider_id = ? WHERE id = ?',
          ['google', sub, existingUser.id]
        );

        const user = {
          id: existingUser.id,
          full_name: existingUser.full_name,
          email: existingUser.email,
          role: existingUser.role,
        };

        const token = signToken(user);

        return res.status(200).json({
          success: true,
          data: {
            user,
            token,
          },
          message: 'Your account has been linked with Google',
          accountLinked: true,
        });
      }

      // If email exists but with different Google account, return error
      if (existingUser.auth_provider === 'google' && existingUser.provider_id !== sub) {
        return res.status(409).json({
          success: false,
          message: 'This email is already associated with a different Google account.',
        });
      }
    }

    // If no user found and trying to sign in (not register), require registration
    // BUT: Skip this check if it's a B2B registration (should have been handled above)
    if (!isRegisterFlag && existingByEmail.length === 0 && !isB2BFlag) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email. Please register first.',
        requiresRegistration: true,
      });
    }
    
    // Additional safety check: If B2B registration somehow reached here, return error
    if (isB2BFlag && hasCompanyName && hasTaxId) {
      return res.status(400).json({
        success: false,
        message: 'B2B registration processing error. Please try again.',
      });
    }

    // Regular Google registration (non-B2B)
    // Create new user (only if on register page or if explicitly allowed)
    if (isRegisterPage || existingByEmail.length === 0) {
      const [result] = await db.query(
        'INSERT INTO users (full_name, email, auth_provider, provider_id, role) VALUES (?, ?, ?, ?, ?)',
        [name || email.split('@')[0], email, 'google', sub, 'customer']
      );

      const user = {
        id: result.insertId,
        full_name: name || email.split('@')[0],
        email,
        role: 'customer',
      };

      const token = signToken(user);

      return res.status(200).json({
        success: true,
        data: {
          user,
          token,
        },
        message: 'Account created successfully with Google',
      });
    }

    // Fallback error
    return res.status(400).json({
      success: false,
      message: 'Unable to process Google authentication',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Google authentication failed' });
  }
  
}



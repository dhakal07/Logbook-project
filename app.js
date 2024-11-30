import { Hono } from "https://deno.land/x/hono/mod.ts";
import client from "./db/db.js";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts"; // For password hashing

const app = new Hono();

// Handle user login (form submission)
app.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const { username, password } = body;

  try {
    // Fetch the user from the database
    const result = await client.queryArray(
      `SELECT user_id, username, password_hash FROM public.abc123_users WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      // User not found
      return c.text('Invalid username or password', 401);
    }

    const user = result.rows[0];
    const storedPasswordHash = user[2];

    // Compare the provided password with the stored password hash
    const isPasswordValid = await bcrypt.compare(password, storedPasswordHash);

    if (!isPasswordValid) {
      // Invalid password
      return c.text('Invalid username or password', 401);
    }

    // Capture the IP address and user agent from the request
    const ipAddress = c.req.ip;
    const userAgent = c.req.userAgent;

    // Log the successful login into the database
    await client.queryArray(
      `INSERT INTO public.abc123_login_logs (user_id, login_time, ip_address, activity_type, user_agent)
       VALUES ($1, CURRENT_TIMESTAMP, $2, 'login', $3)`,
      [user[0], ipAddress, userAgent]
    );

    // Log the successful login in the server console (for debugging)
    console.log(`Login: ${user[1]} at ${new Date().toISOString()} from IP: ${ipAddress}`);

    // Redirect to index page after successful login
    return c.redirect('/');
  } catch (error) {
    console.error(error);
    return c.text('Error during login', 500);
  }
});

// Middleware to add the CSP header
app.use('*', async (c, next) => {
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; " +
    "frame-ancestors 'none'; form-action 'self';"
  );
  await next();
});

// Serve static files (CSS)
app.use('/static/*', async (c) => {
  const file = await Deno.readTextFile(`.${c.req.path}`);
  return c.html(file);
});

// Serve the index page
app.get('/', async (c) => {
  return c.html(await Deno.readTextFile('./views/index.html'));
});

// Serve the registration form
app.get('/register', async (c) => {
  return c.html(await Deno.readTextFile('./views/register.html'));
});

// Serve the login form
app.get('/login', async (c) => {
  return c.html(await Deno.readTextFile('./views/login.html'));
});

// Handle user registration (form submission)
app.post('/register', async (c) => {
  const body = await c.req.parseBody();
  const { username, password, birthdate, role, email, phone_number, age, consent_given } = body;

  try {
    // Hash the user's password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert the new user into the database
    await client.queryArray(
      `INSERT INTO public.abc123_users (username, password_hash, role, email, phone_number, age, consent_given, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [username, hashedPassword, role, email, phone_number || null, age || null, consent_given === "on"]
    );

    // Redirect to index page after successful registration
    return c.redirect('/');
  } catch (error) {
    console.error(error);
    return c.text('Error during registration', 500);
  }
});

// Close the database connection when stopping the app
app.on("stop", async () => {
  await client.end();
});

// Start the application
Deno.serve(app.fetch);

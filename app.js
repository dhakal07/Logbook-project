import { Hono } from "https://deno.land/x/hono/mod.ts";
import client from "./db/db.js";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts"; // For password hashing
import { createSession, getSession, destroySession } from './sessionService.js';

const app = new Hono();

// Middleware for checking if the user is logged in
async function ensureLoggedIn(c, next) {
  console.log("Request object:", c.req); // Log the entire request object
  console.log("Request headers:", c.req.headers); // Log headers for debugging

  const session = await getSession(c);
  console.log("Session data:", session); // Add this line to debug the session data

  if (!session) {
    return c.redirect('/login');
  }
  return next();
}

// Middleware for checking if the user is an administrator
async function ensureAdmin(c, next) {
  console.log("Request object:", c.req); // Log the entire request object
  console.log("Request headers:", c.req.headers); // Log headers for debugging

  const session = await getSession(c);
  console.log("Session data:", session); // Add this line to debug the session data

  if (!session || session.role !== 'administrator') {
    return c.text('Access denied. Admins only.', 403);
  }
  return next();
}

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
  const { username, password, role, email, phone_number, age, consent_given } = body;

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
    console.error("Error during registration:", error);
    return c.text('Error during registration', 500);
  }
});

// Handle user login (form submission)
app.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const { username, password } = body;

  try {
    // Fetch the user from the database
    const result = await client.queryArray(
      `SELECT user_id, username, password_hash, role, age FROM public.abc123_users WHERE username = $1`,
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

    // Create session with user details
    await createSession(c, { userId: user[0], username: user[1], role: user[3], age: user[4] });

    // Redirect to index page after successful login
    return c.redirect('/');
  } catch (error) {
    console.error("Error during login:", error);
    return c.text('Error during login', 500);
  }
});

// Handle user logout
app.get('/logout', async (c) => {
  await destroySession(c);
  return c.redirect('/');
});

// Serve resources page for users (only if logged in)
app.get('/resources', ensureLoggedIn, async (c) => {
  const result = await client.queryArray(`SELECT * FROM public.abc123_resources`);
  return c.json(result.rows);
});

// Allow administrators to add resources (admin only)
app.get('/add-resource', ensureAdmin, async (c) => {
  return c.html(await Deno.readTextFile('./views/add-resource.html'));
});

app.post('/add-resource', ensureAdmin, async (c) => {
  try {
    const body = await c.req.parseBody();
    const { resource_name, description } = body; // Only include required fields

    console.log("Received form data:", body); // Log form data for debugging

    // Validation check
    if (!resource_name || !description) {
      return c.text('All fields are required', 400);
    }

    // Insert the new resource into the database
    await client.queryArray(
      `INSERT INTO public.abc123_resources (resource_name, description, created_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)`,
      [resource_name, description]
    );

    console.log('Resource added successfully');
    return c.redirect('/'); // Redirect after adding resource
  } catch (error) {
    console.error('Error adding resource:', error);
    return c.text('Error adding resource', 500);
  }
});

// Serve the reservation form
app.get('/add-reservation', ensureAdmin, async (c) => {
  return c.html(await Deno.readTextFile('./views/add-reservation.html'));
});

// Handle reservation creation (form submission)
app.post('/add-reservation', ensureLoggedIn, async (c) => { // Allow both reservers and admins to make reservations
  try {
    const body = await c.req.parseBody();
    const { resource_id, start_time, end_time, purpose } = body;
    const session = await getSession(c);

    console.log("Received reservation data:", body); // Log reservation data for debugging

    // Validation check
    if (!resource_id || !start_time || !end_time || !purpose) {
      return c.text('All fields are required', 400);
    }

    // Age validation
    if (session.age <= 15) {
      return c.text('Only users over 15 years old can book a resource.', 403);
    }

    // Insert the new reservation into the database
    await client.queryArray(
      `INSERT INTO public.abc123_reservations (resource_id, start_time, end_time, purpose, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [resource_id, start_time, end_time, purpose]
    );

    console.log('Reservation added successfully');
    return c.redirect('/'); // Redirect after adding reservation
  } catch (error) {
    console.error('Error adding reservation:', error);
    console.error("Error details:", error.message); // Log specific error message
    return c.text('Error adding reservation', 500);
  }
});

// Serve booked resources without logging in, but hide reserver's identity
app.get('/view-reservations', async (c) => {
  try {
    const result = await client.queryArray(
      `SELECT resource_id, start_time, end_time, purpose FROM public.abc123_reservations`
    );

    console.log("Retrieved reservations:", result.rows); // Log retrieved reservations

    return c.json(result.rows); // Return reservations without reserver's identity
  } catch (error) {
    console.error('Error retrieving reservations:', error);
    return c.text('Error retrieving reservations', 500);
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

// Close the database connection when stopping the app
app.on("stop", async () => {
  await client.end();
});

// Start the application
Deno.serve(app.fetch);



import { Hono } from "https://deno.land/x/hono/mod.ts";
import client from "./db/db.js";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import { createSession, getSession, destroySession } from './sessionService.js';

const app = new Hono();

// Middleware for checking if the user is logged in
async function ensureLoggedIn(c, next) {
  const session = await getSession(c);
  if (!session) {
    return c.redirect('/login');
  }
  return next();
}

// Middleware for checking if the user is an administrator
async function ensureAdmin(c, next) {
  const session = await getSession(c);
  if (!session || session.role !== 'administrator') {
    return c.text('Access denied. Admins only.', 403);
  }
  return next();
}

// Security headers middleware
app.use('*', async (c, next) => {
  c.header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self';");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Content-Type-Options", "nosniff");
  try {
    await next();
  } catch (error) {
    console.error('Internal server error:', error);
    return c.text('An error occurred. Please try again later.', 500);
  }
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

// Serve the privacy policy page
app.get('/privacy', async (c) => {
  return c.html(await Deno.readTextFile('./views/privacy.html'));
});

// Serve the terms of service page
app.get('/terms', async (c) => {
  return c.html(await Deno.readTextFile('./views/terms.html'));
});

// Serve the account page
app.get('/account', ensureLoggedIn, async (c) => {
  const session = await getSession(c);
  const userInfo = { username: session.username, email: session.email };
  const accountPageContent = await Deno.readTextFile('./views/account.html');
  const content = accountPageContent
    .replace('<!-- insert username here -->', userInfo.username)
    .replace('<!-- insert email here -->', userInfo.email);
  return c.html(content);
});

// Handle user registration (form submission)
app.post('/register', async (c) => {
  const body = await c.req.parseBody();
  const { username, password, role, email, phone_number, age, consent_given, accept_tos } = body;
  if (!accept_tos) {
    return c.text('You must accept the terms of service to register.', 400);
  }
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    await client.queryArray(
      `INSERT INTO public.abc123_users (username, password_hash, role, email, phone_number, age, consent_given, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [username, hashedPassword, role, email, phone_number || null, age || null, consent_given === "on"]
    );
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
    const result = await client.queryArray(
      `SELECT user_id, username, password_hash, role, age FROM public.abc123_users WHERE username = $1`,
      [username]
    );
    if (result.rows.length === 0) {
      return c.text('Invalid username or password', 401);
    }
    const user = result.rows[0];
    const storedPasswordHash = user[2];
    const isPasswordValid = await bcrypt.compare(password, storedPasswordHash);
    if (!isPasswordValid) {
      return c.text('Invalid username or password', 401);
    }
    await createSession(c, { userId: user[0], username: user[1], role: user[3], age: user[4] });
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

// Serve the add resource form (admin only)
app.get('/add-resource', ensureAdmin, async (c) => {
  return c.html(await Deno.readTextFile('./views/add-resource.html'));
});

// Handle add resource (admin only)
app.post('/add-resource', ensureAdmin, async (c) => {
  try {
    const body = await c.req.parseBody();
    const { resource_name, description } = body;
    if (!resource_name || !description) {
      return c.text('All fields are required', 400);
    }
    await client.queryArray(
      `INSERT INTO public.abc123_resources (resource_name, description, created_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)`,
      [resource_name, description]
    );
    return c.redirect('/');
  } catch (error) {
    console.error('Error adding resource:', error);
    return c.text('Error adding resource', 500);
  }
});

// Serve the add reservation form (logged in users)
app.get('/add-reservation', ensureLoggedIn, async (c) => {
  return c.html(await Deno.readTextFile('./views/add-reservation.html'));
});

// Handle reservation creation (form submission)
app.post('/add-reservation', ensureLoggedIn, async (c) => {
  try {
    const body = await c.req.parseBody();
    const { resource_id, start_time, end_time, purpose } = body;
    const session = await getSession(c);
    if (!resource_id || !start_time || !end_time || !purpose) {
      return c.text('All fields are required', 400);
    }
    if (session.age <= 15) {
      return c.text('Only users over 15 years old can book a resource.', 403);
    }
    await client.queryArray(
      `INSERT INTO public.abc123_reservations (resource_id, start_time, end_time, purpose, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [resource_id, start_time, end_time, purpose]
    );
    return c.redirect('/');
  } catch (error) {
    console.error('Error adding reservation:', error);
    return c.text('Error adding reservation', 500);
  }
});

// Serve the view reservations page
app.get('/view-reservations', ensureLoggedIn, async (c) => {
  return c.html(await Deno.readTextFile('./views/view-reservations.html'));
});

// Fetch reservation data (AJAX)
app.get('/api/reservations', ensureLoggedIn, async (c) => {
  try {
    const result = await client.queryArray(
      `SELECT resource_id, start_time, end_time, purpose FROM public.abc123_reservations`
    );
    return c.json(result.rows);
  } catch (error) {
    console.error('Error retrieving reservations:', error);
    return c.text('Error retrieving reservations', 500);
  }
});

// Fetch user role (example endpoint)
app.get('/api/user-role', ensureLoggedIn, async (c) => {
  const session = await getSession(c);
  return c.json({ role: session.role });
});

// Serve view resources page
app.get('/view-resources', ensureLoggedIn, async (c) => {
  const resources = await client.queryArray(`SELECT * FROM public.abc123_resources`);
  let html = '<h1>All Resources</h1><ul>';
  for (const resource of resources.rows) {
    html += `<li>${resource[1]}: ${resource[2]}</li>`; // assuming columns are (id, resource_name, description)
  }
  html += '</ul>';
  return c.html(html);
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

// Serve static files (CSS and JS)
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

//docker exec -it booking_system_db psql -U postgres -d postgres
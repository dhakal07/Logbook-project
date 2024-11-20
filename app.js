import { Hono } from "https://deno.land/x/hono/mod.ts";
import client from "./db/db.js";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts"; // For password hashing

const app = new Hono();

// Middleware to add the CSP header
app.use('*', async (c, next) => {
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self';"
  );
  await next();
});

// Serve the registration form
app.get('/register', async (c) => {
  return c.html(await Deno.readTextFile('./views/register.html'));
});

// Handle user registration (form submission)
app.post('/register', async (c) => {
  const body = await c.req.parseBody();

  const username = body.username;
  const password = body.password;
  const birthdate = body.birthdate;
  const role = body.role;
  const email = body.email;
  const phone_number = body.phone_number || null; // Optional
  const age = body.age || null; // Optional
  const consent_given = body.consent_given === "on"; // Checkbox is "on" if checked

  try {
    // Hash the user's password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert the new user into the database
    const result = await client.queryArray(
      `INSERT INTO public.abc123_users (username, password_hash, role, email, phone_number, age, consent_given, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [username, hashedPassword, role, email, phone_number, age, consent_given]
    );

    // Success response
    return c.text('User registered successfully!');
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
Deno.serve({ hostname: "localhost", port: 8000 }, app.fetch);

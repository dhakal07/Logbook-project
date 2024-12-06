const sessionStore = new Map();
const SESSION_EXPIRATION_TIME = 30 * 60 * 1000; // 30 minutes

export function createSession(c, user) {
  const sessionId = generateUniqueId();
  const sessionData = {
    userId: user.userId || null,
    username: user.username || 'guest',
    role: user.role || 'reserver',
    createdAt: Date.now(),
  };

  console.log("Creating session with data:", sessionData);
  sessionStore.set(sessionId, sessionData);

  // Set the session ID as a cookie correctly
  c.header('Set-Cookie', `session_id=${sessionId}; HttpOnly; Max-Age=${SESSION_EXPIRATION_TIME / 1000}`);
  return sessionId;
}

export function getSession(c) {
  if (!c.req || !c.req.raw || !c.req.raw.headers) {
    console.log("Request headers are missing.");
    return null;
  }

  const cookies = c.req.raw.headers.get("Cookie") || "";
  const sessionId = getCookieValue(cookies, "session_id");

  if (!sessionId) {
    console.log("No session_id cookie found in request.");
    return null;
  }

  const sessionData = sessionStore.get(sessionId);
  if (!sessionData) {
    console.log("Session ID not found in session store.");
    return null;
  }

  if (Date.now() - sessionData.createdAt >= SESSION_EXPIRATION_TIME) {
    console.log("Session expired. Deleting session:", sessionId);
    sessionStore.delete(sessionId);
    return null;
  }

  console.log("Retrieved session:", sessionData);
  return sessionData;
}

export function destroySession(c) {
  if (!c.req || !c.req.raw || !c.req.raw.headers) {
    console.log("Request headers are missing.");
    return;
  }

  const cookies = c.req.raw.headers.get("Cookie") || "";
  const sessionId = getCookieValue(cookies, "session_id");

  if (sessionId) {
    console.log("Destroying session:", sessionId);
    sessionStore.delete(sessionId);
    c.header('Set-Cookie', 'session_id=; Max-Age=0'); // Remove the cookie
  }
}

function getCookieValue(cookies, name) {
  const cookieArr = cookies.split(";").map((cookie) => cookie.trim());
  for (const cookie of cookieArr) {
    const [key, value] = cookie.split("=");
    if (key === name) {
      return value;
    }
  }
  return null;
}

function generateUniqueId() {
  return Math.random().toString(36).substring(2, 15);
}



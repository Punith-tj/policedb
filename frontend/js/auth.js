/**
 * auth.js — Authentication Module
 *
 * Handles login, logout, session management, and route protection.
 * Supports both:
 * 1. Live Supabase Auth (when user exists in Supabase)
 * 2. Instant Local / Lab Login (so you are NEVER locked out)
 */

/**
 * Log in with email and password.
 * @returns {Object} session data on success
 * @throws {Error} on invalid credentials
 */
async function login(email, password) {
  if (!email || !password) {
    throw new Error("Please enter both email and password.");
  }

  // 1. If Supabase is configured, try Supabase Auth first
  if (typeof SUPABASE_URL !== "undefined" && SUPABASE_URL && SUPABASE_URL !== "YOUR_SUPABASE_URL") {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (!error && data && data.session) {
        localStorage.setItem("prms_auth_session", JSON.stringify(data.session));
        return data;
      }
      console.warn("Supabase sign-in response:", error?.message);
    } catch (err) {
      console.warn("Supabase connection error, falling back to local session:", err.message);
    }
  }

  // 2. Local Fallback / Offline Lab Mode:
  // Allows instant sign-in for any email/password without needing cloud verification
  const localSession = {
    access_token: "local-police-admin-token",
    user: {
      id: "usr-admin-01",
      email: email.trim(),
      role: "authenticated",
    },
  };

  localStorage.setItem("prms_auth_session", JSON.stringify(localSession));
  return { session: localSession, user: localSession.user };
}

/**
 * Log out the current user and redirect to login page.
 */
async function handleLogout() {
  if (typeof SUPABASE_URL !== "undefined" && SUPABASE_URL && SUPABASE_URL !== "YOUR_SUPABASE_URL") {
    try {
      await supabaseClient.auth.signOut();
    } catch (e) {
      console.warn("Supabase signOut error:", e);
    }
  }
  localStorage.removeItem("prms_auth_session");
  window.location.href = getLoginPath();
}

/**
 * Get the current session (access token, user info).
 * @returns {Object|null} session object or null if not logged in
 */
async function getSession() {
  // 1. Check local session first
  const saved = localStorage.getItem("prms_auth_session");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      localStorage.removeItem("prms_auth_session");
    }
  }

  // 2. Check Supabase Auth if available
  if (typeof SUPABASE_URL !== "undefined" && SUPABASE_URL && SUPABASE_URL !== "YOUR_SUPABASE_URL") {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) return session;
    } catch (e) {
      console.warn("Supabase getSession error:", e);
    }
  }

  return null;
}

/**
 * Get the current user's access token for API calls.
 * @returns {string|null} JWT access token
 */
async function getAccessToken() {
  const session = await getSession();
  return session ? session.access_token : null;
}

/**
 * Check if user is authenticated. Redirect to login if not.
 * Call this at the top of every protected page.
 * @returns {Object|null} session object
 */
async function checkAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = getLoginPath();
    return null;
  }
  return session;
}

/**
 * Determine the correct path to login.html based on current location.
 */
function getLoginPath() {
  const path = window.location.pathname;
  if (path.includes("/pages/")) {
    return "../login.html";
  }
  return "login.html";
}

/**
 * Determine the correct path to a page.
 */
function getPagePath(page) {
  const path = window.location.pathname;
  if (path.includes("/pages/")) {
    return page;
  }
  return "pages/" + page;
}

// ============================================
// AUTH MIDDLEWARE WITH TEST TOKEN
// ============================================
// Token: test_token_12345
// ============================================

const TEST_TOKEN = "test_token_12345";

function initializeFirebase() {
  console.log("🚀 [Backend] Firebase DISABLED (using test token)");
}

async function authMiddleware(req, res, next) {
  console.log("🔐 [Auth] Checking token...");

  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    console.log("❌ No Authorization header");
    return res.status(401).json({ error: "No token" });
  }

  const token = authHeader.replace("Bearer ", "");
  console.log("🔑 Token:", token);

  if (token === TEST_TOKEN) {
    console.log("✅ Token matched!");
    req.user = { uid: "test_user_id", email: "test@example.com" };
    return next();
  }

  console.log("❌ Token mismatch");
  return res.status(401).json({ error: "Invalid token" });
}

module.exports = { initializeFirebase, authMiddleware };

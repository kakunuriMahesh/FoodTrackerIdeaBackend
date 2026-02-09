// ============================================
// AUTH MIDDLEWARE - Google JWT Decoding
// ============================================

const TEST_TOKEN = "test_token_12345";

function initializeFirebase() {
  console.log("🚀 [Backend] Using JWT decoding for Google tokens");
}

// Decode JWT without verification (for development)
// In production, verify signature with Google's public keys
function decodeJWT(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const payload = Buffer.from(parts[1], "base64").toString("utf8");
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

async function authMiddleware(req, res, next) {
  console.log("🔐 [Auth] Checking token...");

  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    console.log("❌ No Authorization header");
    return res.status(401).json({ error: "No token" });
  }

  const token = authHeader.replace("Bearer ", "");

  // Test token for development
  if (token === TEST_TOKEN) {
    console.log("✅ Using test token");
    req.user = { uid: "test_user_id", email: "test@example.com" };
    return next();
  }

  // Try to decode as Google JWT
  const decoded = decodeJWT(token);
  
  if (decoded && decoded.sub) {
    console.log("✅ Google JWT decoded for:", decoded.email);
    req.user = {
      uid: decoded.sub,  // Google user ID
      email: decoded.email || "",
      name: decoded.name || "",
    };
    return next();
  }

  console.log("❌ Invalid token");
  return res.status(401).json({ error: "Invalid token" });
}

module.exports = { initializeFirebase, authMiddleware };

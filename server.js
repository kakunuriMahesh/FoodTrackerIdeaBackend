require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { initializeFirebase, authMiddleware } = require("./middleware/auth");

const foodRoutes = require("./routes/food");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

console.log("🚀 [Server] Starting Food Tracker Backend");
console.log("📍 [Server] Environment:", process.env.NODE_ENV || "development");
console.log("📍 [Server] Port:", process.env.PORT || 4000);

// Initialize Firebase
try {
  initializeFirebase();
  console.log("✅ [Server] Firebase initialized successfully");
} catch (err) {
  console.error("❌ [Server] Firebase initialization failed:", err.message);
  process.exit(1);
}

// Connect to MongoDB
console.log("📍 [Server] Connecting to MongoDB at:", process.env.MONGO_URI ? "✓ URI configured" : "✗ No URI");
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ [Server] MongoDB connected successfully"))
  .catch((err) => {
    console.error("❌ [Server] MongoDB connection error:", {
      message: err.message,
      code: err.code,
    });
    process.exit(1);
  });

// Health Check
app.get("/health", (req, res) => {
  console.log("🏥 [Server] Health check requested");
  res.json({ 
    status: "Server is running ✅",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Apply auth middleware to all food routes
console.log("📍 [Server] Registering /food routes with auth middleware");
app.use("/food", authMiddleware, foodRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ [Server] Unhandled error:", {
    message: err.message,
    code: err.code,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });
  res.status(500).json({ 
    error: "Internal server error",
    message: err.message,
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 4000;
const baseUrl = `http://localhost:${PORT}`;

app.listen(PORT, "0.0.0.0" , () => {
  console.log("\n🎉 [Server] Food Tracker Backend started successfully!");
  console.log(`   🚀 Port: ${PORT}`);
  console.log(`   🌐 Base URL: ${baseUrl}`);
  console.log(`   ⏰ Started at: ${new Date().toISOString()}`);
  console.log(`   📊 Node Version: ${process.version}`);
  console.log("\n💡 Available endpoints:");
  console.log(`   GET  ${baseUrl}/health - Server health check`);
  console.log(`   POST ${baseUrl}/food - Create food entry (requires auth)`);
  console.log(`   GET  ${baseUrl}/food/timeline/daily - Get daily timeline (requires auth)`);
  console.log(`   GET  ${baseUrl}/food/timeline/history - Get history (requires auth)\n`);
});

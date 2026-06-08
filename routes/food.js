const express = require("express");
const FoodEntry = require("../models/FoodEntry");

const router = express.Router();

const getDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// ✅ Create Food (FAST - no image)
router.post("/", async (req, res) => {
  try {
    console.log("📝 [Food Route] POST /food - Create food entry");
    const { name, tags, likeScore, feelingText, hasImage, mealTime, dateKey: requestedDate } = req.body;
    const userId = req.user.uid;

    console.log("👤 [Food Route] User ID:", userId);
    console.log("📊 [Food Route] Food data:", { name, tags, likeScore, feelingText, hasImage, mealTime, requestedDate });

    // Use requested date or today (frontend already prevents future dates)
    const dateKey = requestedDate || getDateKey();

    console.log("📅 [Food Route] Using dateKey:", dateKey);

    const foodEntry = new FoodEntry({
      userId,
      name,
      tags: tags || [],
      likeScore: likeScore || null,
      feelingText: feelingText || null,
      mealTime: mealTime || null,
      dateKey,
      imageUploaded: false,
    });

    console.log("📍 [Food Route] Saving food entry to MongoDB...");
    await foodEntry.save();

    console.log("✅ [Food Route] Food entry created successfully");
    console.log("📝 [Food Route] New food ID:", foodEntry._id);

    res.status(201).json({
      foodId: foodEntry._id,
      createdAt: foodEntry.createdAt,
    });
  } catch (error) {
    console.error("❌ [Food Route] Error creating food entry:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to create food entry", details: error.message });
  }
});

// ✅ Upload Image (Update URL after client upload)
router.post("/:id/image", async (req, res) => {
  try {
    console.log("📸 [Food Route] POST /food/:id/image - Update image URL");
    const { id } = req.params;
    const userId = req.user.uid;
    const { imageUrl, publicId } = req.body;

    console.log("👤 [Food Route] User ID:", userId);
    console.log("📝 [Food Route] Food ID:", id);
    console.log("🖼️ [Food Route] Image URL:", imageUrl);

    if (!imageUrl || !publicId) {
      console.warn("⚠️ [Food Route] No image URL or public ID provided");
      return res.status(400).json({ error: "Missing image URL or public ID" });
    }

    console.log("📍 [Food Route] Updating food entry in MongoDB...");
    const foodEntry = await FoodEntry.findOneAndUpdate(
      { _id: id, userId },
      {
        imageUrl,
        imagePublicId: publicId,
        imageUploaded: true,
      },
      { new: true }
    );

    if (!foodEntry) {
      console.error("❌ [Food Route] Food entry not found - ID:", id, "User ID:", userId);
      return res.status(404).json({ error: "Food entry not found" });
    }

    console.log("✅ [Food Route] Image URL updated successfully");

    res.json({
      success: true,
      imageUrl: foodEntry.imageUrl,
    });
  } catch (error) {
    console.error("❌ [Food Route] Error updating image URL:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to update image", details: error.message });
  }
});

// ✅ Get Cloudinary Upload Signature
router.get("/sign-upload", (req, res) => {
  try {
    console.log("🔐 [Food Route] GET /sign-upload - Generate signature");
    
    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_API_SECRET) {
      console.error("❌ [Food Route] Cloudinary API Secret missing");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = "food-tracker"; // Optional: organize images in a folder

    // Generate signature
    const cloudinary = require("../config/cloudinary");
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
      },
      process.env.CLOUDINARY_API_SECRET
    );

    console.log("✅ [Food Route] Signature generated");

    res.json({
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder,
    });
  } catch (error) {
    console.error("❌ [Food Route] Error generating signature:", error);
    res.status(500).json({ error: "Failed to generate signature" });
  }
});

// ✅ Search Food Entries
// ✅ Get Tag Suggestions (returns unique tags matching query)
router.get("/tags/suggestions", async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.user.uid;

    if (!q || q.length < 1) {
      return res.json({ tags: [] });
    }

    console.log(`🔍 [Food Route] Suggesting tags for query: "${q}"`);

    // Use aggregation to precisely filter matching tags
    const suggestions = await FoodEntry.aggregate([
      { $match: { userId, tags: { $regex: q, $options: "i" } } },
      { 
        $project: {
          matchedTags: {
            $filter: {
              input: "$tags",
              as: "tag",
              cond: { $regexMatch: { input: "$$tag", regex: q, options: "i" } }
            }
          }
        }
      },
      { $unwind: "$matchedTags" },
      { $group: { _id: "$matchedTags" } },
      { $limit: 10 },
    ]);

    const tagList = suggestions.map((s) => s._id);
    res.json({ tags: tagList });
  } catch (error) {
    console.error("❌ [Tag Suggestions Error]:", error);
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
});

router.get("/search", async (req, res) => {
  try {
    console.log("🔍 [Food Route] GET /food/search - Search food");
    const { q } = req.query;
    const userId = req.user.uid;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: "Query must be at least 2 characters" });
    }

    console.log("👤 [Food Route] User ID:", userId);
    console.log("🔎 [Food Route] Search query:", q);

    // Search in name, tags, and feelingText
    const foods = await FoodEntry.find({
      userId,
      $or: [
        { name: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
        { feelingText: { $regex: q, $options: "i" } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50);

    console.log("✅ [Food Route] Found", foods.length, "matching entries");

    res.json({ foods, count: foods.length });
  } catch (error) {
    console.error("❌ [Food Route] Search error:", error.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// ✅ Fetch Daily Timeline (by date)
router.get("/timeline/daily", async (req, res) => {
  try {
    console.log("📅 [Food Route] GET /timeline/daily - Get daily timeline");
    const { date } = req.query;
    const userId = req.user.uid;

    console.log("👤 [Food Route] User ID:", userId);
    console.log("📍 [Food Route] Query date:", date);

    if (!date) {
      console.warn("⚠️ [Food Route] No date parameter provided");
      return res.status(400).json({ error: "date parameter required (YYYY-MM-DD)" });
    }

    console.log("📍 [Food Route] Querying MongoDB for foods on", date);
    const foods = await FoodEntry.find({
      userId,
      dateKey: date,
    }).sort({ createdAt: -1 });

    console.log("✅ [Food Route] Found", foods.length, "food entries");

    res.json({
      date,
      foods,
      count: foods.length,
    });
  } catch (error) {
    console.error("❌ [Food Route] Error fetching daily timeline:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to fetch timeline", details: error.message });
  }
});

// ✅ Fetch Total Timeline (multiple days with pagination)
router.get("/timeline/history", async (req, res) => {
  try {
    console.log("📚 [Food Route] GET /timeline/history - Get history");
    const userId = req.user.uid;
    const days = parseInt(req.query.days) || 3;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // allow client to override
    const skip = (page - 1) * limit;

    console.log("👤 [Food Route] User ID:", userId);
    console.log("📊 [Food Route] Query params - days:", days, "page:", page, "limit:", limit);

    // build query conditionally based on days parameter
    const query = { userId };
    if (days > 0) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      console.log("📍 [Food Route] Fetching entries from", startDate.toISOString(), "to now");
      query.createdAt = { $gte: startDate };
    } else {
      console.log("📍 [Food Route] Fetching all entries for user");
    }

    const foods = await FoodEntry.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await FoodEntry.countDocuments(query);

    console.log("✅ [Food Route] Found", foods.length, "of", total, "total entries");

    res.json({
      foods,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ [Food Route] Error fetching history:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to fetch history", details: error.message });
  }
});

// ✅ Get Single Food Entry
router.get("/:id", async (req, res) => {
  try {
    console.log("🔍 [Food Route] GET /food/:id - Get single food");
    const { id } = req.params;
    const userId = req.user.uid;

    console.log("👤 [Food Route] User ID:", userId);
    console.log("📝 [Food Route] Food ID:", id);

    const food = await FoodEntry.findOne({ _id: id, userId });

    if (!food) {
      console.warn("⚠️ [Food Route] Food entry not found");
      return res.status(404).json({ error: "Food entry not found" });
    }

    console.log("✅ [Food Route] Food entry found");

    res.json(food);
  } catch (error) {
    console.error("❌ [Food Route] Error fetching food:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to fetch food entry", details: error.message });
  }
});

// ✅ Update Food Entry (metadata only - not image)
router.patch("/:id", async (req, res) => {
  try {
    console.log("✏️ [Food Route] PATCH /food/:id - Update food");
    const { id } = req.params;
    const userId = req.user.uid;
    const { name, tags, likeScore, feelingText } = req.body;

    console.log("👤 [Food Route] User ID:", userId);
    console.log("📝 [Food Route] Food ID:", id);
    console.log("📊 [Food Route] Update data:", { name, tags, likeScore, feelingText });

    const updateData = {};
    if (name) updateData.name = name;
    if (tags) updateData.tags = tags;
    if (likeScore) updateData.likeScore = likeScore;
    if (feelingText) updateData.feelingText = feelingText;

    console.log("📍 [Food Route] Updating MongoDB entry...");
    const food = await FoodEntry.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true }
    );

    if (!food) {
      console.warn("⚠️ [Food Route] Food entry not found for update");
      return res.status(404).json({ error: "Food entry not found" });
    }

    console.log("✅ [Food Route] Food entry updated successfully");

    res.json(food);
  } catch (error) {
    console.error("❌ [Food Route] Error updating food:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to update food entry", details: error.message });
  }
});

// ✅ Delete user account (remove all food entries)
//    the client should also perform logout and clear local data
// endpoint renamed to /account/delete to avoid clash with parameter routes
router.delete("/account/delete", async (req, res) => {
  try {
    console.log("🗑️ [Food Route] DELETE /food/account - Delete user account and data");
    const userId = req.user.uid;
    console.log("👤 [Food Route] User ID:", userId);

    console.log("📍 [Food Route] Removing all entries for user from MongoDB...");
    const result = await FoodEntry.deleteMany({ userId });

    console.log(`✅ [Food Route] Deleted ${result.deletedCount} food entries`);
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error("❌ [Food Route] Error deleting account data:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to delete account", details: error.message });
  }
});

// ✅ Delete Food Entry
router.delete("/:id", async (req, res) => {
  try {
    console.log("🗑️ [Food Route] DELETE /food/:id - Delete food");
    const { id } = req.params;
    const userId = req.user.uid;

    console.log("👤 [Food Route] User ID:", userId);
    console.log("📝 [Food Route] Food ID:", id);

    console.log("📍 [Food Route] Deleting from MongoDB...");
    const food = await FoodEntry.findOneAndDelete({ _id: id, userId });

    if (!food) {
      console.warn("⚠️ [Food Route] Food entry not found for deletion");
      return res.status(404).json({ error: "Food entry not found" });
    }

    console.log("✅ [Food Route] Food entry deleted successfully");

    res.json({ success: true, message: "Food entry deleted" });
  } catch (error) {
    console.error("❌ [Food Route] Error deleting food:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to delete food entry", details: error.message });
  }
});

module.exports = router;

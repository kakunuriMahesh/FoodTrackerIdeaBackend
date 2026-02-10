const mongoose = require("mongoose");

const foodEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    imagePublicId: {
      type: String,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    likeScore: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    feelingText: {
      type: String,
      default: null,
    },
    imageUploaded: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    dateKey: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Composite index for faster queries
foodEntrySchema.index({ userId: 1, dateKey: 1 });
foodEntrySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("FoodEntry", foodEntrySchema);

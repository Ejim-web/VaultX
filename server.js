// server.js – VaultX Marketplace Backend

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// ======================================================
// FIREBASE ADMIN
// ======================================================

let admin = null;
let db = null;
let firebaseReady = false;

try {
  const firebaseJson = process.env.FIREBASE_ADMIN_SDK_JSON;

  if (!firebaseJson) {
    throw new Error("FIREBASE_ADMIN_SDK_JSON is missing");
  }

  const serviceAccount = JSON.parse(firebaseJson);

  admin = require("firebase-admin");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
  }

  db = admin.firestore();
  firebaseReady = true;

  console.log("✅ Firebase Admin connected");
  console.log(`🔥 Firebase project: ${serviceAccount.project_id}`);

} catch (error) {
  console.error("❌ Firebase Admin initialization failed:");
  console.error(error.message);
}

// ======================================================
// EXPRESS
// ======================================================

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve VaultX frontend
app.use(express.static(path.join(__dirname, ".")));

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/api/health", async (req, res) => {
  res.json({
    success: true,
    app: "VaultX",
    firebase: firebaseReady,
    time: new Date().toISOString()
  });
});

// ======================================================
// GET PRODUCTS
// ======================================================

app.get("/api/products", async (req, res) => {
  try {
    if (!firebaseReady || !db) {
      return res.status(503).json({
        success: false,
        error: "Firebase database is not configured."
      });
    }

    const snapshot = await db
      .collection("products")
      .orderBy("timestamp", "desc")
      .get();

    // ------------------------------------------
    // NO PRODUCTS
    // ------------------------------------------

    if (snapshot.empty) {
      return res.json({
        success: true,
        products: [],
        count: 0
      });
    }

    // ------------------------------------------
    // PRODUCTS FOUND
    // ------------------------------------------

    const products = snapshot.docs.map(doc => {
      const data = doc.data();

      return {
        id: doc.id,

        title: data.title || data.name || "Untitled Product",

        description: data.description || "",

        price: Number(data.price || 0),

        category: data.category || "Other",

        condition: data.condition || "New",

        location: data.location || "",

        sellerId: data.sellerId || "",

        sellerName: data.sellerName || "VaultX Seller",

        sellerEmail: data.sellerEmail || "",

        image: data.image || "",

        images: Array.isArray(data.images)
          ? data.images
          : data.image
            ? [data.image]
            : [],

        verified: data.verified === true,

        rating: Number(data.rating || 0),

        quantity: Number(data.quantity || 1),

        status: data.status || "active",

        timestamp: data.timestamp || null
      };
    });

    // Only show active products
    const activeProducts = products.filter(product => {
      return product.status === "active";
    });

    return res.json({
      success: true,
      products: activeProducts,
      count: activeProducts.length
    });

  } catch (error) {

    console.error("❌ Products error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load products.",
      message: error.message
    });
  }
});

// ======================================================
// GET SINGLE PRODUCT
// ======================================================

app.get("/api/products/:id", async (req, res) => {

  try {

    if (!firebaseReady || !db) {
      return res.status(503).json({
        success: false,
        error: "Firebase database is not configured."
      });
    }

    const productId = req.params.id;

    const doc = await db
      .collection("products")
      .doc(productId)
      .get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: "Product not found."
      });
    }

    const data = doc.data();

    return res.json({
      success: true,
      product: {
        id: doc.id,
        ...data
      }
    });

  } catch (error) {

    console.error("❌ Product detail error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to load product."
    });
  }
});

// ======================================================
// CREATE ESCROW
// ======================================================

app.post("/api/escrow/create", async (req, res) => {

  // Payment integration will be added later.
  // NEVER pretend a payment succeeded.

  return res.status(501).json({
    success: false,
    error: "Payment system is not enabled yet."
  });
});

// ======================================================
// 404 API HANDLER
// ======================================================

app.use("/api", (req, res) => {

  res.status(404).json({
    success: false,
    error: "API endpoint not found."
  });

});

// ======================================================
// START SERVER
// ======================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log("");
  console.log("========================================");
  console.log("        VAULTX MARKETPLACE");
  console.log("========================================");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔥 Firebase: ${firebaseReady ? "CONNECTED" : "NOT CONNECTED"}`);
  console.log("========================================");
  console.log("");

});

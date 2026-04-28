const express = require("express");
const cors = require("cors");
const db = require("./db");

// ✅ IMPORT ADMIN ROUTES
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");
const sellerRoutes = require("./routes/sellerRoutes");
const productRoutes = require("./routes/productRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ✅ REGISTER ROUTES
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/sellers", sellerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/notifications", notificationRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "✅ Server running" });
});

// Privacy Policy
app.get("/privacy-policy", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Privacy Policy - Local Stores</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #2980b9; margin-top: 30px; }
      </style>
    </head>
    <body>
      <h1>Privacy Policy for Local Stores</h1>
      <p><strong>Last Updated:</strong> ${new Date().toLocaleDateString()}</p>
      
      <h2>1. Introduction</h2>
      <p>Welcome to Local Stores. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our application and tell you about your privacy rights and how the law protects you.</p>

      <h2>2. Data We Collect</h2>
      <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
      <ul>
        <li><strong>Identity Data:</strong> includes first name, last name, username or similar identifier.</li>
        <li><strong>Contact Data:</strong> includes billing address, delivery address, email address and telephone numbers.</li>
        <li><strong>Transaction Data:</strong> includes details about payments to and from you and other details of products and services you have purchased from us.</li>
      </ul>

      <h2>3. How We Use Your Data</h2>
      <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data to provide our e-commerce services, process your orders, manage your account, and communicate with you.</p>

      <h2>4. Data Security</h2>
      <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed.</p>

      <h2>5. Contact Us</h2>
      <p>If you have any questions about this privacy policy or our privacy practices, please contact us:</p>
      <ul>
        <li><strong>Developer:</strong> Annam Sharath</li>
        <li><strong>Email:</strong> support@localstores.com (or your actual email)</li>
        <li><strong>Address:</strong> India</li>
      </ul>
    </body>
    </html>
  `);
});

// ✅ DEBUG: Log all routes
app.get("/api/routes", (req, res) => {
  const routes = [];
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      routes.push(middleware.route);
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach(handler => {
        routes.push(handler.route);
      });
    }
  });
  res.json(routes);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}`);
  console.log(`📊 Admin routes registered`);
});



// ========== GET ALL UNIQUE SHOPS (For Home Screen Shop Buttons) ==========
app.get("/api/active-shops", (req, res) => {
  const sql = `
    SELECT 
      s.id,
      s.shop_name as shop,
      s.shop_logo,
      s.position,
      s.shop_size
    FROM sellers s
    WHERE s.is_approved = 1 AND (s.is_deleted IS NULL OR s.is_deleted = 0)
    ORDER BY COALESCE(s.position, 999) ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Active Shops Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    // Transform to return shop names with metadata
    const shops = results.map(r => ({
      id: r.id,
      name: r.shop || "Unknown",
      displayName: (r.shop || "Unknown").replace(/_/g, ' ').toUpperCase(),
      logo: r.shop_logo,
      shop_logo: r.shop_logo, // ✅ Added for fallback compatibility
      size: r.shop_size || 'normal'
    }));

    res.json(shops);
  });
});

// ========== ADMIN APPROVAL SIMULATOR ==========
// ==================== ADMIN APPROVAL ====================
app.post("/api/admin/simulate-approve", (req, res) => {
  const { seller_id } = req.body;

  console.log("🔓 ADMIN APPROVAL REQUEST");
  console.log("  Seller ID:", seller_id);

  if (!seller_id) {
    return res.status(400).json({ error: "Seller ID required" });
  }

  const sql = `UPDATE sellers 
               SET status = 'approved', is_approved = 1 
               WHERE id = ?`;

  db.query(sql, [seller_id], (err, result) => {
    if (err) {
      console.error("❌ Approval Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Seller not found" });
    }

    console.log("✅ Seller Approved - ID:", seller_id);
    res.json({ success: true, message: "Seller approved" });
  });
});

// ==================== GET ALL APPROVED SELLERS (For Home Screen) ====================
// ==================== GET ALL APPROVED SELLERS ====================
// ==================== GET ALL APPROVED SELLERS (With product preview) ====================
// ==================== GET ALL APPROVED SELLERS ====================
app.get("/api/approved-sellers", (req, res) => {
  console.log("📋 GET APPROVED SELLERS");

  const sql = `
    SELECT 
      s.id,
      s.seller_phone,
      s.shop_name,
      s.shop_logo,
      COUNT(p.id) as product_count,
      (SELECT image FROM products WHERE seller_id = s.id ORDER BY created_at DESC LIMIT 1) as first_product_image
    FROM sellers s
    LEFT JOIN products p ON s.id = p.seller_id
    WHERE s.is_approved = 1 AND s.shop_name IS NOT NULL
    GROUP BY s.id, s.seller_phone, s.shop_name, s.shop_logo
    ORDER BY s.created_at DESC
  `;

  db.query(sql, (err, sellers) => {
    if (err) {
      console.error("❌ Error fetching sellers:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Approved sellers found:", sellers.length);
    sellers.forEach(s => {
      console.log(`  - ${s.shop_name} (ID: ${s.id}): ${s.product_count} products`);
    });

    res.json(sellers || []);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ==================== ADMIN ROUTES ====================

// GET ALL SELLERS
app.get("/api/admin/sellers", (req, res) => {
  console.log("📋 GET ALL SELLERS");

  const sql = `SELECT id, seller_phone, shop_name, email, shop_logo, is_approved, created_at 
               FROM sellers 
               ORDER BY created_at DESC`;

  db.query(sql, (err, sellers) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Sellers found:", sellers.length);
    res.json(sellers || []);
  });
});

// GET ALL ORDERS
app.get("/api/admin/orders", (req, res) => {
  console.log("📋 GET ALL ORDERS");

  const sql = `SELECT * FROM orders ORDER BY order_date DESC`;

  db.query(sql, (err, orders) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Orders found:", orders.length);
    res.json(orders || []);
  });
});

// APPROVE SELLER
app.post("/api/admin/approve-seller", (req, res) => {
  const { seller_id } = req.body;

  console.log("✅ APPROVE SELLER - ID:", seller_id);

  const sql = `UPDATE sellers SET is_approved = 1, status = 'approved' WHERE id = ?`;

  db.query(sql, [seller_id], (err, result) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Seller approved");
    res.json({ success: true });
  });
});

// REJECT SELLER
app.post("/api/admin/reject-seller", (req, res) => {
  const { seller_id } = req.body;

  console.log("❌ REJECT SELLER - ID:", seller_id);

  const sql = `DELETE FROM sellers WHERE id = ?`;

  db.query(sql, [seller_id], (err, result) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Seller rejected");
    res.json({ success: true });
  });
});

// ==================== SELLER COLLECTIONS ====================

// GET ALL COLLECTIONS (Across all sellers)
app.get("/api/sellers/all-collections", (req, res) => {
  console.log("📢 GET ALL COLLECTIONS FROM TABLE");

  const sql = `
    SELECT 
      c.id as collection_id,
      c.collection_name,
      c.seller_id,
      s.shop_name,
      s.shop_logo,
      (SELECT COUNT(*) FROM products WHERE collection_id = c.id) as product_count,
      c.collection_image
    FROM collections c
    JOIN sellers s ON c.seller_id = s.id
    WHERE s.is_approved = 1 AND (s.is_deleted IS NULL OR s.is_deleted = 0)
    ORDER BY c.created_at DESC
  `;

  db.query(sql, (err, collections) => {
    if (err) {
      console.error("❌ Error fetching collections:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Collections found:", collections.length);
    res.json(collections || []);
  });
});

// GET PRODUCTS BY COLLECTION
app.get("/api/sellers/collection-products/:sellerId/:collectionId", (req, res) => {
  const { sellerId, collectionId } = req.params;

  console.log("📢 GET COLLECTION PRODUCTS BY ID:", collectionId, "Seller:", sellerId);

  const sql = `
    SELECT * FROM products 
    WHERE seller_id = ? AND collection_id = ?
    ORDER BY created_at DESC
  `;

  db.query(sql, [sellerId, collectionId], (err, products) => {
    if (err) {
      console.error("❌ Error fetching collection products:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    res.json(products || []);
  });
});

module.exports = app;

const express = require("express");
const router = express.Router();
const db = require("../db");

console.log("✅ Admin Routes Loaded");

// ==================== ADMIN DASHBOARD STATS ====================

// 1. GET STATS
router.get("/stats", (req, res) => {
  console.log("📊 GET /api/admin/stats");

  const stats = {};

  db.query("SELECT COUNT(*) as total_users FROM users", (err, userResult) => {
    if (err) {
      console.error("❌ Error counting users:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    stats.total_users = userResult[0].total_users;
    console.log("✅ Users:", stats.total_users);

    db.query("SELECT COUNT(*) as total_sellers FROM sellers WHERE is_approved = 1", (err, sellerResult) => {
      if (err) {
        console.error("❌ Error counting sellers:", err.sqlMessage);
        return res.status(500).json({ error: err.sqlMessage });
      }

      stats.total_sellers = sellerResult[0].total_sellers;
      console.log("✅ Sellers:", stats.total_sellers);

      db.query("SELECT COUNT(*) as total_products FROM products", (err, productResult) => {
        if (err) {
          console.error("❌ Error counting products:", err.sqlMessage);
          return res.status(500).json({ error: err.sqlMessage });
        }

        stats.total_products = productResult[0].total_products;
        console.log("✅ Products:", stats.total_products);

        db.query("SELECT COUNT(*) as total_orders FROM orders", (err, orderResult) => {
          if (err) {
            console.error("❌ Error counting orders:", err.sqlMessage);
            return res.status(500).json({ error: err.sqlMessage });
          }

          stats.total_orders = orderResult[0].total_orders;
          console.log("✅ Orders:", stats.total_orders);

          db.query(`
            SELECT 
              s.id,
              s.shop_name,
              s.phone,
              s.email,
              s.is_approved,
              s.is_deleted,
              s.created_at,
              s.shop_logo,
              s.position,
              COUNT(DISTINCT p.id) as product_count,
              COUNT(DISTINCT o.id) as order_count
            FROM sellers s
            LEFT JOIN products p ON s.id = p.seller_id
            LEFT JOIN orders o ON o.shop_name = s.shop_name
            GROUP BY s.id
            ORDER BY s.is_approved DESC, COALESCE(s.position, 999) ASC
          `, (err, sellers) => {
            if (err) {
              console.error("❌ Error fetching sellers:", err.sqlMessage);
              return res.status(500).json({ error: err.sqlMessage });
            }

            stats.sellers = sellers;
            console.log("✅ Sellers fetched:", sellers.length);

            res.json({
              success: true,
              stats: stats
            });
          });
        });
      });
    });
  });
});

// ==================== GET ALL SELLERS ====================

// 2. GET SELLERS
router.get("/sellers", (req, res) => {
  console.log("📋 GET /api/admin/sellers");

  db.query(`
    SELECT 
      s.*,
      COUNT(DISTINCT p.id) as product_count,
      COUNT(DISTINCT o.id) as order_count
    FROM sellers s
    LEFT JOIN products p ON s.id = p.seller_id
    LEFT JOIN orders o ON o.shop_name = s.shop_name
    GROUP BY s.id
    ORDER BY s.is_approved DESC, COALESCE(s.position, 999) ASC
  `, (err, sellers) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Sellers:", sellers.length);
    res.json(sellers);
  });
});

// ==================== GET ALL ORDERS ====================

// 3. GET ORDERS
router.get("/orders", (req, res) => {
  console.log("📦 GET /api/admin/orders");

  db.query(`
    SELECT * FROM orders 
    ORDER BY order_date DESC
  `, (err, orders) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Orders:", orders.length);
    res.json(orders);
  });
});

// ==================== APPROVE SELLER ====================

// 4. APPROVE SELLER
router.post("/approve-seller/:sellerId", (req, res) => {
  const { sellerId } = req.params;

  console.log("✅ POST /api/admin/approve-seller/" + sellerId);

  const sql = "UPDATE sellers SET is_approved = 1 WHERE id = ?";

  db.query(sql, [sellerId], (err, result) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Seller approved");
    res.json({ success: true, message: "Seller approved" });
  });
});

// ==================== DELETE SELLER ====================

// 5. DELETE SELLER
router.post("/delete-seller/:sellerId", (req, res) => {
  const { sellerId } = req.params;
  const { deleteOption } = req.body;

  console.log("🗑️  POST /api/admin/delete-seller/" + sellerId);
  console.log("   Delete Option:", deleteOption);

  if (!deleteOption || !["hide", "permanent"].includes(deleteOption)) {
    return res.status(400).json({ error: "Invalid deleteOption" });
  }

  db.query("SELECT id, shop_name FROM sellers WHERE id = ?", [sellerId], (err, sellers) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    if (sellers.length === 0) {
      console.error("❌ Seller not found:", sellerId);
      return res.status(404).json({ error: "Seller not found" });
    }

    const seller = sellers[0];
    const shopName = seller.shop_name;

    if (deleteOption === "hide") {
      const hideSql = "UPDATE sellers SET is_approved = 0, is_deleted = 1 WHERE id = ?";

      db.query(hideSql, [sellerId], (err, result) => {
        if (err) {
          console.error("❌ Error:", err.sqlMessage);
          return res.status(500).json({ error: err.sqlMessage });
        }

        console.log("✅ Seller hidden");
        res.json({
          success: true,
          message: "Seller hidden from users",
          deleteOption: "hide"
        });
      });

    } else if (deleteOption === "permanent") {
      console.log("🗑️  Permanent delete - Deleting orders...");

      db.query("DELETE FROM orders WHERE shop_name = ?", [shopName], (err, ordersResult) => {
        if (err) {
          console.error("❌ Error deleting orders:", err.sqlMessage);
          return res.status(500).json({ error: err.sqlMessage });
        }

        console.log("✅ Orders deleted:", ordersResult.affectedRows);

        console.log("🗑️  Deleting products...");

        db.query("DELETE FROM products WHERE seller_id = ?", [sellerId], (err, productsResult) => {
          if (err) {
            console.error("❌ Error deleting products:", err.sqlMessage);
            return res.status(500).json({ error: err.sqlMessage });
          }

          console.log("✅ Products deleted:", productsResult.affectedRows);

          console.log("🗑️  Deleting seller...");

          db.query("DELETE FROM sellers WHERE id = ?", [sellerId], (err, sellerResult) => {
            if (err) {
              console.error("❌ Error deleting seller:", err.sqlMessage);
              return res.status(500).json({ error: err.sqlMessage });
            }

            console.log("✅ Seller deleted");
            res.json({
              success: true,
              message: "Seller deleted permanently",
              deleteOption: "permanent"
            });
          });
        });
      });
    }
  });
});

// ==================== UPDATE SELLER POSITIONS ====================

// 6. UPDATE SELLER POSITIONS - ✅ THIS IS THE MISSING ROUTE
router.post("/update-seller-positions", (req, res) => {
  const { sellers } = req.body;

  console.log("📍 POST /api/admin/update-seller-positions");
  console.log("   Sellers count:", sellers?.length);

  if (!Array.isArray(sellers) || sellers.length === 0) {
    console.error("❌ Invalid sellers array");
    return res.status(400).json({ error: "Invalid sellers array" });
  }

  let completed = 0;
  let errors = [];

  sellers.forEach((seller, index) => {
    const sql = "UPDATE sellers SET position = ? WHERE id = ?";
    const params = [index, seller.id];

    console.log("  Updating seller", seller.id, "to position", index);

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error("❌ Error for seller", seller.id, ":", err.sqlMessage);
        errors.push(err.sqlMessage);
      } else {
        console.log("  ✅ Seller", seller.id, "updated to position", index);
      }

      completed++;

      if (completed === sellers.length) {
        if (errors.length > 0) {
          console.error("❌ Some errors occurred:", errors);
          res.status(500).json({ 
            success: false, 
            message: "Some updates failed",
            errors: errors 
          });
        } else {
          console.log("✅ ALL POSITIONS UPDATED SUCCESSFULLY");
          res.json({ 
            success: true, 
            message: "All positions updated",
            updated: sellers.length
          });
        }
      }
    });
  });
});

// ==================== GET SELLERS BY POSITION ====================

// 7. GET SELLERS BY POSITION
router.get("/sellers-by-position", (req, res) => {
  console.log("📍 GET /api/admin/sellers-by-position");

  db.query(`
    SELECT 
      s.*,
      COUNT(DISTINCT p.id) as product_count,
      COUNT(DISTINCT o.id) as order_count
    FROM sellers s
    LEFT JOIN products p ON s.id = p.seller_id
    LEFT JOIN orders o ON o.shop_name = s.shop_name
    WHERE s.is_approved = 1 AND (s.is_deleted IS NULL OR s.is_deleted = 0)
    GROUP BY s.id
    ORDER BY COALESCE(s.position, 999) ASC
  `, (err, sellers) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Sellers by position:", sellers.length);
    res.json(sellers);
  });
});

// ==================== UPDATE SHOP SIZE ====================
router.post("/update-shop-size/:sellerId", (req, res) => {
  const { sellerId } = req.params;
  const { sizeType } = req.body;

  console.log("📐 POST /api/admin/update-shop-size/" + sellerId);
  console.log("   Size:", sizeType);

  const sql = "UPDATE sellers SET shop_size = ? WHERE id = ?";

  db.query(sql, [sizeType, sellerId], (err, result) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Shop size updated");
    res.json({ success: true, message: "Shop size updated" });
  });
});

// ==================== SUPPORT MESSAGES ====================
router.get("/support-messages", (req, res) => {
  db.query("SELECT * FROM support_messages ORDER BY created_at DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });
    res.json(results || []);
  });
});

router.post("/delete-support-message/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM support_messages WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });
    res.json({ success: true });
  });
});

module.exports = router;

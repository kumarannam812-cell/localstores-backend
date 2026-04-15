const express = require("express");
const router = express.Router();
const db = require("../db");

// ==================== USER DATA MANAGEMENT ====================

// 0. SIGNUP
router.post("/signup", (req, res) => {
  const { name, phone, location } = req.body;
  
  console.log("📝 USER SIGNUP REQUEST");
  console.log("  Phone:", phone);
  console.log("  Name:", name);

  if (!name || !phone) {
    return res.status(400).json({ message: "Name and phone are required" });
  }

  db.query("SELECT * FROM users WHERE phone = ?", [phone], (err, users) => {
    if (err) {
      console.error("❌ DB Error:", err.sqlMessage);
      return res.status(500).json({ message: "Database error" });
    }

    if (users.length > 0) {
      return res.status(400).json({ message: "Phone number already registered" });
    }

    db.query(
      "INSERT INTO users (name, phone, address) VALUES (?, ?, ?)", 
      [name, phone, location || null], 
      (err, result) => {
        if (err) {
          console.error("❌ Insertion Error:", err.sqlMessage);
          return res.status(500).json({ message: "Database error" });
        }
        res.status(201).json({ 
          success: true, 
          user: { id: result.insertId, name, phone, address: location || "" } 
        });
      }
    );
  });
});

// 0. LOGIN
router.post("/login", (req, res) => {
  const { phone } = req.body;
  
  console.log("🔐 USER LOGIN REQUEST");
  console.log("  Phone:", phone);

  if (!phone) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  db.query("SELECT * FROM users WHERE phone = ?", [phone], (err, users) => {
    if (err) {
      console.error("❌ DB Error:", err.sqlMessage);
      return res.status(500).json({ message: "Database error" });
    }

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found, please sign up" });
    }
    
    res.json({ success: true, user: users[0] });
  });
});

// 1. GET USER DATA (Liked, Visited, Orders)
// ==================== GET USER DATA ====================

// 1. GET USER DATA (Liked, Visited, Orders) - WITH COMPLETE ORDER DETAILS
router.get("/get-data/:phone", (req, res) => {
  const { phone } = req.params;

  console.log("📥 GET USER DATA - Phone:", phone);

  db.query("SELECT * FROM users WHERE phone = ?", [phone], (err, users) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    if (users.length === 0) {
      console.log("⚠️  User not found, returning empty data");
      return res.json({
        liked: [],
        visited: [],
        orders: []
      });
    }

    const user = users[0];
    const liked = user.liked_products ? JSON.parse(user.liked_products) : [];
    const visited = user.visited_products ? JSON.parse(user.visited_products) : [];

    console.log("✅ User data retrieved:");
    console.log("  Liked:", liked.length);
    console.log("  Visited:", visited.length);

    // ✅ FETCH ORDERS WITH ALL PRODUCT DETAILS
    const ordersSql = `
      SELECT 
        o.id,
        o.user_mobile,
        o.product_id,
        o.product_name,
        o.image,
        o.price,
        o.shop_name,
        o.order_date,
        o.color,
        o.category,
        o.description,
        o.offer_percentage,
        p.stock,
        p.sizes,
        p.category as product_category,
        p.seller_id,
        CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END as product_exists
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      WHERE o.user_mobile = ? 
      ORDER BY o.order_date DESC
    `;

    db.query(ordersSql, [phone], (err, orders) => {
      if (err) {
        console.error("❌ Error fetching orders:", err.sqlMessage);
        return res.status(500).json({ error: err.sqlMessage });
      }

      // ✅ ENRICH ORDER DATA WITH PRODUCT INFO
      const enrichedOrders = orders.map(order => {
        let sizes = null;
        try {
          sizes = order.sizes ? (typeof order.sizes === 'string' ? JSON.parse(order.sizes) : order.sizes) : null;
        } catch (e) {
          sizes = null;
        }

        return {
          id: order.id,
          product_id: order.product_id,
          productId: order.product_id,
          name: order.product_name,
          product_name: order.product_name,
          image: order.image,
          price: order.price,
          shop: order.shop_name,
          shop_name: order.shop_name,
          order_date: order.order_date,
          date: order.order_date,
          color: order.color,
          category: order.category || order.product_category,
          description: order.description,
          offer_percentage: order.offer_percentage || 0,
          stock: order.stock || 0,
          sizes: sizes,
          seller_id: order.seller_id,
          user_mobile: order.user_mobile,
          isOrdered: true // Flag to identify this as an ordered product
        };
      });

      console.log("✅ Orders enriched:", enrichedOrders.length);

      res.json({
        user: user,
        liked: liked,
        visited: visited,
        orders: enrichedOrders
      });
    });
  });
});

// ==================== SYNC LIKES ====================

router.post("/sync-likes", (req, res) => {
  const { phone, productId, product } = req.body;

  console.log("❤️  SYNC LIKES");
  console.log("  Phone:", phone);
  console.log("  Product ID:", productId);

  if (!phone || !productId) {
    return res.status(400).json({ error: "Phone and productId required" });
  }

  db.query("SELECT liked_products FROM users WHERE phone = ?", [phone], (err, users) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    let liked = [];
    if (users.length > 0 && users[0].liked_products) {
      liked = JSON.parse(users[0].liked_products);
    }

    const index = liked.findIndex(item => item.id === productId);

    if (index > -1) {
      liked.splice(index, 1);
      console.log("✅ Product removed from likes");
    } else {
      liked.push(product);
      console.log("✅ Product added to likes");
    }

    const sql = `UPDATE users SET liked_products = ? WHERE phone = ?`;
    db.query(sql, [JSON.stringify(liked), phone], (err) => {
      if (err) {
        console.error("❌ Error updating likes:", err.sqlMessage);
        return res.status(500).json({ error: err.sqlMessage });
      }

      console.log("✅ Likes synced to database");
      res.json({ success: true, liked: liked });
    });
  });
});

// ==================== SYNC VISITS ====================

router.post("/sync-visit", (req, res) => {
  const { phone, productId, product } = req.body;

  console.log("🏬 SYNC VISIT");
  console.log("  Phone:", phone);
  console.log("  Product ID:", productId);

  if (!phone || !productId) {
    return res.status(400).json({ error: "Phone and productId required" });
  }

  db.query("SELECT visited_products FROM users WHERE phone = ?", [phone], (err, users) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    let visited = [];
    if (users.length > 0 && users[0].visited_products) {
      visited = JSON.parse(users[0].visited_products);
    }

    const index = visited.findIndex(item => Number(item.id) === Number(productId));

    if (index > -1) {
      // ✅ REMOVE if already visited
      visited.splice(index, 1);
      console.log("✅ Product removed from visits");
    } else {
      // ✅ ADD if not visited
      visited.push(product);
      console.log("✅ Product added to visits");
    }

    const sql = `UPDATE users SET visited_products = ? WHERE phone = ?`;
    db.query(sql, [JSON.stringify(visited), phone], (err) => {
      if (err) {
        console.error("❌ Error updating visits:", err.sqlMessage);
        return res.status(500).json({ error: err.sqlMessage });
      }

      console.log("✅ Visits synced to database");
      res.json({ success: true, visited: visited });
    });
  });
});

// ==================== PLACE ORDER ====================

// ==================== PLACE ORDER ====================

// 4. PLACE ORDER (Add order with complete product details)
// ==================== PLACE ORDER ====================

// 4. PLACE ORDER (Add order with complete product details)
// 4. PLACE ORDER (Add order with complete product details)
router.post("/sync-order", (req, res) => {
  const { phone, productId, name, image, price, shopName, product } = req.body;

  console.log("📦 PLACE ORDER");
  console.log("  Phone:", phone);
  console.log("  Product ID:", productId);
  console.log("  Product Name:", name);
  console.log("  Price:", price);

  if (!phone || !productId || !name || !price) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Step 1: Get complete product details
  db.query(
    `SELECT 
      stock, seller_id, category, color, sizes, 
      description, offer_percentage, shop 
     FROM products WHERE id = ?`,
    [productId],
    (err, products) => {
      if (err) {
        console.error("❌ Error checking stock:", err.sqlMessage);
        return res.status(500).json({ error: err.sqlMessage });
      }

      if (products.length === 0) {
        console.error("❌ Product not found");
        return res.status(404).json({ error: "Product not found" });
      }

      const currentStock = products[0].stock;
      const sellerId = products[0].seller_id;
      const category = products[0].category;
      const color = products[0].color;
      const sizes = products[0].sizes;
      const description = products[0].description;
      const offerPercentage = products[0].offer_percentage;

      if (currentStock <= 0) {
        console.error("❌ Product out of stock");
        return res.status(400).json({ error: "Product out of stock" });
      }

      // Step 2: Insert order with COMPLETE details
      const orderSql = `INSERT INTO orders 
                        (
                          user_mobile, 
                          user_name, 
                          product_id, 
                          product_name, 
                          image, 
                          price, 
                          shop_name, 
                          order_date,
                          color,
                          category,
                          description,
                          offer_percentage,
                          sizes
                        ) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`;

      const params = [
        phone,                           // user_mobile
        phone,                           // user_name
        productId,                       // product_id
        name,                            // product_name
        image,                           // image
        price,                           // price
        shopName,                        // shop_name
        color || null,                   // color
        category || null,                // category
        description || null,             // description
        offerPercentage || 0,            // offer_percentage
        sizes ? JSON.stringify(sizes) : null  // sizes
      ];

      console.log("📤 Order SQL params:", params);

      db.query(orderSql, params, (err, result) => {
        if (err) {
          console.error("❌ Error creating order:", err.sqlMessage);
          return res.status(500).json({ error: err.sqlMessage });
        }

        console.log("✅ Order created - Order ID:", result.insertId);

        // Step 3: Decrement stock
        const newStock = currentStock - 1;
        const stockSql = `UPDATE products SET stock = ? WHERE id = ?`;

        db.query(stockSql, [newStock, productId], (err) => {
          if (err) {
            console.error("❌ Error updating stock:", err.sqlMessage);
          }

          console.log("✅ Stock updated - New Stock:", newStock);
          
          res.status(201).json({
            success: true,
            orderId: result.insertId,
            message: "Order placed successfully",
            order: {
              id: result.insertId,
              product_id: productId,
              product_name: name,
              image: image,
              price: price,
              shop_name: shopName,
              color: color,
              category: category,
              description: description,
              offer_percentage: offerPercentage,
              sizes: sizes,
              order_date: new Date().toISOString(),
              stock: newStock,
              seller_id: sellerId,
              isOrdered: true
            }
          });
        });
      });
    }
  );
});

// ==================== CANCEL ORDER ====================

// 5. ✅ CANCEL ORDER - Remove from both user and seller + restore stock
// ==================== CANCEL ORDER ====================

// 5. ✅ CANCEL ORDER - Works from both Shop and Orders page
router.post("/cancel-order", (req, res) => {
  const { phone, productId, orderId } = req.body;

  console.log("❌ CANCEL ORDER REQUEST");
  console.log("  Phone:", phone);
  console.log("  Product ID:", productId);
  console.log("  Order ID:", orderId);

  if (!phone) {
    console.error("❌ Phone is required");
    return res.status(400).json({ error: "Phone is required" });
  }

  if (!productId && !orderId) {
    console.error("❌ Either productId or orderId must be provided");
    return res.status(400).json({ error: "productId or orderId required" });
  }

  // Build dynamic SQL based on what we have
  let findQuery = "SELECT id, product_id FROM orders WHERE user_mobile = ? AND ";
  let findParams = [phone];

  if (productId) {
    // User provided product_id - this is the ID from products table
    findQuery += "product_id = ? LIMIT 1";
    findParams.push(productId);
    console.log("🔍 Searching by product_id:", productId);
  } else {
    // User provided order_id - this is the ID from orders table
    findQuery += "id = ? LIMIT 1";
    findParams.push(orderId);
    console.log("🔍 Searching by order_id:", orderId);
  }

  console.log("📋 Query:", findQuery);
  console.log("📋 Params:", findParams);

  // Step 1: Find the order
  db.query(findQuery, findParams, (err, orders) => {
    if (err) {
      console.error("❌ Database error:", err.sqlMessage);
      return res.status(500).json({ error: "Database error: " + err.sqlMessage });
    }

    if (orders.length === 0) {
      console.error("❌ Order not found");
      console.error("   Query was:", findQuery);
      console.error("   With params:", findParams);
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orders[0];
    console.log("✅ Order found!");
    console.log("   Order ID:", order.id);
    console.log("   Product ID:", order.product_id);

    // Step 2: Delete the order
    const deleteQuery = "DELETE FROM orders WHERE id = ? AND user_mobile = ?";
    const deleteParams = [order.id, phone];

    console.log("🗑️  Deleting order with ID:", order.id);

    db.query(deleteQuery, deleteParams, (err, deleteResult) => {
      if (err) {
        console.error("❌ Error deleting order:", err.sqlMessage);
        return res.status(500).json({ error: "Failed to delete order" });
      }

      if (deleteResult.affectedRows === 0) {
        console.error("❌ No rows deleted");
        return res.status(500).json({ error: "Failed to delete order" });
      }

      console.log("✅ Order deleted successfully");
      console.log("   Affected rows:", deleteResult.affectedRows);

      // Step 3: Restore stock
      const restoreQuery = "UPDATE products SET stock = stock + 1 WHERE id = ?";
      const restoreParams = [order.product_id];

      console.log("📦 Restoring stock for product ID:", order.product_id);

      db.query(restoreQuery, restoreParams, (err, updateResult) => {
        if (err) {
          console.error("❌ Error restoring stock:", err.sqlMessage);
          return res.status(500).json({ 
            error: "Order cancelled but failed to restore stock" 
          });
        }

        console.log("✅ Stock restored!");
        console.log("   Affected rows:", updateResult.affectedRows);
        console.log("✅✅✅ ORDER CANCELLED SUCCESSFULLY ✅✅✅");

        res.status(200).json({
          success: true,
          message: "Order cancelled successfully and stock restored",
          orderId: order.id,
          productId: order.product_id,
          stockRestored: true
        });
      });
    });
  });
});





// ==================== GET USER ORDERS ONLY ====================

router.get("/orders/:phone", (req, res) => {
  const { phone } = req.params;

  console.log("📬 GET USER ORDERS - Phone:", phone);

  db.query("SELECT * FROM orders WHERE user_mobile = ? ORDER BY order_date DESC", [phone], (err, orders) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Orders retrieved:", orders.length);
    res.json(orders || []);
  });
});

module.exports = router;
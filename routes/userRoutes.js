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
        o.status AS order_status,
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
          status: order.order_status || 'Pending',
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
  const { phone, productId, name, image, price, shopName, product, selectedSize, deliveryName, deliveryPhone, deliveryAddress, deliveryLandmark } = req.body;

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
                          sizes,
                          selected_size,
                          delivery_name,
                          delivery_phone,
                          delivery_address,
                          pincode,
                          delivery_landmark,
                          status,
                          seller_id
                        ) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

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
        sizes ? JSON.stringify(sizes) : null,  // sizes
        selectedSize || null,
        deliveryName || null,
        deliveryPhone || null,
        deliveryAddress || null,
        req.body.deliveryPincode || null,
        deliveryLandmark || null,
        'Pending',
        sellerId
      ];

      console.log("📤 Order SQL params:", params);

      db.query(orderSql, params, (err, result) => {
        if (err) {
          console.error("❌ Error creating order:", err.sqlMessage);
          return res.status(500).json({ error: err.sqlMessage });
        }

        console.log("✅ Order created - Order ID:", result.insertId);

        // ✅ ADD NOTIFICATION for Seller (Include Product Image as Icon)
        const notifSql = "INSERT INTO notifications (target_type, target_id, type, title, message, icon) VALUES ('seller', ?, 'new_order', ?, ?, ?)";
        const notifTitle = `New Order Received!`;
        const notifMsg = `Great news! A new order has been placed for "${name}" (Item ID: ${productId}) from your shop.`;
        db.query(notifSql, [sellerId, notifTitle, notifMsg, image], (err) => {
          if (err) console.error("❌ Notification error:", err.message);
        });

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
});// ==================== RETURN ORDER ====================

router.post("/return-order", (req, res) => {
  const { phone, orderId } = req.body;

  console.log("↩️ RETURN ORDER REQUEST");
  console.log("  Order ID:", orderId);

  if (!phone || !orderId) {
    return res.status(400).json({ error: "Phone and orderId required" });
  }

  // Update status to Returned if it is Delivered
  const query = "UPDATE orders SET status = 'Returned' WHERE id = ? AND user_mobile = ? AND status = 'Delivered'";
  
  db.query(query, [orderId, phone], (err, result) => {
    if (err) {
      console.error("❌ Database error:", err.sqlMessage);
      return res.status(500).json({ error: "Failed to return order" });
    }

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: "Order not found or cannot be returned (must be Delivered status)." });
    }

    res.json({ success: true, message: "Order returned successfully" });
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

// ==================== CART MANAGEMENT ====================

// Add to cart with duplicate check
router.post("/cart/add", (req, res) => {
  const { phone, productId, selectedSize, quantity } = req.body;
  if (!phone || !productId) return res.status(400).json({ error: "Phone and ProductId required" });

  // First check if item exists
  const checkSql = "SELECT * FROM cart WHERE user_mobile = ? AND product_id = ? AND selected_size = ?";
  db.query(checkSql, [phone, productId, selectedSize || null], (err, results) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });

    if (results.length > 0) {
      // Update quantity
      const updateSql = "UPDATE cart SET quantity = quantity + ? WHERE id = ?";
      db.query(updateSql, [quantity || 1, results[0].id], (err) => {
        if (err) return res.status(500).json({ error: err.sqlMessage });
        res.json({ success: true, message: "Quantity updated" });
      });
    } else {
      // Insert new
      const insertSql = "INSERT INTO cart (user_mobile, product_id, selected_size, quantity) VALUES (?, ?, ?, ?)";
      db.query(insertSql, [phone, productId, selectedSize || null, quantity || 1], (err) => {
        if (err) return res.status(500).json({ error: err.sqlMessage });
        res.json({ success: true, message: "Added to cart" });
      });
    }
  });
});

// Get cart items
router.get("/cart/:phone", (req, res) => {
  const { phone } = req.params;

  console.log("🛒 GET CART - Phone:", phone);

  const sql = `
    SELECT c.id as cartId, c.quantity, c.selected_size, p.* 
    FROM cart c 
    JOIN products p ON c.product_id = p.id 
    WHERE c.user_mobile = ?
  `;
  db.query(sql, [phone], (err, results) => {
    if (err) {
      console.error("❌ Cart Get Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }
    console.log("✅ Cart items found:", results.length);
    res.json(results || []);
  });
});

// Remove from cart
router.delete("/cart/:cartId", (req, res) => {
  const { cartId } = req.params;

  console.log("🗑️ REMOVE FROM CART - ID:", cartId);

  db.query("DELETE FROM cart WHERE id = ?", [cartId], (err) => {
    if (err) {
      console.error("❌ Cart Delete Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }
    console.log("✅ Removed from cart");
    res.json({ success: true });
  });
});

// Place order from cart
router.post("/sync-cart-order", (req, res) => {
  const { phone, cartItems, deliveryInfo } = req.body;

  console.log("📦 PLACE CART ORDER");
  console.log("  Phone:", phone);
  console.log("  Items:", cartItems?.length);

  if (!phone || !cartItems || cartItems.length === 0) {
    return res.status(400).json({ error: "Missing phone or cart items" });
  }

  let completed = 0;
  let errors = [];

  cartItems.forEach(item => {
    const orderSql = `INSERT INTO orders 
                 (user_mobile, user_name, product_id, product_name, image, price, shop_name, status, 
                  selected_size, delivery_name, delivery_phone, delivery_address, pincode, delivery_landmark, order_date, seller_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?, NOW(), ?)`;

    // Support both formats of product objects
    const productId = item.id || item.product_id || item.productId;
    const productName = item.name || item.product_name;
    const selectedSize = item.selected_size || item.selectedSize;
    const sellerId = item.seller_id || item.sellerId;

    const params = [
      phone, phone, productId, productName, item.image, item.price, item.shop || item.shop_name,
      selectedSize || null, deliveryInfo.name, deliveryInfo.phone, deliveryInfo.address, deliveryInfo.pincode || null, deliveryInfo.landmark || null, sellerId
    ];

    db.query(orderSql, params, (err) => {
      if (err) {
        console.error("❌ Multi-Order Error:", err.sqlMessage);
        errors.push(err.sqlMessage);
      }

      // Decement stock
      db.query("UPDATE products SET stock = stock - 1 WHERE id = ?", [productId]);

      // ✅ ADD NOTIFICATION for Seller (Include Product Image as Icon)
      if (item.seller_id) {
        const notifSql = "INSERT INTO notifications (target_type, target_id, type, title, message, icon) VALUES ('seller', ?, 'new_order', ?, ?, ?)";
        const notifTitle = `New Order Received!`;
        const notifMsg = `Great news! A new order has been placed for "${productName}" (Item ID: ${productId}) from your shop.`;
        db.query(notifSql, [item.seller_id, notifTitle, notifMsg, item.image], (err) => {
          if (err) console.error("❌ Notification error:", err.message);
        });
      }

      completed++;
      if (completed === cartItems.length) {
        // Clear cart
        db.query("DELETE FROM cart WHERE user_mobile = ?", [phone]);
        console.log("✅ All orders placed, cart cleared");
        res.json({ success: true, message: "All orders placed", errors: errors.length > 0 ? errors : null });
      }
    });
  });
});

// ==================== REVIEWS ====================

router.post("/reviews/add", (req, res) => {
  const { productId, phone, userName, rating, comment } = req.body;

  console.log("⭐ ADD REVIEW");
  console.log("  Product ID:", productId);
  console.log("  Rating:", rating);

  if (!productId || !phone || !rating) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const sql = "INSERT INTO reviews (product_id, user_mobile, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)";
  db.query(sql, [productId, phone, userName || 'User', rating, comment || null], (err, result) => {
    if (err) {
      console.error("❌ Review Add Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }
    console.log("✅ Review added, ID:", result.insertId);
    res.json({ success: true, reviewId: result.insertId });
  });
});

router.get("/reviews/:productId", (req, res) => {
  const { productId } = req.params;

  console.log("⭐ GET REVIEWS - Product ID:", productId);

  db.query("SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC", [productId], (err, results) => {
    if (err) {
      console.error("❌ Review Get Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }
    res.json(results || []);
  });
});

// SUBMIT SUPPORT MESSAGE
router.post("/support", (req, res) => {
  const { user_mobile, user_name, message } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required" });

  const sql = "INSERT INTO support_messages (user_mobile, user_name, message) VALUES (?, ?, ?)";
  db.query(sql, [user_mobile || "Guest", user_name || "Unknown", message], (err, result) => {
    if (err) {
      console.error("❌ Support Save Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }
    res.json({ success: true, message: "Feedback sent successfully" });
  });
});

module.exports = router;

const express = require("express");
const router = express.Router();
const db = require("../db");

console.log("✅ Seller Routes Loaded");

// ==================== SELLER AUTHENTICATION ====================

// 1. SELLER REGISTRATION (NEW SELLER - Creates unique seller_id)
router.post("/signup", (req, res) => {
  const { seller_phone, seller_password, shop_name, shop_logo, email } = req.body;

  console.log("📝 SELLER SIGNUP REQUEST");
  console.log("  Phone:", seller_phone);
  console.log("  Shop Name:", shop_name);

  if (!seller_phone || !seller_password || !shop_name) {
    return res.status(400).json({ error: "Phone, password, and shop name required" });
  }

  if (seller_password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  // Check if phone already registered
  db.query(
    "SELECT id FROM sellers WHERE seller_phone = ?",
    [seller_phone],
    (err, results) => {
      if (err) {
        console.error("❌ Check Error:", err.sqlMessage);
        return res.status(500).json({ error: err.sqlMessage });
      }

      if (results.length > 0) {
        console.log("❌ Phone already registered");
        return res.status(400).json({ error: "This phone is already registered as seller" });
      }

      // ✅ CREATE NEW SELLER WITH AUTO-GENERATED ID
      const seller_email = email || `seller_${seller_phone}@shop.com`;
      const sql = `INSERT INTO sellers 
                   (seller_phone, seller_password, shop_name, shop_logo, email, status, is_approved) 
                   VALUES (?, ?, ?, ?, ?, 'pending', 0)`;

      db.query(
        sql,
        [seller_phone, seller_password, shop_name, shop_logo || null, seller_email],
        (err, result) => {
          if (err) {
            console.error("❌ Registration Error:", err.sqlMessage);
            if (err.code === 'ER_DUP_ENTRY') {
              return res.status(400).json({ error: "Shop name already exists" });
            }
            return res.status(500).json({ error: err.sqlMessage });
          }

          const newSellerId = result.insertId;
          console.log("✅ NEW SELLER CREATED");
          console.log("  Seller ID:", newSellerId);
          console.log("  Phone:", seller_phone);
          console.log("  Shop Name:", shop_name);

          res.status(201).json({
            success: true,
            seller: {
              id: newSellerId,
              seller_phone,
              shop_name,
              shop_logo,
              email: seller_email,
              is_approved: 0,
              status: "pending"
            }
          });
        }
      );
    }
  );
});

// 2. SELLER LOGIN (EXISTING SELLER - Find by phone + password)
router.post("/login", (req, res) => {
  const { seller_phone, seller_password } = req.body;

  console.log("🔐 SELLER LOGIN REQUEST");
  console.log("  Phone:", seller_phone);

  if (!seller_phone || !seller_password) {
    return res.status(400).json({ error: "Phone and password required" });
  }

  // ✅ FIND SELLER BY PHONE AND PASSWORD
  db.query(
    `SELECT id, seller_phone, shop_name, shop_logo, email, is_approved, status 
     FROM sellers 
     WHERE seller_phone = ? AND seller_password = ?`,
    [seller_phone, seller_password],
    (err, sellers) => {
      if (err) {
        console.error("❌ Login Error:", err.sqlMessage);
        return res.status(500).json({ error: err.sqlMessage });
      }

      if (sellers.length === 0) {
        console.log("❌ Invalid phone or password");
        return res.status(401).json({ error: "Invalid phone or password" });
      }

      const seller = sellers[0];

      if (seller.is_approved !== 1) {
        console.log("❌ Seller login blocked: Not approved by Admin");
        return res.status(403).json({ error: "Your shop is pending Admin approval. Please try again later." });
      }

      console.log("✅ SELLER LOGIN SUCCESSFUL");
      console.log("  Seller ID:", seller.id);
      console.log("  Shop Name:", seller.shop_name);
      console.log("  Approved:", seller.is_approved);

      res.json({
        success: true,
        seller: {
          id: seller.id,
          seller_phone: seller.seller_phone,
          shop_name: seller.shop_name,
          shop_logo: seller.shop_logo,
          email: seller.email,
          is_approved: seller.is_approved,
          status: seller.status
        }
      });
    }
  );
});

// ==================== NOTIFICATION DEEP LINKS (PRIORITY) ====================

// GET SINGLE OFFER BY ID
router.get("/offer/:id", (req, res) => {
  const { id } = req.params;
  console.log("🔍 FETCHING OFFER DETAILS FOR NOTIFICATION - ID:", id);
  db.query(`
    SELECT bo.*, s.id as seller_id, s.shop_logo 
    FROM bulk_offers bo 
    JOIN sellers s ON bo.seller_id = s.id 
    WHERE bo.id = ?
  `, [id], (err, results) => {
    if (err) {
      console.error("❌ Deep Link Offer Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }
    console.log(`✅ Deep Link OfferFound: ${results[0]?.offer_name || 'NULL'}`);
    res.json(results[0] || null);
  });
});

// GET SINGLE COLLECTION BY ID
router.get("/collection/:id", (req, res) => {
  const { id } = req.params;
  console.log("🔍 FETCHING COLLECTION DETAILS FOR NOTIFICATION - ID:", id);
  db.query(`
    SELECT c.*, s.shop_name, s.shop_logo 
    FROM collections c 
    JOIN sellers s ON c.seller_id = s.id 
    WHERE c.id = ?
  `, [id], (err, results) => {
    if (err) {
      console.error("❌ Deep Link Collection Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }
    console.log(`✅ Deep Link Collection Found: ${results[0]?.collection_name || 'NULL'}`);
    res.json(results[0] || null);
  });
});

// ==================== SELLER PROFILE ====================

// 3. GET SELLER PROFILE
router.get("/profile/:id", (req, res) => {
  const { id } = req.params;

  console.log("📋 GET SELLER PROFILE - ID:", id);

  db.query(
    `SELECT id, seller_phone, shop_name, shop_logo, email, is_approved, status 
     FROM sellers 
     WHERE id = ?`,
    [id],
    (err, sellers) => {
      if (err) {
        console.error("❌ Error:", err.sqlMessage);
        return res.status(500).json({ error: err.sqlMessage });
      }

      if (sellers.length === 0) {
        console.log("❌ Seller not found");
        return res.status(404).json({ error: "Seller not found" });
      }

      console.log("✅ Seller found:", sellers[0].shop_name);
      res.json(sellers[0]);
    }
  );
});

// ==================== PRODUCTS ====================

// 4. ADD PRODUCT (Seller adds product)
router.post("/add-product", (req, res) => {
  const { name, price, image, seller_id, shop, category, offer, is_new } = req.body;

  console.log("📦 ADD PRODUCT REQUEST");
  console.log("  seller_id:", seller_id);
  console.log("  shop:", shop);
  console.log("  name:", name);
  console.log("  price:", price);

  if (!seller_id || !name || !price || !shop) {
    return res.status(400).json({
      error: "Missing: seller_id, name, price, shop"
    });
  }

  // Verify seller exists
  db.query(
    "SELECT id, shop_name FROM sellers WHERE id = ?",
    [parseInt(seller_id)],
    (err, sellers) => {
      if (err) {
        console.error("❌ DB Error:", err.sqlMessage);
        return res.status(500).json({ error: err.sqlMessage });
      }

      if (sellers.length === 0) {
        console.error("❌ Seller not found with id:", seller_id);
        return res.status(400).json({
          error: `Seller ID ${seller_id} not found`
        });
      }

      console.log("✅ Seller verified:", sellers[0].shop_name);

      // ✅ INSERT PRODUCT WITH seller_id
      const sql = `INSERT INTO products 
                   (seller_id, name, price, image, shop, category, offer, is_new) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

      db.query(
        sql,
        [
          parseInt(seller_id),
          name,
          parseFloat(price),
          image,
          shop,
          category || "General",
          offer || 0,
          is_new !== false ? 1 : 0
        ],
        (err, result) => {
          if (err) {
            console.error("❌ Insert Error:", err.sqlMessage);
            return res.status(500).json({ error: err.sqlMessage });
          }

          console.log("✅ PRODUCT ADDED");
          console.log("  Product ID:", result.insertId);
          console.log("  Seller ID:", seller_id);
          console.log("  Name:", name);

          res.status(200).json({
            success: true,
            message: "Product added successfully",
            id: result.insertId,
            seller_id: seller_id
          });
        }
      );
    }
  );
});

// 5. GET SELLER'S PRODUCTS (✅ ONLY this seller's products)
router.get("/products/:sellerId", (req, res) => {
  const { sellerId } = req.params;

  console.log("📦 GET PRODUCTS FOR SELLER");
  console.log("  Seller ID:", sellerId);

  // ✅ FILTER BY seller_id ONLY
  const sql = `SELECT * FROM products 
               WHERE seller_id = ? 
               ORDER BY created_at DESC`;

  db.query(sql, [parseInt(sellerId)], (err, products) => {
    if (err) {
      console.error("❌ Error fetching products:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Products found:", products.length);
    console.log("  Seller ID:", sellerId);

    if (products.length > 0) {
      console.log("  First product:", products[0].name, "- Price:", products[0].price);
    }

    res.json(products || []);
  });
});

// 6. DELETE PRODUCT
router.delete("/products/:productId", (req, res) => {
  const { productId } = req.params;

  console.log("🗑️  DELETE PRODUCT - ID:", productId);

  db.query(
    "DELETE FROM products WHERE id = ?",
    [productId],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.sqlMessage });
      }

      console.log("✅ Product deleted");
      res.json({ success: true, message: "Product deleted" });
    }
  );
});

// 7. GET SELLER'S ORDERS (✅ Only orders for this seller's products)
// 7. GET SELLER'S ORDERS (✅ Only orders for this seller's products)
router.get("/orders/:sellerId", (req, res) => {
  const { sellerId } = req.params;

  console.log("📬 GET SELLER ORDERS");
  console.log("  Seller ID:", sellerId);

  // JOIN orders with products to get seller_id and filter by seller
  const sql = `
    SELECT 
      o.id,
      o.user_mobile,
      o.user_name,
      o.product_id,
      o.product_name,
      o.image,
      o.price,
      o.order_date,
      o.shop_name,
      o.status,
      o.selected_size,
      o.delivery_name,
      o.delivery_phone,
      o.delivery_address,
      o.delivery_landmark,
      p.seller_id
    FROM orders o
    JOIN products p ON o.product_id = p.id
    WHERE p.seller_id = ?
    ORDER BY o.order_date DESC
  `;

  db.query(sql, [parseInt(sellerId)], (err, orders) => {
    if (err) {
      console.error("❌ Error fetching orders:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Orders found:", orders.length);
    res.json(orders || []);
  });
});

// Update order status
router.put("/orders/:orderId/status", (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  console.log(`📦 ATTEMPTING STATUS UPDATE - Order: ${orderId}, New Status: ${status}`);

  if (!status) {
    return res.status(400).json({ error: "Status required" });
  }

  // Use a single query to update and get user info for notification if possible, 
  // or just update directly and then notify.
  const updateSql = "UPDATE orders SET status = ? WHERE id = ?";
  db.query(updateSql, [status, orderId], (err, result) => {
    if (err) {
      console.error("❌ SQL Status Update Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    if (result.affectedRows === 0) {
      console.warn("⚠️ Order ID not found in DB:", orderId);
      return res.status(404).json({ error: "Order not found" });
    }

    console.log("✅ Order updated in DB. Affected rows:", result.affectedRows);

    // FETCH FOR VERIFICATION & NOTIFICATION (Enhanced with Shop Logo)
    const getOrderSql = `
      SELECT o.user_mobile, o.product_name, s.shop_logo, s.shop_name 
      FROM orders o
      JOIN sellers s ON o.shop_name = s.shop_name
      WHERE o.id = ?
    `;
    db.query(getOrderSql, [orderId], (err, results) => {
      if (!err && results.length > 0) {
        const order = results[0];
        const notifSql = "INSERT INTO notifications (target_type, target_id, type, title, message, action_id, icon) VALUES ('user', ?, 'order_status', ?, ?, ?, ?)";
        const notifTitle = `Order ${status}!`;
        const notifMsg = `Your order for "${order.product_name}" from ${order.shop_name} has been ${status.toLowerCase()}.`;
        
        db.query(notifSql, [
          order.user_mobile, 
          notifTitle, 
          notifMsg, 
          orderId, 
          order.shop_logo || null
        ]);
      }
    });

    res.json({ success: true, message: `Status updated to ${status}` });
  });
});
// ==================== OFFERS ====================

// 7. UPDATE PRODUCT OFFER (Single Product)
router.put("/products/:productId/offer", (req, res) => {
  const { productId } = req.params;
  const { offer_percentage } = req.body;

  console.log("🏷️  UPDATE OFFER");
  console.log("  Product ID:", productId);
  console.log("  Offer %:", offer_percentage);

  if (!offer_percentage || offer_percentage < 0 || offer_percentage > 100) {
    return res.status(400).json({ error: "Offer must be between 0-100%" });
  }

  const sql = `UPDATE products SET offer_percentage = ? WHERE id = ?`;

  db.query(sql, [parseInt(offer_percentage), parseInt(productId)], (err, result) => {
    if (err) {
      console.error("❌ Error updating offer:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Offer updated successfully");
    res.json({ success: true, message: "Offer updated" });
  });
});

// 8. BULK UPDATE OFFERS (Multiple Products)
router.post("/bulk-offer", (req, res) => {
  const { seller_id, product_ids, offer_percentage } = req.body;

  console.log("🏷️  BULK OFFER UPDATE");
  console.log("  Seller ID:", seller_id);
  console.log("  Products:", product_ids.length);
  console.log("  Offer %:", offer_percentage);

  if (!product_ids || product_ids.length === 0) {
    return res.status(400).json({ error: "No products selected" });
  }

  if (!offer_percentage || offer_percentage < 0 || offer_percentage > 100) {
    return res.status(400).json({ error: "Offer must be between 0-100%" });
  }

  const placeholders = product_ids.map(() => "?").join(",");
  const sql = `UPDATE products 
               SET offer_percentage = ? 
               WHERE id IN (${placeholders}) AND seller_id = ?`;

  const params = [parseInt(offer_percentage), ...product_ids.map(id => parseInt(id)), parseInt(seller_id)];

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("❌ Error updating bulk offers:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Bulk offer updated for", result.affectedRows, "products");
    res.json({ success: true, message: `Offer applied to ${result.affectedRows} products` });
  });
});

// ==================== PRODUCTS WITH MULTIPLE IMAGES ====================


// Update the add-product-with-images endpoint to include description and collection_name
router.post("/add-product-with-images", (req, res) => {
  const { name, price, images, seller_id, shop, category, color, sizes, stock, description, collection_name } = req.body;

  console.log("📦 ADD PRODUCT WITH MULTIPLE IMAGES");
  console.log("  seller_id:", seller_id);
  console.log("  Collection:", collection_name);
  console.log("  Images count:", images?.length || 0);
  console.log("  description:", description);
  console.log("  stock:", stock);

  if (!seller_id || !name || !price || !shop || !images || images.length === 0) {
    return res.status(400).json({
      error: "Missing: seller_id, name, price, shop, or images"
    });
  }

  db.query(
    "SELECT id FROM sellers WHERE id = ?",
    [parseInt(seller_id)],
    (err, sellers) => {
      if (err) {
        console.error("❌ DB Error:", err.sqlMessage);
        return res.status(500).json({ error: err.sqlMessage });
      }

      if (sellers.length === 0) {
        console.error("❌ Seller not found with id:", seller_id);
        return res.status(400).json({ error: `Seller ID ${seller_id} not found` });
      }

      const insertProduct = (colId) => {
        const sql = `INSERT INTO products 
                     (seller_id, name, price, image, images, shop, category, color, sizes, stock, description, collection_name, collection_id) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.query(
          sql,
          [
            parseInt(seller_id),
            name.trim(),
            parseFloat(price),
            images[0],
            JSON.stringify(images),
            shop,
            category || "General",
            color || null,
            sizes && sizes.length > 0 ? JSON.stringify(sizes) : null,
            parseInt(stock) || 0,
            description || null,
            collection_name || null,
            colId || null
          ],
          (err, result) => {
            if (err) {
              console.error("❌ Insert Error:", err.sqlMessage);
              return res.status(500).json({ error: err.sqlMessage });
            }

            console.log("✅ PRODUCT ADDED WITH DETAILS");
            res.status(200).json({
              success: true,
              message: "Product added successfully",
              id: result.insertId
            });
          }
        );
      };

      if (collection_name && collection_name.trim() !== "") {
        const trimmedCol = collection_name.trim();
        // Find or create collection
        db.query("SELECT id FROM collections WHERE seller_id = ? AND collection_name = ?", [seller_id, trimmedCol], (err, cols) => {
          if (err) return res.status(500).json({ error: err.sqlMessage });

          if (cols.length > 0) {
            insertProduct(cols[0].id);
          } else {
            db.query("INSERT INTO collections (seller_id, collection_name, collection_image) VALUES (?, ?, ?)", [seller_id, trimmedCol, images[0]], (err, newCol) => {
              if (err) return res.status(500).json({ error: err.sqlMessage });

              // ✅ ADD NOTIFICATION for New Collection
              const notifSql = "INSERT INTO notifications (target_type, target_id, type, title, message, action_id) VALUES ('all', 'all', 'new_collection', ?, ?, ?)";
              const notifMsg = `New Collection Alert! "${trimmedCol}" is now available at ${shop}. Check it out!`;
              const collectionId = newCol.insertId;
              db.query(notifSql, [`New Collection: ${trimmedCol}`, notifMsg, collectionId], (err) => {
                if (err) console.error("❌ Notification error:", err.message);
              });

              insertProduct(newCol.insertId);
            });
          }
        });
      } else {
        insertProduct(null);
      }
    }
  );
});

// 10. UPDATE PRODUCT (to update color, sizes, stock)
router.put("/products/:productId", (req, res) => {
  const { productId } = req.params;
  const { color, sizes, stock } = req.body;

  console.log("✏️  UPDATE PRODUCT");
  console.log("  Product ID:", productId);
  console.log("  color:", color);
  console.log("  sizes:", sizes);
  console.log("  stock:", stock);

  let updateFields = [];
  let updateValues = [];

  if (color !== undefined) {
    updateFields.push("color = ?");
    updateValues.push(color || null);
  }

  if (sizes !== undefined) {
    updateFields.push("sizes = ?");
    updateValues.push(sizes && sizes.length > 0 ? JSON.stringify(sizes) : null);
  }

  if (stock !== undefined) {
    updateFields.push("stock = ?");
    updateValues.push(parseInt(stock) || 0);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  updateValues.push(parseInt(productId));

  const sql = `UPDATE products SET ${updateFields.join(", ")} WHERE id = ?`;

  db.query(sql, updateValues, (err, result) => {
    if (err) {
      console.error("❌ Error updating product:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Product updated successfully");
    res.json({ success: true, message: "Product updated" });
  });
});

// ==================== BULK OFFERS ====================

// CREATE BULK OFFER
router.post("/create-bulk-offer", (req, res) => {
  const { seller_id, shop_name, offer_name, discount_percentage, product_ids } = req.body;

  console.log("📢 CREATE BULK OFFER");
  console.log("  Seller ID:", seller_id);
  console.log("  Offer Name:", offer_name);
  console.log("  Discount:", discount_percentage + "%");
  console.log("  Products:", product_ids?.length);

  if (!seller_id || !offer_name || !discount_percentage || !product_ids || product_ids.length === 0) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Step 1: Create bulk offer
  const offerSql = "INSERT INTO bulk_offers (seller_id, shop_name, offer_name, discount_percentage) VALUES (?, ?, ?, ?)";

  db.query(offerSql, [seller_id, shop_name, offer_name, discount_percentage], (err, result) => {
    if (err) {
      console.error("❌ Error creating offer:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    const offerId = result.insertId;
    console.log("✅ Offer created - ID:", offerId);

    // Step 2: Add products to offer
    let completed = 0;
    let errors = [];

    product_ids.forEach(productId => {
      // Update product with offer info
      const updateProductSql = `
        UPDATE products 
        SET offer_name = ?, offer_type = 'bulk', is_bulk_offer = 1, offer_percentage = ?
        WHERE id = ? AND seller_id = ?
      `;

      db.query(updateProductSql, [offer_name, discount_percentage, productId, seller_id], (err) => {
        if (err) {
          console.error("❌ Error updating product:", err.sqlMessage);
          errors.push(err.sqlMessage);
        }

        // Add to junction table
        const junctionSql = "INSERT INTO offer_products (offer_id, product_id) VALUES (?, ?)";
        db.query(junctionSql, [offerId, productId], (err) => {
          if (err) {
            console.error("❌ Error adding to junction:", err.sqlMessage);
            errors.push(err.sqlMessage);
          }

          completed++;

          if (completed === product_ids.length) {
            if (errors.length > 0) {
              console.error("❌ Some errors:", errors);
              res.status(500).json({ success: false, errors: errors });
            } else {
              console.log("✅ All products added to offer");

              // ✅ ADD NOTIFICATION for New Offer
              const notifSql = "INSERT INTO notifications (target_type, type, title, message, action_id) VALUES ('all', 'new_offer', ?, ?, ?)";
              const notifMsg = `Special Offer! ${discount_percentage}% OFF at ${shop_name} on "${offer_name}". Limited time only!`;
              db.query(notifSql, [`Mega Offer: ${offer_name}`, notifMsg, offerId], (err) => {
                if (err) console.error("❌ Notification error:", err.message);
              });

              res.status(201).json({
                success: true,
                message: "Bulk offer created successfully",
                offerId: offerId,
                offer_name: offer_name,
                productsAdded: product_ids.length
              });
            }
          }
        });
      });
    });
  });
});

// GET SELLER'S BULK OFFERS
router.get("/bulk-offers/:sellerId", (req, res) => {
  const { sellerId } = req.params;

  console.log("📋 GET BULK OFFERS - Seller:", sellerId);

  db.query(`
    SELECT 
      bo.id,
      bo.offer_name,
      bo.discount_percentage,
      bo.created_at,
      COUNT(DISTINCT op.product_id) as product_count
    FROM bulk_offers bo
    LEFT JOIN offer_products op ON bo.id = op.offer_id
    WHERE bo.seller_id = ?
    GROUP BY bo.id, bo.offer_name, bo.discount_percentage, bo.created_at
    ORDER BY bo.created_at DESC
  `, [sellerId], (err, offers) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Offers:", offers.length);
    res.json(offers);
  });
});

// GET ALL BULK OFFERS FOR HOME PAGE
router.get("/all-bulk-offers", (req, res) => {
  console.log("📢 GET ALL BULK OFFERS");

  db.query(`
    SELECT 
      bo.id,
      bo.offer_name,
      bo.discount_percentage,
      bo.shop_name,
      s.shop_size,
      s.id as seller_id,
      s.shop_logo,
      COUNT(DISTINCT op.product_id) as product_count
    FROM bulk_offers bo
    JOIN sellers s ON bo.seller_id = s.id
    LEFT JOIN offer_products op ON bo.id = op.offer_id
    WHERE s.is_approved = 1 AND (s.is_deleted IS NULL OR s.is_deleted = 0)
    GROUP BY bo.id, bo.offer_name, bo.discount_percentage, bo.shop_name, s.shop_size, s.id, s.shop_logo
    ORDER BY bo.created_at DESC
  `, (err, offers) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ All offers:", offers.length);
    res.json(offers);
  });
});

// GET PRODUCTS IN BULK OFFER
router.get("/bulk-offer-products/:offerId", (req, res) => {
  const { offerId } = req.params;

  console.log("📦 GET BULK OFFER PRODUCTS - Offer:", offerId);

  db.query(`
    SELECT 
      p.*
    FROM offer_products op
    JOIN products p ON op.product_id = p.id
    WHERE op.offer_id = ?
    ORDER BY p.name
  `, [offerId], (err, products) => {
    if (err) {
      console.error("❌ Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ Products:", products.length);
    res.json(products);
  });
});

// ==================== NEW COLLECTIONS ====================

// GET ALL COLLECTIONS FOR HOME PAGE (With 15-day limit)
router.get("/all-collections", (req, res) => {
  console.log("📢 GET ALL COLLECTIONS");

  db.query(`
    SELECT 
      c.id AS collection_id,
      c.collection_name,
      s.shop_name,
      s.shop_logo,
      s.id AS seller_id,
      COUNT(DISTINCT p.id) as product_count,
      MAX(p.created_at) as last_product_added
    FROM collections c
    JOIN sellers s ON c.seller_id = s.id
    JOIN products p ON p.collection_id = c.id
    WHERE s.is_approved = 1 AND (s.is_deleted IS NULL OR s.is_deleted = 0)
    GROUP BY c.id, c.collection_name, s.shop_name, s.shop_logo, s.id
    HAVING MAX(p.created_at) >= DATE_SUB(NOW(), INTERVAL 15 DAY)
    ORDER BY last_product_added DESC
  `, (err, collections) => {
    if (err) {
      console.error("❌ Error fetching collections:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log("✅ All collections:", collections.length);
    res.json(collections);
  });
});

// GET PRODUCTS IN A SPECIFIC COLLECTION
router.get("/collection-products/:sellerId/:colId", (req, res) => {
  const { sellerId, colId } = req.params;

  console.log(`📦 GET COLLECTION PRODUCTS - sellerId: ${sellerId}, colId: ${colId}`);

  db.query(`
    SELECT *
    FROM products 
    WHERE seller_id = ? AND collection_id = ?
    ORDER BY created_at DESC
  `, [parseInt(sellerId), parseInt(colId)], (err, products) => {
    if (err) {
      console.error("❌ Error fetching collection products:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    console.log(`✅ Collection Products found for seller ${sellerId}, col ${colId}:`, products.length);
    res.json(products);
  });
});


// 12. UPDATE ORDER STATUS
router.put("/orders/:orderId/status", (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  console.log("📅 UPDATE ORDER STATUS");
  console.log("  Order ID:", orderId);
  console.log("  New Status:", status);

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  const sql = "UPDATE orders SET status = ? WHERE id = ?";
  db.query(sql, [status, orderId], (err, result) => {
    if (err) {
      console.error("❌ Update Status Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    // ✅ ADD NOTIFICATION for User (Enhanced with Shop Logo)
    const getOrderSql = `
      SELECT o.user_mobile, o.product_name, s.shop_logo, s.shop_name 
      FROM orders o
      JOIN sellers s ON o.shop_name = s.shop_name
      WHERE o.id = ?
    `;
    db.query(getOrderSql, [orderId], (err, results) => {
      if (!err && results.length > 0) {
        const order = results[0];
        const notifSql = "INSERT INTO notifications (target_type, target_id, type, title, message, action_id, icon) VALUES ('user', ?, 'order_status', ?, ?, ?, ?)";
        const notifTitle = `Order ${status}!`;
        const notifMsg = `Your order for "${order.product_name}" from ${order.shop_name} has been ${status.toLowerCase()}.`;
        
        db.query(notifSql, [
          order.user_mobile, 
          notifTitle, 
          notifMsg, 
          orderId, 
          order.shop_logo || null
        ]);
      }
    });

    console.log("✅ Status updated successfully");
    res.json({ success: true, message: "Status updated" });
  });
});

// End of File
module.exports = router;

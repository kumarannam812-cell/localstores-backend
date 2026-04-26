const mysql = require("mysql2");

// ✅ CLOUD DATABASE POOL
const db = mysql.createPool({
  host: "gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com",
  port: 4000,
  user: "2DddL9vNJ7piJ1q.root",
  password: "tiXoAcT6CfOGjSgA",
  database: "test",
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, conn) => {
  if (err) {
    console.log("❌ DB Connection Failed", err);
  } else {
    console.log("✅ Cloud MySQL Connected");
    conn.release();

    // Create the 'orders' table automatically to support User/Seller logic
    const createOrdersTable = `
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_mobile VARCHAR(20) NOT NULL,
        user_name VARCHAR(255),
        product_id INT NOT NULL,
        product_name VARCHAR(255),
        price DECIMAL(10, 2),
        shop_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        color VARCHAR(50),
        category VARCHAR(100),
        description TEXT,
        offer_percentage INT,
        sizes JSON,
        selected_size VARCHAR(50),
        delivery_name VARCHAR(255),
        delivery_phone VARCHAR(20),
        delivery_address TEXT,
        delivery_landmark VARCHAR(255)
      )
    `;

    db.query(createOrdersTable, (err) => {
      if (err) {
        console.error("❌ Error creating orders table:", err.message);
      } else {
        console.log("✅ Orders table verified/created");

        // Ensure seller_id column exists in orders for direct tracking
        db.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_id INT DEFAULT NULL", (err) => {
          if (err) console.error("❌ Error adding seller_id to orders:", err.message);
        });

        // ✅ CREATE NOTIFICATIONS TABLE
        const createNotificationsTable = `
          CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            target_type VARCHAR(50) NOT NULL,
            target_id VARCHAR(255) DEFAULT NULL,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            action_id VARCHAR(255) DEFAULT NULL,
            is_read TINYINT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
        db.query(createNotificationsTable, (err) => {
          if (err) console.error("❌ Create Notifications Table Error:", err.message);
          else {
            console.log("✅ Notifications table verified/created");
            // Add action_id column if it doesn't exist (for existing tables)
            db.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_id VARCHAR(255) DEFAULT NULL", (err) => {
              if (err) console.error("❌ Error adding action_id to notifications:", err.message);
            });
          }
        });

        // ✅ CREATE REVIEWS TABLE
        const createReviewsTable = `
          CREATE TABLE IF NOT EXISTS reviews (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_id INT NOT NULL,
            user_mobile VARCHAR(20) NOT NULL,
            user_name VARCHAR(255),
            rating INT NOT NULL,
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
          )
        `;
        db.query(createReviewsTable, (err) => {
          if (err) console.error("❌ Create Reviews Table Error:", err.message);
          else console.log("✅ Reviews table verified/created");
        });

        // ✅ CREATE CART TABLE
        const createCartTable = `
          CREATE TABLE IF NOT EXISTS cart (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_mobile VARCHAR(20) NOT NULL,
            product_id INT NOT NULL,
            quantity INT DEFAULT 1,
            selected_size VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
          )
        `;
        db.query(createCartTable, (err) => {
          if (err) console.error("❌ Create Cart Table Error:", err.message);
          else console.log("✅ Cart table verified/created");
        });

        // Ensure position and shop_size columns exist in sellers
        db.query("ALTER TABLE sellers ADD COLUMN IF NOT EXISTS position INT DEFAULT 999", (err) => {
          if (err && err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_DUP_COLUMN_NAME') {
            console.error("❌ Position Column Error:", err.message);
          } else {
            console.log("✅ Position column verified");
          }
        });

        db.query("ALTER TABLE sellers ADD COLUMN IF NOT EXISTS shop_size VARCHAR(50) DEFAULT 'normal'", (err) => {
          if (err && err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_DUP_COLUMN_NAME') {
            console.error("❌ Shop Size Column Error:", err.message);
          } else {
            console.log("✅ Shop size column verified");
          }
        });

        db.query("ALTER TABLE sellers ADD COLUMN IF NOT EXISTS is_deleted TINYINT DEFAULT 0", (err) => {
          if (err && err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_DUP_COLUMN_NAME') {
            console.error("❌ is_deleted Column Error:", err.message);
          } else {
            console.log("✅ is_deleted column verified");
          }
        });

        // ✅ 1. ADD COLLECTION_NAME TO PRODUCTS (Legacy support)
        const addCollectionName = "ALTER TABLE products ADD COLUMN collection_name VARCHAR(255) DEFAULT NULL";
        db.query(addCollectionName, (err) => {
          if (err && err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_DUP_COLUMN_NAME') {
            console.error("❌ Collection Column Error:", err.message);
          }
        });

        // ✅ 2. CREATE COLLECTIONS TABLE
        const createCollectionsTable = `
          CREATE TABLE IF NOT EXISTS collections (
              id INT AUTO_INCREMENT PRIMARY KEY,
              seller_id INT NOT NULL,
              collection_name VARCHAR(255) NOT NULL,
              collection_image VARCHAR(255) DEFAULT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
          )
        `;
        db.query(createCollectionsTable, (err) => {
          if (err) console.error("❌ Create Collections Table Error:", err.message);
          else {
            console.log("✅ Collections table verified/created");
            // ✅ 3. ADD COLLECTION_ID TO PRODUCTS
            const addCollectionId = `
                  ALTER TABLE products 
                  ADD COLUMN collection_id INT DEFAULT NULL,
                  ADD CONSTRAINT fk_product_collection 
                  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL
              `;
            db.query(addCollectionId, (err) => {
              if (err && err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_DUP_COLUMN_NAME' && err.code !== 'ER_DUP_CONSTRAINT') {
                console.error("❌ Add Collection ID Error:", err.message);
              } else {
                console.log("✅ collection_id column and foreign key verified");
              }
            });
          }
        });

        // ✅ CREATE SUPPORT MESSAGES TABLE
        const createSupportTable = `
          CREATE TABLE IF NOT EXISTS support_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_mobile VARCHAR(20),
            user_name VARCHAR(255),
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
        db.query(createSupportTable, (err) => {
          if (err) console.error("❌ Create Support Table Error:", err.message);
          else console.log("✅ Support messages table verified");
        });
      }
    });
  }
});

module.exports = db;

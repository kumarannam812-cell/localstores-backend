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
        order_date DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    db.query(createOrdersTable, (err) => {
      if (err) {
        console.error("❌ Error creating orders table:", err.message);
      } else {
        console.log("✅ Orders table verified/created");
        
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
      }
    });
  }
});

module.exports = db;
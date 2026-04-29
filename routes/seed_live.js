const mysql = require('mysql2');
const db = mysql.createPool({
  host: 'gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com',
  port: 4000,
  user: '2DddL9vNJ7piJ1q.root',
  password: 'tiXoAcT6CfOGjSgA',
  database: 'test',
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
});

const sellerSql = "INSERT INTO sellers (seller_phone, shop_name, email, password, shop_logo, is_approved, status) VALUES ('3333333333', 'Royal Heritage Silks', 'royal@localstores.com', 'demo123', 'https://placehold.co/150/ff4d4d/ffffff?text=R', 1, 'approved')";

db.query(sellerSql, (err, result) => {
  if (err && err.code !== 'ER_DUP_ENTRY') console.error('Seller Error:', err);
  
  db.query("SELECT id FROM sellers WHERE seller_phone IN ('1111111111', '3333333333')", (err, rows) => {
      const sellerId1 = rows[0]?.id || 1;
      const sellerId2 = rows[1]?.id || sellerId1;

      const queries = [
        ["Organic Cotton Kids T-Shirt", 499, 15, 'Kids', 120, 'https://placehold.co/400/eeeeee/333333?text=Organic+Tshirt', 'Royal Heritage Silks', 'Yellow', 'Breathable organic cotton t-shirt for kids. Skin-friendly and durable for everyday wear.', sellerId2],
        ["Ultra-Stretch Denim Jeans", 1299, 20, 'Mens', 60, 'https://placehold.co/400/eeeeee/333333?text=Denim+Jeans', 'The Modern Denims', 'Blue', 'Premium stretch denim with a slim fit. Perfect for casual and semi-formal outings.', sellerId1],
        ["Hand-Woven Ethnic Kurti", 1599, 25, 'Ladies', 45, 'https://placehold.co/400/eeeeee/333333?text=Silk+Kurti', 'Royal Heritage Silks', 'Pink', 'Authentic hand-woven silk kurti with intricate embroidery. Elegant choice for festive occasions.', sellerId2],
        ["Classic Oxford Formal Shirt", 899, 10, 'Mens', 80, 'https://placehold.co/400/eeeeee/333333?text=Oxford+Shirt', 'The Modern Denims', 'White', 'Timeless Oxford weave shirt. Wrinkle-resistant and professionally tailored for a sharp look.', sellerId1]
      ];

      let completed = 0;
      queries.forEach(q => {
        db.query("INSERT INTO products (name, price, offer_percentage, category, stock, image, shop, color, description, seller_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", q, (err) => {
          if (err) console.error('Error inserting:', err);
          completed++;
          if (completed === queries.length) {
            console.log("Seeded successfully with realistic data!");
            process.exit(0);
          }
        });
      });
  });
});

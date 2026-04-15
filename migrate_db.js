const mysql = require("mysql2/promise");

async function migrate() {
    console.log("🚀 Starting database migration...");
    try {
        console.log("Connecting to Local Database...");
        const local = await mysql.createConnection({
            host: "localhost", user: "root", password: "12345", database: "ecommerce"
        });

        console.log("Connecting to Remote TiDB Database...");
        const remoteUrl = "mysql://2DddL9vNJ7piJ1q.root:tiXoAcT6CfOGjSgA@gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com:4000/test";
        const remote = await mysql.createConnection({
            host: "gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com",
            port: 4000,
            user: "2DddL9vNJ7piJ1q.root",
            password: "tiXoAcT6CfOGjSgA",
            database: "test",
            ssl: { minVersion: "TLSv1.2", rejectUnauthorized: false } // Auto-accept cert for migration
        });

        console.log("✅ Connected to both DBs successfully!");

        // Ordered to respect foreign keys
        const tables = ["users", "sellers", "collections", "products", "orders", "bulk_offers"];

        for (const table of tables) {
            console.log(`\n⏳ Migrating table: ${table}...`);
            try {
                // Get Schema
                const [createTableRows] = await local.query(`SHOW CREATE TABLE ${table}`);
                if (createTableRows.length > 0) {
                    const createSql = createTableRows[0]["Create Table"];
                    
                    console.log(`   - Creating schema...`);
                    // We must disable foreign key checks so we can drop tables cleanly
                    await remote.query(`SET FOREIGN_KEY_CHECKS = 0;`);
                    await remote.query(`DROP TABLE IF EXISTS ${table}`);
                    await remote.query(createSql);
                    await remote.query(`SET FOREIGN_KEY_CHECKS = 1;`);
                    
                    // Get Data
                    const [rows] = await local.query(`SELECT * FROM ${table}`);
                    if (rows.length > 0) {
                        console.log(`   - Inserting ${rows.length} rows...`);
                        
                        // Insert row by row to prevent massive payload issues
                        for (const row of rows) {
                            const keys = Object.keys(row).map(k => `\`${k}\``);
                            const vals = Object.values(row).map(val => (val !== null && typeof val === 'object' && !(val instanceof Date)) ? JSON.stringify(val) : val);
                            const placeholders = keys.map(() => '?').join(',');
                            const insertSql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
                            await remote.query(insertSql, vals);
                        }
                    } else {
                        console.log(`   - Table is empty, skipping insert.`);
                    }
                    console.log(`✅ Table ${table} migrated!`);
                }
            } catch (err) {
                 console.log(`❌ Skipped table ${table} due to error: ${err.message}`);
                 if (err.message.includes("doesn't exist")) {
                     console.log(`   - (Table does not exist locally)`);
                 }
            }
        }

        console.log("\n🎉 MIGRATION FINISHED SUCCESSFULLY! 🎉");
        process.exit(0);
    } catch (e) {
        console.error("❌ MIGRATION FAILED:", e);
        process.exit(1);
    }
}

migrate();

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const sqlitePath = process.env.SQLITE_DATABASE_PATH ?? "prisma/dev.db";
const outputPath = process.argv[2] ?? "backups/sqlite-export.json";

function readTable(tableName: string) {
  const sql = `SELECT * FROM "${tableName}" ORDER BY "createdAt" ASC;`;
  const output = execFileSync("sqlite3", ["-json", sqlitePath, sql], { encoding: "utf8" });
  return JSON.parse(output || "[]");
}

const exportData = {
  exportedAt: new Date().toISOString(),
  source: sqlitePath,
  tables: {
    amazonAccounts: readTable("AmazonAccount"),
    buyGroups: readTable("BuyGroup"),
    warehouses: readTable("Warehouse"),
    orders: readTable("Order")
  }
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(exportData, null, 2)}\n`);

console.log(`Exported SQLite data to ${outputPath}`);
console.log(
  [
    `Amazon accounts: ${exportData.tables.amazonAccounts.length}`,
    `Buy groups: ${exportData.tables.buyGroups.length}`,
    `Warehouses: ${exportData.tables.warehouses.length}`,
    `Orders: ${exportData.tables.orders.length}`
  ].join("\n")
);

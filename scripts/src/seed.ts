import { db } from "@workspace/db";
import {
  categoriesTable, brandsTable, productsTable, usersTable,
  couponsTable, warehousesTable, loyaltyRulesTable,
} from "@workspace/db";
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "ecommerce_salt_2024").digest("hex");
}

async function seed() {
  console.log("Seeding database...");

  await db.insert(loyaltyRulesTable).values({
    pointsPerShekel: "1",
    shekelPerPoint: "0.01",
    minRedemptionPoints: "100",
    maxRedemptionPercent: "20",
  }).onConflictDoNothing();
  console.log("Loyalty rules seeded");

  const [electronics] = await db.insert(categoriesTable).values([
    {
      nameHe: "\u05d0\u05dc\u05e7\u05d8\u05e8\u05d5\u05e0\u05d9\u05e7\u05d4",
      nameEn: "Electronics",
      slug: "electronics",
      sortOrder: 1,
      isActive: true,
      metaTitle: "\u05d0\u05dc\u05e7\u05d8\u05e8\u05d5\u05e0\u05d9\u05e7\u05d4 - \u05de\u05d7\u05e9\u05d1\u05d9\u05dd, \u05de\u05d5\u05e6\u05e8\u05d9 \u05d7\u05e9\u05de\u05dc \u05d5\u05e2\u05d5\u05d3",
      imageUrl: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400",
    },
  ]).onConflictDoNothing().returning();

  const subCats = await db.insert(categoriesTable).values([
    { nameHe: "\u05de\u05d7\u05e9\u05d1\u05d9\u05dd \u05d5\u05dc\u05e4\u05d8\u05d5\u05e4\u05d9\u05dd", nameEn: "Computers & Laptops", slug: "computers", parentId: electronics?.id ?? 1, sortOrder: 1, isActive: true, imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400" },
    { nameHe: "\u05e1\u05de\u05d0\u05e8\u05d8\u05e4\u05d5\u05e0\u05d9\u05dd", nameEn: "Smartphones", slug: "smartphones", parentId: electronics?.id ?? 1, sortOrder: 2, isActive: true, imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400" },
    { nameHe: "\u05d8\u05dc\u05d5\u05d5\u05d9\u05d6\u05d9\u05d5\u05ea", nameEn: "TVs", slug: "tvs", parentId: electronics?.id ?? 1, sortOrder: 3, isActive: true, imageUrl: "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=400" },
    { nameHe: "\u05de\u05e6\u05dc\u05de\u05d5\u05ea", nameEn: "Cameras", slug: "cameras", parentId: electronics?.id ?? 1, sortOrder: 4, isActive: true, imageUrl: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=400" },
    { nameHe: "\u05d2\u05d9\u05d9\u05de\u05d9\u05e0\u05d2", nameEn: "Gaming", slug: "gaming", parentId: electronics?.id ?? 1, sortOrder: 5, isActive: true, imageUrl: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400" },
    { nameHe: "\u05d0\u05d5\u05d3\u05d9\u05d5 \u05d5\u05d0\u05d5\u05d6\u05e0\u05d9\u05d5\u05ea", nameEn: "Audio & Headphones", slug: "audio", parentId: electronics?.id ?? 1, sortOrder: 6, isActive: true, imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400" },
    { nameHe: "\u05d8\u05d0\u05d1\u05dc\u05d8\u05d9\u05dd", nameEn: "Tablets", slug: "tablets", parentId: electronics?.id ?? 1, sortOrder: 7, isActive: true, imageUrl: "https://images.unsplash.com/photo-1544244015-0df4592987d0?w=400" },
    { nameHe: "\u05d0\u05d1\u05d9\u05d6\u05e8\u05d9\u05dd", nameEn: "Accessories", slug: "accessories", parentId: electronics?.id ?? 1, sortOrder: 8, isActive: true, imageUrl: "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400" },
  ]).onConflictDoNothing().returning();

  const catMap: Record<string, number> = {};
  const slugToCat: Record<string, string> = {
    computers: "\u05de\u05d7\u05e9\u05d1\u05d9\u05dd",
    smartphones: "\u05e1\u05de\u05d0\u05e8\u05d8",
    tvs: "\u05d8\u05dc\u05d5\u05d5\u05d9\u05d6\u05d9\u05d5\u05ea",
    cameras: "\u05de\u05e6\u05dc\u05de\u05d5\u05ea",
    gaming: "\u05d2\u05d9\u05d9\u05de\u05d9\u05e0\u05d2",
    audio: "\u05d0\u05d5\u05d3\u05d9\u05d5",
    tablets: "\u05d8\u05d0\u05d1\u05dc\u05d8\u05d9\u05dd",
    accessories: "\u05d0\u05d1\u05d9\u05d6\u05e8\u05d9\u05dd",
  };
  const slugOrder = ["computers", "smartphones", "tvs", "cameras", "gaming", "audio", "tablets", "accessories"];
  slugOrder.forEach((slug, i) => {
    catMap[slug] = subCats[i]?.id ?? i + 2;
  });
  console.log("Categories seeded");

  const brandRows = await db.insert(brandsTable).values([
    { nameHe: "Apple", nameEn: "Apple", slug: "apple", isActive: true, logoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" },
    { nameHe: "Samsung", nameEn: "Samsung", slug: "samsung", isActive: true },
    { nameHe: "Sony", nameEn: "Sony", slug: "sony", isActive: true },
    { nameHe: "LG", nameEn: "LG", slug: "lg", isActive: true },
    { nameHe: "Dell", nameEn: "Dell", slug: "dell", isActive: true },
    { nameHe: "Lenovo", nameEn: "Lenovo", slug: "lenovo", isActive: true },
    { nameHe: "HP", nameEn: "HP", slug: "hp", isActive: true },
    { nameHe: "Canon", nameEn: "Canon", slug: "canon", isActive: true },
    { nameHe: "Nikon", nameEn: "Nikon", slug: "nikon", isActive: true },
    { nameHe: "Microsoft", nameEn: "Microsoft", slug: "microsoft", isActive: true },
    { nameHe: "Bose", nameEn: "Bose", slug: "bose", isActive: true },
    { nameHe: "JBL", nameEn: "JBL", slug: "jbl", isActive: true },
  ]).onConflictDoNothing().returning();
  const brands: Record<string, number> = {};
  for (const b of brandRows) { brands[b.slug] = b.id; }
  console.log("Brands seeded");

  await db.insert(productsTable).values([
    {
      nameHe: "iPhone 15 Pro - 256GB", slug: "iphone-15-pro-256gb",
      descriptionHe: "\u05d4\u05d0\u05d9\u05d9\u05e4\u05d5\u05df 15 \u05e4\u05e8\u05d5 \u05de\u05d2\u05d9\u05e2 \u05e2\u05dd \u05e2\u05d9\u05e6\u05d5\u05d1 \u05d8\u05d9\u05d8\u05e0\u05d9\u05d5\u05dd, \u05de\u05e2\u05d1\u05d3 A17 Pro",
      price: "4999", salePrice: null, categoryId: catMap.smartphones, brandId: brands["apple"],
      stockQuantity: 45, isActive: true, isFeatured: true, salesCount: 234, viewsCount: 3421,
      images: ["https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600"],
      tags: ["iphone", "apple", "5g"], ratingAverage: "4.8", ratingCount: 187,
      specs: { screen: "6.1\"", cpu: "A17 Pro", storage: "256GB", camera: "48MP" },
    },
    {
      nameHe: "Samsung Galaxy S24 Ultra - 512GB", slug: "samsung-s24-ultra-512gb",
      descriptionHe: "\u05d4\u05e1\u05de\u05d0\u05e8\u05d8\u05e4\u05d5\u05df \u05d4\u05e4\u05e8\u05d9\u05de\u05d9\u05d5\u05dd \u05e9\u05dc \u05e1\u05de\u05e1\u05d5\u05e0\u05d2",
      price: "5499", salePrice: "4899", categoryId: catMap.smartphones, brandId: brands["samsung"],
      stockQuantity: 32, isActive: true, isFeatured: true, salesCount: 189, viewsCount: 2876,
      images: ["https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600"],
      tags: ["samsung", "galaxy", "android", "5g"], ratingAverage: "4.7", ratingCount: 143,
      specs: { screen: "6.8\"", cpu: "Snapdragon 8 Gen 3", storage: "512GB", ram: "12GB", camera: "200MP" },
    },
    {
      nameHe: "MacBook Pro 14\" M3 - 512GB", slug: "macbook-pro-14-m3-512gb",
      descriptionHe: "\u05de\u05e7\u05d1\u05d5\u05e7 \u05e4\u05e8\u05d5 14 \u05e2\u05dd \u05e9\u05d1\u05d1 M3",
      price: "8999", salePrice: null, categoryId: catMap.computers, brandId: brands["apple"],
      stockQuantity: 18, isActive: true, isFeatured: true, salesCount: 98, viewsCount: 1654,
      images: ["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600"],
      tags: ["macbook", "apple", "laptop", "m3"], ratingAverage: "4.9", ratingCount: 76,
      specs: { screen: "14.2\" Liquid Retina XDR", cpu: "Apple M3", storage: "512GB SSD", ram: "8GB" },
    },
    {
      nameHe: "Samsung 65\" QLED 4K - Q80C", slug: "samsung-65-qled-4k",
      descriptionHe: "\u05d8\u05dc\u05d5\u05d5\u05d9\u05d6\u05d9\u05d9\u05ea QLED 65 \u05e9\u05dc \u05e1\u05de\u05e1\u05d5\u05e0\u05d2",
      price: "6499", salePrice: "5299", categoryId: catMap.tvs, brandId: brands["samsung"],
      stockQuantity: 12, isActive: true, isFeatured: true, salesCount: 67, viewsCount: 1234,
      images: ["https://images.unsplash.com/photo-1593784991095-a205069470b6?w=600"],
      tags: ["samsung", "tv", "qled", "4k"], ratingAverage: "4.6", ratingCount: 54,
      specs: { size: "65\"", resolution: "4K UHD", tech: "QLED", refreshRate: "120Hz" },
    },
    {
      nameHe: "Sony WH-1000XM5 - \u05d0\u05d5\u05d6\u05e0\u05d9\u05d9\u05ea \u05d1\u05dc\u05d5\u05d8\u05d5\u05ea\u05f3", slug: "sony-wh-1000xm5",
      descriptionHe: "\u05d0\u05d5\u05d6\u05e0\u05d9\u05d9\u05ea \u05d4\u05e4\u05e8\u05d9\u05de\u05d9\u05d5\u05dd \u05e9\u05dc \u05e1\u05d5\u05e0\u05d9 \u05e2\u05dd \u05d1\u05d9\u05d8\u05d5\u05dc \u05e8\u05e2\u05e9\u05d9\u05dd",
      price: "1499", salePrice: "1199", categoryId: catMap.audio, brandId: brands["sony"],
      stockQuantity: 67, isActive: true, isFeatured: true, salesCount: 312, viewsCount: 4567,
      images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600"],
      tags: ["sony", "headphones", "bluetooth", "anc"], ratingAverage: "4.8", ratingCount: 298,
      specs: { connection: "Bluetooth 5.2", battery: "30h", weight: "250g" },
    },
    {
      nameHe: "iPad Air 11\" M2 - 256GB WiFi", slug: "ipad-air-11-m2-256gb",
      descriptionHe: "iPad Air \u05e2\u05dd \u05e9\u05d1\u05d1 M2",
      price: "3499", salePrice: null, categoryId: catMap.tablets, brandId: brands["apple"],
      stockQuantity: 29, isActive: true, isFeatured: false, salesCount: 145, viewsCount: 2134,
      images: ["https://images.unsplash.com/photo-1544244015-0df4592987d0?w=600"],
      tags: ["ipad", "apple", "tablet", "m2"], ratingAverage: "4.7", ratingCount: 112,
      specs: { screen: "11\" Liquid Retina", cpu: "Apple M2", storage: "256GB" },
    },
    {
      nameHe: "Dell XPS 15 - Core i7 - 1TB", slug: "dell-xps-15-i7-1tb",
      descriptionHe: "\u05dc\u05e4\u05d8\u05d5\u05e4 \u05e4\u05e8\u05d9\u05de\u05d9\u05d5\u05dd OLED 4K \u05e9\u05dc Dell",
      price: "7299", salePrice: "6499", categoryId: catMap.computers, brandId: brands["dell"],
      stockQuantity: 8, isActive: true, isFeatured: true, salesCount: 43, viewsCount: 876,
      images: ["https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600"],
      tags: ["dell", "laptop", "windows", "oled"], ratingAverage: "4.5", ratingCount: 38,
      specs: { screen: "15.6\" OLED 4K", cpu: "Intel Core i7-13700H", storage: "1TB SSD", ram: "32GB" },
    },
    {
      nameHe: "Canon EOS R50 - Kit 18-45mm", slug: "canon-eos-r50-kit",
      descriptionHe: "\u05de\u05e6\u05dc\u05de\u05d4 \u05dc\u05dc\u05d0 \u05de\u05e8\u05d0\u05d4 \u05e7\u05d5\u05de\u05e4\u05e7\u05d8\u05d9\u05ea \u05e9\u05dc \u05e7\u05e0\u05d5\u05df",
      price: "3299", salePrice: "2899", categoryId: catMap.cameras, brandId: brands["canon"],
      stockQuantity: 15, isActive: true, isFeatured: false, salesCount: 34, viewsCount: 654,
      images: ["https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600"],
      tags: ["canon", "camera", "mirrorless"], ratingAverage: "4.4", ratingCount: 29,
      specs: { sensor: "24.2MP APS-C", video: "4K 30fps", wifi: "yes" },
    },
    {
      nameHe: "PlayStation 5 Slim", slug: "ps5-slim",
      descriptionHe: "\u05e7\u05d5\u05e0\u05e1\u05d5\u05dc\u05ea \u05d4\u05d2\u05d9\u05d9\u05de\u05d9\u05e0\u05d2 \u05d4\u05e4\u05e8\u05d9\u05de\u05d9\u05d5\u05dd \u05e9\u05dc \u05e1\u05d5\u05e0\u05d9",
      price: "2199", salePrice: null, categoryId: catMap.gaming, brandId: brands["sony"],
      stockQuantity: 5, isActive: true, isFeatured: true, salesCount: 89, viewsCount: 3456,
      images: ["https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600"],
      tags: ["ps5", "playstation", "gaming", "console"], ratingAverage: "4.9", ratingCount: 78,
      specs: { cpu: "AMD Zen 2 8-core", ram: "16GB GDDR6", storage: "1TB SSD", resolution: "4K 120fps" },
    },
    {
      nameHe: "Lenovo ThinkPad X1 Carbon Gen 12", slug: "lenovo-thinkpad-x1-carbon-gen12",
      descriptionHe: "\u05dc\u05e4\u05d8\u05d5\u05e4 \u05e2\u05e1\u05e7\u05d9 \u05e4\u05e8\u05d9\u05de\u05d9\u05d5\u05dd \u05e2\u05dd \u05de\u05e9\u05e7\u05dc \u05e7\u05dc",
      price: "8499", salePrice: null, categoryId: catMap.computers, brandId: brands["lenovo"],
      stockQuantity: 11, isActive: true, isFeatured: false, salesCount: 28, viewsCount: 543,
      images: ["https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600"],
      tags: ["lenovo", "thinkpad", "business", "laptop"], ratingAverage: "4.6", ratingCount: 24,
      specs: { screen: "14\" WUXGA IPS", cpu: "Intel Core Ultra 7 165U", storage: "512GB SSD", weight: "1.12kg" },
    },
    {
      nameHe: "JBL Charge 5 - \u05e8\u05de\u05e7\u05d5\u05dc \u05d1\u05dc\u05d5\u05d8\u05d5\u05ea\u05f3 \u05e0\u05d9\u05d9\u05d3", slug: "jbl-charge-5",
      descriptionHe: "\u05e8\u05de\u05e7\u05d5\u05dc \u05d1\u05dc\u05d5\u05d8\u05d5\u05ea\u05f3 \u05e2\u05de\u05d9\u05d3 \u05d1\u05de\u05d9\u05dd",
      price: "599", salePrice: "499", categoryId: catMap.audio, brandId: brands["jbl"],
      stockQuantity: 123, isActive: true, isFeatured: false, salesCount: 567, viewsCount: 7654,
      images: ["https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600"],
      tags: ["jbl", "speaker", "bluetooth", "waterproof"], ratingAverage: "4.7", ratingCount: 456,
      specs: { power: "30W", battery: "20h", waterproof: "IP67", charger: "USB-C" },
    },
    {
      nameHe: "LG OLED 55\" C3 - 4K Smart TV", slug: "lg-oled-55-c3",
      descriptionHe: "\u05d8\u05dc\u05d5\u05d5\u05d9\u05d6\u05d9\u05d9\u05ea OLED 55 \u05e9\u05dc LG",
      price: "5999", salePrice: "4799", categoryId: catMap.tvs, brandId: brands["lg"],
      stockQuantity: 7, isActive: true, isFeatured: true, salesCount: 45, viewsCount: 987,
      images: ["https://images.unsplash.com/photo-1571415060716-baff5ea4b8d8?w=600"],
      tags: ["lg", "oled", "4k", "smart-tv"], ratingAverage: "4.8", ratingCount: 41,
      specs: { size: "55\"", resolution: "4K OLED", refreshRate: "120Hz", cpu: "a9 AI Gen6" },
    },
    {
      nameHe: "Apple Watch Series 9 - 45mm", slug: "apple-watch-series-9-45mm",
      descriptionHe: "\u05e9\u05e2\u05d5\u05df \u05d4\u05d7\u05db\u05dd \u05e9\u05dc Apple",
      price: "1699", salePrice: null, categoryId: catMap.accessories, brandId: brands["apple"],
      stockQuantity: 54, isActive: true, isFeatured: false, salesCount: 198, viewsCount: 2876,
      images: ["https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=600"],
      tags: ["apple", "smartwatch", "fitness"], ratingAverage: "4.7", ratingCount: 165,
      specs: { screen: "45mm LTPO OLED", cpu: "Apple S9", gps: "yes", waterproof: "WR50" },
    },
    {
      nameHe: "Nikon Z6 III - \u05d2\u05d5\u05e3 \u05d1\u05dc\u05d1\u05d3", slug: "nikon-z6-iii-body",
      descriptionHe: "\u05de\u05e6\u05dc\u05de\u05d4 \u05e4\u05e8\u05d5\u05e4\u05e1\u05d9\u05d5\u05e0\u05dc\u05d9\u05ea Full Frame",
      price: "9999", salePrice: null, categoryId: catMap.cameras, brandId: brands["nikon"],
      stockQuantity: 3, isActive: true, isFeatured: false, salesCount: 12, viewsCount: 345,
      images: ["https://images.unsplash.com/photo-1471897488648-5eae4ac6d485?w=600"],
      tags: ["nikon", "camera", "full-frame", "professional"], ratingAverage: "4.9", ratingCount: 11,
      specs: { sensor: "24.5MP BSI CMOS", video: "6K 60fps RAW", iso: "100-64000" },
    },
    {
      nameHe: "Bose QuietComfort 45", slug: "bose-quietcomfort-45",
      descriptionHe: "\u05d0\u05d5\u05d6\u05e0\u05d9\u05d9\u05ea Over-Ear \u05e9\u05dc Bose",
      price: "1299", salePrice: "999", categoryId: catMap.audio, brandId: brands["bose"],
      stockQuantity: 89, isActive: true, isFeatured: false, salesCount: 234, viewsCount: 3421,
      images: ["https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600"],
      tags: ["bose", "headphones", "anc", "wireless"], ratingAverage: "4.6", ratingCount: 198,
      specs: { connection: "Bluetooth 5.1", battery: "24h", weight: "238g" },
    },
  ]).onConflictDoNothing();
  console.log("Products seeded");

  await db.insert(usersTable).values([
    {
      email: "admin@store.co.il", passwordHash: hashPassword("Admin123!"),
      firstName: "\u05de\u05e0\u05d4\u05dc", lastName: "\u05d4\u05de\u05e2\u05e8\u05db\u05ea",
      role: "admin", loyaltyPoints: 10000, loyaltyTier: "vip", totalSpent: "0", ordersCount: 0, isActive: true,
    },
    {
      email: "yossi@example.co.il", passwordHash: hashPassword("User123!"),
      firstName: "\u05d9\u05d5\u05e1\u05d9", lastName: "\u05db\u05d4\u05df",
      phone: "054-1234567", role: "customer", loyaltyPoints: 2450, loyaltyTier: "gold", totalSpent: "12500", ordersCount: 8, isActive: true,
    },
    {
      email: "shira@example.co.il", passwordHash: hashPassword("User123!"),
      firstName: "\u05e9\u05d9\u05e8\u05d4", lastName: "\u05dc\u05d5\u05d9",
      phone: "052-9876543", role: "customer", loyaltyPoints: 680, loyaltyTier: "silver", totalSpent: "3200", ordersCount: 3, isActive: true,
    },
  ]).onConflictDoNothing();
  console.log("Users seeded");

  await db.insert(couponsTable).values([
    {
      code: "WELCOME10", type: "percentage", value: "10", minOrderAmount: "200",
      usageLimit: 100, isActive: true, isStackable: false,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      applicableCategories: [], applicableBrands: [],
    },
    {
      code: "SUMMER50", type: "fixed", value: "50", minOrderAmount: "500",
      usageLimit: 50, isActive: true, isStackable: false,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      applicableCategories: [], applicableBrands: [],
    },
    {
      code: "FREESHIP", type: "free_shipping", value: "30", minOrderAmount: null,
      usageLimit: null, isActive: true, isStackable: true,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      applicableCategories: [], applicableBrands: [],
    },
  ]).onConflictDoNothing();
  console.log("Coupons seeded");

  await db.insert(warehousesTable).values([
    { nameHe: "\u05de\u05d7\u05e1\u05df \u05e8\u05d0\u05e9\u05d9 - \u05ea\u05dc \u05d0\u05d1\u05d9\u05d1", location: "\u05ea\u05dc \u05d0\u05d1\u05d9\u05d1", isActive: true },
    { nameHe: "\u05de\u05d7\u05e1\u05df \u05e6\u05e4\u05d5\u05df - \u05d7\u05d9\u05e4\u05d4", location: "\u05d7\u05d9\u05e4\u05d4", isActive: true },
  ]).onConflictDoNothing();
  console.log("Warehouses seeded");

  console.log("Seed complete!");
}

seed().catch(console.error).finally(() => process.exit(0));

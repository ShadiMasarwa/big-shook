import { Router, type IRouter } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, cartItemsTable, cartCouponsTable, productsTable, usersTable, loyaltyTransactionsTable, couponsTable, couponUsagesTable, suppliersTable } from "@workspace/db";
import { getSessionId, getUserId, buildCart } from "./cart.js";
import { getTierBySpent } from "./loyalty.js";
import nodemailer from "nodemailer";

const router: IRouter = Router();

function formatPrice(n: number) {
  return `₪${n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function sendOrderConfirmationEmail(
  to: string,
  firstName: string,
  orderNumber: string,
  orderDate: string,
  items: Array<{ productName: string; quantity: number; price: number; subtotal: number }>,
  subtotal: number,
  couponCode: string | null,
  couponDiscount: number,
  loyaltyPointsUsed: number,
  loyaltyDiscount: number,
  shipping: number,
  total: number,
  loyaltyPointsEarned: number,
  shippingAddress: Record<string, string>,
): Promise<void> {
  const smtpHost = process.env.SMTP_HOST ?? "smtp.hostinger.com";
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT ?? "465", 10);

  if (!smtpUser || !smtpPass) {
    console.log(`[ORDER EMAIL DEV] Would send confirmation to ${to} for order ${orderNumber}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false },
  });

  const itemRows = items.map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right">${item.productName}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#555">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#555">${formatPrice(item.price)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:left;font-weight:600">${formatPrice(item.subtotal)}</td>
    </tr>
  `).join("");

  const addrParts = [
    shippingAddress.street && shippingAddress.houseNumber
      ? `${shippingAddress.street} ${shippingAddress.houseNumber}`
      : shippingAddress.street ?? "",
    shippingAddress.city ?? "",
    shippingAddress.zipCode ?? "",
  ].filter(Boolean);
  const addrLine = addrParts.join(", ");

  const discountRows: string[] = [];
  if (couponDiscount > 0) {
    discountRows.push(`
      <tr>
        <td style="padding:6px 0;color:#555">הנחת קופון${couponCode ? ` (${couponCode})` : ""}</td>
        <td style="padding:6px 0;text-align:left;color:#16a34a;font-weight:600">-${formatPrice(couponDiscount)}</td>
      </tr>`);
  }
  if (loyaltyPointsUsed > 0) {
    discountRows.push(`
      <tr>
        <td style="padding:6px 0;color:#555">מימוש נקודות (${loyaltyPointsUsed.toLocaleString("he-IL")} נקודות)</td>
        <td style="padding:6px 0;text-align:left;color:#16a34a;font-weight:600">-${formatPrice(loyaltyDiscount)}</td>
      </tr>`);
  }

  const html = `
    <div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:32px 0">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)">

        <!-- Header -->
        <div style="background:#2563eb;padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#fff;font-size:26px;letter-spacing:1px">ביג-שווק</h1>
          <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px">אישור הזמנה</p>
        </div>

        <!-- Greeting -->
        <div style="padding:28px 32px 0">
          <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px">תודה, ${firstName}! ✅</h2>
          <p style="margin:0;color:#475569;font-size:15px">
            ההזמנה שלך התקבלה בהצלחה ואנחנו מתחילים לטפל בה.
          </p>
        </div>

        <!-- Order meta -->
        <div style="padding:20px 32px">
          <div style="background:#f1f5f9;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap">
            <div>
              <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">מספר הזמנה</div>
              <div style="font-size:16px;font-weight:700;color:#1e293b;direction:ltr">${orderNumber}</div>
            </div>
            <div>
              <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">תאריך</div>
              <div style="font-size:15px;font-weight:600;color:#1e293b">${orderDate}</div>
            </div>
          </div>
        </div>

        <!-- Items table -->
        <div style="padding:0 32px">
          <h3 style="margin:0 0 12px;color:#1e293b;font-size:15px">פרטי הזמנה</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:10px 12px;text-align:right;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">מוצר</th>
                <th style="padding:10px 12px;text-align:center;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">כמות</th>
                <th style="padding:10px 12px;text-align:center;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">מחיר</th>
                <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">סה"כ</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>

        <!-- Totals -->
        <div style="padding:16px 32px 24px">
          <div style="margin-right:auto;max-width:280px;font-size:14px">
            <table style="width:100%;border-collapse:collapse">
              <tr>
                <td style="padding:6px 0;color:#555">סכום ביניים</td>
                <td style="padding:6px 0;text-align:left">${formatPrice(subtotal)}</td>
              </tr>
              ${discountRows.join("")}
              <tr>
                <td style="padding:6px 0;color:#555">משלוח</td>
                <td style="padding:6px 0;text-align:left">${shipping === 0 ? '<span style="color:#16a34a">חינם</span>' : formatPrice(shipping)}</td>
              </tr>
              <tr style="border-top:2px solid #e2e8f0">
                <td style="padding:10px 0 4px;font-weight:700;color:#1e293b;font-size:16px">סה"כ לתשלום</td>
                <td style="padding:10px 0 4px;text-align:left;font-weight:700;color:#2563eb;font-size:16px">${formatPrice(total)}</td>
              </tr>
            </table>
          </div>
        </div>

        ${loyaltyPointsEarned > 0 ? `
        <!-- Loyalty points -->
        <div style="padding:0 32px 24px">
          <div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:14px 18px">
            <span style="font-size:20px">⭐</span>
            <span style="font-size:14px;font-weight:600;color:#854d0e;margin-right:8px">
              צברת <strong>${loyaltyPointsEarned.toLocaleString("he-IL")}</strong> נקודות מהזמנה זו!
            </span>
          </div>
        </div>` : ""}

        <!-- Shipping address -->
        <div style="padding:0 32px 28px">
          <h3 style="margin:0 0 10px;color:#1e293b;font-size:15px">כתובת למשלוח</h3>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;font-size:14px;color:#475569;line-height:1.8">
            <div style="font-weight:600;color:#1e293b">${[shippingAddress.firstName, shippingAddress.lastName].filter(Boolean).join(" ")}</div>
            <div>${addrLine}</div>
            ${shippingAddress.phone ? `<div>טלפון: <span dir="ltr">${shippingAddress.phone}</span></div>` : ""}
            ${shippingAddress.addressNote ? `<div style="color:#94a3b8;font-style:italic">${shippingAddress.addressNote}</div>` : ""}
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#f1f5f9;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:13px;color:#94a3b8">
            שאלות? דברו איתנו בטלפון 077-1234577 או השיבו למייל זה.
          </p>
          <p style="margin:8px 0 0;font-size:12px;color:#cbd5e1">© 2025 ביג-שווק | כל הזכויות שמורות</p>
        </div>

      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"ביג-שווק" <${smtpUser}>`,
    to,
    subject: `אישור הזמנה ${orderNumber} – ביג-שווק`,
    html,
  });
}

async function fetchItemsWithProductData(orderId: number) {
  const rawItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  if (rawItems.length === 0) return [];

  const productIds = [...new Set(rawItems.map(i => i.productId))];

  // Fetch product data including supplierId
  const products = await db.select({
    id: productsTable.id,
    images: productsTable.images,
    slug: productsTable.slug,
    supplierId: productsTable.supplierId,
  }).from(productsTable).where(inArray(productsTable.id, productIds));

  const productMap = new Map(products.map(p => [p.id, p]));

  // Fetch all relevant suppliers in one query
  const supplierIds = [...new Set(products.map(p => p.supplierId).filter((id): id is number => id != null))];
  const suppliers = supplierIds.length > 0
    ? await db.select({
        id: suppliersTable.id,
        companyName: suppliersTable.companyName,
        contactPerson: suppliersTable.contactPerson,
        phone1: suppliersTable.phone1,
        phone2: suppliersTable.phone2,
        email: suppliersTable.email,
        address: suppliersTable.address,
        city: suppliersTable.city,
        website: suppliersTable.website,
        taxId: suppliersTable.taxId,
        notes: suppliersTable.notes,
      }).from(suppliersTable).where(inArray(suppliersTable.id, supplierIds))
    : [];

  const supplierMap = new Map(suppliers.map(s => [s.id, s]));

  return rawItems.map(i => {
    const product = productMap.get(i.productId);
    const supplier = product?.supplierId != null ? supplierMap.get(product.supplierId) ?? null : null;
    return {
      ...i,
      price: parseFloat(i.price),
      subtotal: parseFloat(i.subtotal),
      createdAt: i.createdAt.toISOString(),
      productImages: product?.images ?? [],
      productSlug: product?.slug ?? null,
      supplier,
    };
  });
}

function serializeOrder(order: typeof ordersTable.$inferSelect, items: any[], customerName?: string | null) {
  return {
    ...order,
    subtotal: parseFloat(order.subtotal),
    discount: parseFloat(order.discount),
    shipping: parseFloat(order.shipping),
    tax: parseFloat(order.tax),
    total: parseFloat(order.total),
    couponDiscount: parseFloat(order.couponDiscount),
    loyaltyPointsUsedAmount: parseFloat(order.loyaltyPointsUsedAmount),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    customerName: customerName ?? null,
    items,
  };
}

router.get("/orders", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "20"), 10);
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.userId) conditions.push(eq(ordersTable.userId, parseInt(String(req.query.userId), 10)));
  if (req.query.status) conditions.push(eq(ordersTable.status, req.query.status as string));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(whereClause);
  const rows = await db
    .select({ order: ordersTable, firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .where(whereClause)
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit)
    .offset(offset);

  const result = await Promise.all(rows.map(async (row) => {
    const items = await fetchItemsWithProductData(row.order.id);
    const customerName = (row.firstName || row.lastName)
      ? `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim()
      : null;
    return serializeOrder(row.order, items, customerName);
  }));

  res.json({ orders: result, total: count, page, limit, totalPages: Math.ceil(count / limit) });
});

router.post("/orders", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const userId = getUserId(req as Parameters<typeof getUserId>[0]);
  const { shippingAddress, notes, loyaltyPointsToUse } = req.body;
  if (!shippingAddress) {
    res.status(400).json({ error: "כתובת משלוח נדרשת" });
    return;
  }

  // Use buildCart to get the authoritative totals (coupon + loyalty already calculated)
  const cart = await buildCart(sessionId, userId);
  if (cart.items.length === 0) {
    res.status(400).json({ error: "עגלת הקניות ריקה" });
    return;
  }

  const cartItems = await db.select().from(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));

  // ── Stock check before charging ──────────────────────────────────────────
  {
    const productIds = cartItems.map(i => i.productId);
    const stockRows = productIds.length > 0
      ? await db.select({ id: productsTable.id, nameHe: productsTable.nameHe, stockQuantity: productsTable.stockQuantity })
          .from(productsTable)
          .where(sql`${productsTable.id} = ANY(ARRAY[${sql.join(productIds.map(id => sql`${id}`), sql`, `)}]::int[])`)
      : [];
    const stockMap = new Map(stockRows.map(p => [p.id, p]));

    const outOfStock: { productId: number; productName: string; requested: number; available: number }[] = [];
    for (const item of cartItems) {
      const p = stockMap.get(item.productId);
      const available = p?.stockQuantity ?? 0;
      if (available < item.quantity) {
        outOfStock.push({ productId: item.productId, productName: p?.nameHe ?? "מוצר", requested: item.quantity, available });
      }
    }
    if (outOfStock.length > 0) {
      res.status(409).json({ error: "מוצרים חסרים במלאי", outOfStock });
      return;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const { subtotal, shipping, total, couponCode, couponDiscount, loyaltyPointsUsed, loyaltyDiscount, appliedCoupons } = cart as any;
  // Points earned are based on the final amount paid (after all discounts)
  const loyaltyPointsEarned = Math.floor(total);

  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

  const initialHistory = [{ status: "pending", changedAt: new Date().toISOString() }];
  const [order] = await db.insert(ordersTable).values({
    orderNumber, userId: userId ?? cartItems[0]?.userId ?? null, sessionId,
    subtotal: String(subtotal),
    discount: String(loyaltyDiscount),
    shipping: String(shipping),
    tax: "0",
    total: String(total),
    couponCode: couponCode ?? null,
    couponDiscount: String(couponDiscount),
    loyaltyPointsUsed, loyaltyPointsUsedAmount: loyaltyDiscount.toFixed(2), loyaltyPointsEarned,
    shippingAddress: shippingAddress ?? {}, notes: notes ?? null,
    statusHistory: initialHistory,
  }).returning();

  // Insert order items
  const productIds = cartItems.map(i => i.productId);
  const products = productIds.length > 0
    ? await db.select().from(productsTable).where(
        sql`${productsTable.id} = ANY(ARRAY[${sql.join(productIds.map(id => sql`${id}`), sql`, `)}]::int[])`
      )
    : [];
  const productMap = new Map(products.map(p => [p.id, p]));

  await Promise.all(cartItems.map(async (item) => {
    const p = productMap.get(item.productId);
    if (!p) return;
    const price = parseFloat(p.salePrice ?? p.price);
    await db.insert(orderItemsTable).values({
      orderId: order.id, productId: item.productId,
      productName: p.nameHe, productSku: p.sku ?? null,
      quantity: item.quantity, price: String(price),
      subtotal: String(price * item.quantity),
      costPrice: String(parseFloat(p.costPrice ?? "0")),
      deliveryCost: String(parseFloat(p.deliveryCost ?? "0")),
      itemStatus: "pending",
    });
  }));

  // Update product sales counts and deduct stock
  await Promise.all(cartItems.map(item => {
    const p = productMap.get(item.productId);
    if (!p) return Promise.resolve();
    return db.update(productsTable).set({
      salesCount: p.salesCount + item.quantity,
      stockQuantity: Math.max(0, p.stockQuantity - item.quantity),
    }).where(eq(productsTable.id, item.productId));
  }));

  // Clear cart
  await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
  await db.delete(cartCouponsTable).where(eq(cartCouponsTable.sessionId, sessionId));

  // Loyalty: record earned, deduct used, update user balance; detect tier upgrade
  let tierUpgrade: { from: string; to: string } | null = null;
  if (order.userId) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, order.userId));
    if (user) {
      // Record points earned
      if (loyaltyPointsEarned > 0) {
        await db.insert(loyaltyTransactionsTable).values({
          userId: order.userId, points: loyaltyPointsEarned,
          type: "earned", reason: `הזמנה #${orderNumber}`, orderId: order.id,
        });
      }
      // Record points redeemed (as negative)
      if (loyaltyPointsUsed > 0) {
        await db.insert(loyaltyTransactionsTable).values({
          userId: order.userId, points: -loyaltyPointsUsed,
          type: "redeemed", reason: `מימוש נקודות בהזמנה #${orderNumber}`, orderId: order.id,
        });
      }
      const netPoints = user.loyaltyPoints + loyaltyPointsEarned - loyaltyPointsUsed;
      const newPoints = Math.max(0, netPoints);
      const newSpent = parseFloat(user.totalSpent) + total;
      const oldTier = await getTierBySpent(parseFloat(user.totalSpent));
      const newTier = await getTierBySpent(newSpent);
      tierUpgrade = oldTier !== newTier ? { from: oldTier, to: newTier } : null;
      await db.update(usersTable).set({
        loyaltyPoints: newPoints, loyaltyTier: newTier,
        totalSpent: String(newSpent), ordersCount: user.ordersCount + 1,
      }).where(eq(usersTable.id, order.userId));
    }
  }

  // Record coupon usage for each applied coupon
  const couponsToRecord: string[] = Array.isArray(appliedCoupons) && appliedCoupons.length > 0
    ? appliedCoupons.map((c: any) => c.code)
    : couponCode ? couponCode.split(", ").map((c: string) => c.trim()).filter(Boolean) : [];
  for (const code of couponsToRecord) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, code));
    if (coupon) {
      await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
      await db.insert(couponUsagesTable).values({ couponId: coupon.id, userId: order.userId ?? null, orderId: order.id });
    }
  }

  const serializedItems = await fetchItemsWithProductData(order.id);

  // Send confirmation email (fire-and-forget — does not block response)
  if (order.userId) {
    const [emailUser] = await db.select({ email: usersTable.email, firstName: usersTable.firstName })
      .from(usersTable).where(eq(usersTable.id, order.userId));
    if (emailUser) {
      const emailItems = cartItems.map(ci => {
        const p = productMap.get(ci.productId);
        const price = p ? parseFloat(p.salePrice ?? p.price) : 0;
        return { productName: p?.nameHe ?? "מוצר", quantity: ci.quantity, price, subtotal: price * ci.quantity };
      });
      const orderDate = new Date(order.createdAt).toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" });
      sendOrderConfirmationEmail(
        emailUser.email,
        emailUser.firstName,
        order.orderNumber,
        orderDate,
        emailItems,
        subtotal,
        couponCode ?? null,
        parseFloat(String(couponDiscount)),
        loyaltyPointsUsed,
        loyaltyDiscount,
        shipping,
        total,
        loyaltyPointsEarned,
        shippingAddress as Record<string, string>,
      ).catch(err => console.error("[ORDER EMAIL]", err instanceof Error ? err.message : err));
    }
  }

  res.status(201).json({ ...serializeOrder(order, serializedItems), tierUpgrade });
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [row] = await db
    .select({ order: ordersTable, firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .where(eq(ordersTable.id, id));
  if (!row) {
    res.status(404).json({ error: "הזמנה לא נמצאה" });
    return;
  }
  const items = await fetchItemsWithProductData(id);
  const customerName = (row.firstName || row.lastName)
    ? `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim()
    : null;
  res.json(serializeOrder(row.order, items, customerName));
});

router.patch("/orders/:id/status", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status, notes } = req.body;
  const [current] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!current) { res.status(404).json({ error: "הזמנה לא נמצאה" }); return; }

  // ── Mark all active items as cancelled / refunded ────────────────────────
  const isBecomingTerminal =
    ["cancelled", "refunded"].includes(status) &&
    !["cancelled", "refunded"].includes(current.status);

  if (isBecomingTerminal) {
    const allItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
    const itemCancelledAt = new Date().toISOString();
    const activeItems = allItems.filter(it => !["cancelled", "refunded"].includes(it.itemStatus));

    await Promise.all(
      activeItems.map(it => {
        const hist = (Array.isArray(it.itemStatusHistory) ? it.itemStatusHistory : []) as { status: string; changedAt: string }[];
        return db.update(orderItemsTable)
          .set({
            itemStatus: status as "cancelled" | "refunded",
            itemStatusHistory: [...hist, { status, changedAt: itemCancelledAt }],
          })
          .where(eq(orderItemsTable.id, it.id));
      })
    );

    // ── Restore stock and reverse sales count for newly cancelled items ───────
    if (activeItems.length > 0) {
      const productIds = activeItems.map(it => it.productId);
      const products = await db.select().from(productsTable)
        .where(sql`${productsTable.id} = ANY(ARRAY[${sql.join(productIds.map(pid => sql`${pid}`), sql`, `)}]::int[])`);
      const productMap = new Map(products.map(p => [p.id, p]));
      await Promise.all(activeItems.map(it => {
        const p = productMap.get(it.productId);
        if (!p) return Promise.resolve();
        return db.update(productsTable).set({
          stockQuantity: p.stockQuantity + it.quantity,
          salesCount: Math.max(0, p.salesCount - it.quantity),
        }).where(eq(productsTable.id, it.productId));
      }));
    }
  }

  // ── Loyalty & spent reversal (registered users only) ─────────────────────
  if (isBecomingTerminal && current.userId != null) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, current.userId!));
    if (user) {
      const orderTotal   = parseFloat(current.total);
      const pointsUsed   = current.loyaltyPointsUsed;   // used when buying → refund
      const pointsEarned = current.loyaltyPointsEarned; // earned from order → reverse
      const newSpent     = Math.max(0, parseFloat(user.totalSpent) - orderTotal);
      const newTier      = await getTierBySpent(newSpent);
      const newPoints    = Math.max(0, user.loyaltyPoints + pointsUsed - pointsEarned);

      if (pointsUsed > 0) {
        await db.insert(loyaltyTransactionsTable).values({
          userId: current.userId!, points: pointsUsed,
          type: "earned",
          reason: `זיכוי נקודות ששומשו בהזמנה #${current.orderNumber} (${status === "cancelled" ? "ביטול" : "זיכוי"})`,
          orderId: current.id,
        });
      }
      if (pointsEarned > 0) {
        await db.insert(loyaltyTransactionsTable).values({
          userId: current.userId!, points: -pointsEarned,
          type: "redeemed",
          reason: `ביטול נקודות שנצברו בהזמנה #${current.orderNumber}`,
          orderId: current.id,
        });
      }
      await db.update(usersTable).set({
        loyaltyPoints: newPoints,
        loyaltyTier: newTier,
        totalSpent: String(newSpent),
        ordersCount: Math.max(0, user.ordersCount - 1),
      }).where(eq(usersTable.id, current.userId!));
    }
  }

  const history = (Array.isArray(current.statusHistory) ? current.statusHistory : []) as { status: string; changedAt: string }[];
  const newHistory = [...history, { status, changedAt: new Date().toISOString() }];
  const updateData: Record<string, unknown> = { status, statusHistory: newHistory };
  if (notes !== undefined) updateData.notes = notes;
  const [order] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, id)).returning();
  const items = await fetchItemsWithProductData(id);
  res.json(serializeOrder(order, items));
});

router.patch("/orders/:orderId/items/:itemId/status", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  const itemId = parseInt(req.params.itemId, 10);
  const { itemStatus } = req.body;
  if (!itemStatus) { res.status(400).json({ error: "itemStatus נדרש" }); return; }

  const [current] = await db.select().from(orderItemsTable)
    .where(and(eq(orderItemsTable.id, itemId), eq(orderItemsTable.orderId, orderId)));
  if (!current) { res.status(404).json({ error: "פריט הזמנה לא נמצא" }); return; }

  // ── Partial loyalty & spent reversal on item cancel / refund ─────────────
  const isNewlyCancelled =
    ["cancelled", "refunded"].includes(itemStatus) &&
    !["cancelled", "refunded"].includes(current.itemStatus);

  if (isNewlyCancelled) {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (order && order.userId) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, order.userId));
      if (user) {
        const itemSubtotal  = parseFloat(current.subtotal);
        const orderSubtotal = parseFloat(order.subtotal);
        const orderTotal    = parseFloat(order.total);

        // Proportion of this item relative to the pre-discount subtotal
        const proportion = orderSubtotal > 0 ? itemSubtotal / orderSubtotal : 0;

        // Actual amount this item contributed to the paid total (post-discount)
        const itemPaidValue = proportion * orderTotal;

        // Proportional loyalty points to reverse
        const pointsUsedRefund   = Math.round(order.loyaltyPointsUsed   * proportion);
        const pointsEarnedRevert = Math.round(order.loyaltyPointsEarned * proportion);

        const newPoints = Math.max(0, user.loyaltyPoints + pointsUsedRefund - pointsEarnedRevert);
        const newSpent  = Math.max(0, parseFloat(user.totalSpent) - itemPaidValue);
        const newTier   = await getTierBySpent(newSpent);

        if (pointsUsedRefund > 0) {
          await db.insert(loyaltyTransactionsTable).values({
            userId: order.userId, points: pointsUsedRefund,
            type: "earned",
            reason: `זיכוי נקודות ששומשו עבור פריט #${itemId} בהזמנה #${order.orderNumber}`,
            orderId: order.id,
          });
        }
        if (pointsEarnedRevert > 0) {
          await db.insert(loyaltyTransactionsTable).values({
            userId: order.userId, points: -pointsEarnedRevert,
            type: "redeemed",
            reason: `ביטול נקודות שנצברו עבור פריט #${itemId} בהזמנה #${order.orderNumber}`,
            orderId: order.id,
          });
        }
        await db.update(usersTable).set({
          loyaltyPoints: newPoints,
          loyaltyTier: newTier,
          totalSpent: String(newSpent),
        }).where(eq(usersTable.id, order.userId));
      }
    }

    // ── Restore stock and reverse sales count for this cancelled item ─────────
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, current.productId));
    if (product) {
      await db.update(productsTable).set({
        stockQuantity: product.stockQuantity + current.quantity,
        salesCount: Math.max(0, product.salesCount - current.quantity),
      }).where(eq(productsTable.id, current.productId));
    }
  }

  const history = (Array.isArray(current.itemStatusHistory) ? current.itemStatusHistory : []) as { status: string; changedAt: string }[];
  const newHistory = [...history, { status: itemStatus, changedAt: new Date().toISOString() }];
  const [item] = await db.update(orderItemsTable)
    .set({ itemStatus, itemStatusHistory: newHistory })
    .where(and(eq(orderItemsTable.id, itemId), eq(orderItemsTable.orderId, orderId)))
    .returning();
  res.json({ ...item, price: parseFloat(item.price), subtotal: parseFloat(item.subtotal), createdAt: item.createdAt.toISOString() });
});

export default router;

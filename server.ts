import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.ts";
import { subscribers, scanLogs, settings, pushSubscriptions, payments } from "./src/db/schema.ts";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "./src/middleware/auth.ts";
import { appendSubscriberToSheet } from "./src/services/googleSheets.ts";
import admin from 'firebase-admin';
import { CLASS_RULES as DEFAULT_CLASS_RULES } from "./src/domain/entities/subscriber.ts";
import webpush from 'web-push';

// Initialize firebase admin without credentials for now (this will fail if they try to send real messages, so we catch it)
try {
  admin.initializeApp();
} catch (e) {
  console.log('Firebase admin already initialized or missing credentials');
}

let adminFcmToken: string | null = null;

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Initialize Web Push VAPID Keys
  let vapidKeys = { publicKey: '', privateKey: '' };
  try {
    const pubKeySetting = await db.select().from(settings).where(eq(settings.key, 'vapidPublicKey'));
    const privKeySetting = await db.select().from(settings).where(eq(settings.key, 'vapidPrivateKey'));

    if (pubKeySetting.length === 0 || privKeySetting.length === 0) {
      vapidKeys = webpush.generateVAPIDKeys();
      await db.insert(settings).values({ key: 'vapidPublicKey', value: vapidKeys.publicKey }).onConflictDoUpdate({ target: settings.key, set: { value: vapidKeys.publicKey } });
      await db.insert(settings).values({ key: 'vapidPrivateKey', value: vapidKeys.privateKey }).onConflictDoUpdate({ target: settings.key, set: { value: vapidKeys.privateKey } });
    } else {
      vapidKeys.publicKey = pubKeySetting[0].value;
      vapidKeys.privateKey = privKeySetting[0].value;
    }

    webpush.setVapidDetails(
      'mailto:admin@fliplab.local',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
    console.log('Web Push VAPID keys loaded successfully.');
  } catch (err) {
    console.error('Failed to initialize Web Push VAPID keys:', err);
  }

  // Increase payload limit for base64 images
  app.use(express.json({ limit: "50mb" }));

  // API Routes

  // Public route to submit a form
  app.post("/api/subscribers", async (req, res) => {
    try {
      const data = req.body;
      const result = await db.insert(subscribers).values({
        fullName: data.fullName,
        age: data.age,
        gender: data.gender,
        guardianName: data.guardianName,
        whatsappNumber: data.whatsappNumber,
        previousExperience: data.previousExperience,
        classType: data.classType,
        packageType: data.packageType,
        receiptImageBase64: data.receiptImageBase64,
      }).returning({ id: subscribers.id });

      const subscriberId = result[0].id;

      // Send to Google Sheets
      await appendSubscriberToSheet({
        date: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        id: subscriberId,
        fullName: data.fullName,
        age: data.age,
        gender: data.gender,
        whatsappNumber: data.whatsappNumber,
        classType: data.classType,
        packageType: data.packageType,
      });

      // Send Web Push Notification to all admins
      try {
        const subs = await db.select().from(pushSubscriptions);
        const payload = JSON.stringify({
          title: 'New Registration! 🎉',
          body: `${data.fullName} registered for ${data.classType} (${data.packageType})`
        });

        await Promise.all(subs.map(async (sub) => {
          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            }, payload);
          } catch (e: any) {
            if (e.statusCode === 410 || e.statusCode === 404) {
              // Subscription has expired or is no longer valid, delete it
              await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
            } else {
              console.error('Push notification failed for a subscriber:', e);
            }
          }
        }));
        console.log("Web Push notifications dispatched to admins.");
      } catch (e: any) {
        console.error("Failed to fetch subscriptions or dispatch web push:", e.message);
      }

      res.json({ success: true, id: subscriberId });
    } catch (error: any) {
      console.error("Database query failed:", error);
      res.status(500).json({ error: "Failed to submit subscription", details: error.message });
    }
  });

  // Web Push routes
  app.get("/api/push/public-key", (req, res) => {
    try {
      res.json({ publicKey: vapidKeys.publicKey });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/push/subscribe", requireAuth, async (req, res) => {
    try {
      const subscription = req.body;
      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: "Invalid subscription" });
      }

      // Save subscription to DB
      await db.insert(pushSubscriptions).values({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      });

      console.log("New Web Push subscription added.");
      res.json({ success: true });
    } catch (e: any) {
      console.error("Failed to save push subscription:", e);
      res.status(500).json({ error: "Failed to subscribe", details: e.message });
    }
  });

  // Protected route: Get all subscribers
  app.get("/api/subscribers", requireAuth, async (req, res) => {
    try {
      const result = await db.select().from(subscribers);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch subscribers" });
    }
  });

  // Protected route: Get single subscriber
  app.get("/api/subscribers/:id", requireAuth, async (req, res) => {
    try {
      const result = await db.select().from(subscribers).where(eq(subscribers.id, req.params.id));
      if (result.length === 0) {
        return res.status(404).json({ error: "Subscriber not found" });
      }
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch subscriber" });
    }
  });

  // Protected route: Verify subscriber
  app.put("/api/subscribers/:id/verify", requireAuth, async (req, res) => {
    try {
      const sub = await db.select().from(subscribers).where(eq(subscribers.id, req.params.id));
      if (sub.length === 0) return res.status(404).json({ error: "Subscriber not found" });
      const subscriber = sub[0];

      const result = await db.update(subscribers)
        .set({ isVerified: true })
        .where(eq(subscribers.id, req.params.id))
        .returning();

      // Fetch class rules for pricing
      const settingsResult = await db.select().from(settings).where(eq(settings.key, 'CLASS_RULES'));
      let currentRules = DEFAULT_CLASS_RULES;
      if (settingsResult.length > 0) {
        try { currentRules = JSON.parse(settingsResult[0].value); } catch (e) { }
      }
      const subClassRules = currentRules[subscriber.classType as keyof typeof currentRules];
      const price = subClassRules?.packages?.[subscriber.packageType as 'Monthly' | 'Trial']?.price || 0;

      // Log payment
      if (price > 0) {
        await db.insert(payments).values({
          subscriberId: subscriber.id,
          amount: price,
          type: 'Registration'
        });
      }

      res.json({ success: true, subscriber: result[0] });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to verify subscriber" });
    }
  });

  // Protected route: Renew subscriber
  app.put("/api/subscribers/:id/renew", requireAuth, async (req, res) => {
    try {
      const sub = await db.select().from(subscribers).where(eq(subscribers.id, req.params.id));
      if (sub.length === 0) return res.status(404).json({ error: "Subscriber not found" });
      const subscriber = sub[0];

      const activeUntil = new Date();
      activeUntil.setDate(activeUntil.getDate() + 30); // Add 30 days

      const result = await db.update(subscribers)
        .set({ isVerified: true, activeUntil: activeUntil.toISOString(), expiryNotificationSent: false })
        .where(eq(subscribers.id, req.params.id))
        .returning();

      // Log payment
      const settingsResult = await db.select().from(settings).where(eq(settings.key, 'CLASS_RULES'));
      let currentRules = DEFAULT_CLASS_RULES;
      if (settingsResult.length > 0) { try { currentRules = JSON.parse(settingsResult[0].value); } catch (e) { } }
      const subClassRules = currentRules[subscriber.classType as keyof typeof currentRules];
      const price = subClassRules?.packages?.Monthly?.price || 0;

      if (price > 0) {
        await db.insert(payments).values({
          subscriberId: subscriber.id,
          amount: price,
          type: 'Renew 30 Days'
        });
      }

      res.json({ success: true, subscriber: result[0] });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to renew subscriber" });
    }
  });

  // Protected route: Renew session
  app.put("/api/subscribers/:id/renew-session", requireAuth, async (req, res) => {
    try {
      const sub = await db.select().from(subscribers).where(eq(subscribers.id, req.params.id));
      if (sub.length === 0) return res.status(404).json({ error: "Subscriber not found" });
      const subscriber = sub[0];

      // Fetch class rules
      const settingsResult = await db.select().from(settings).where(eq(settings.key, 'CLASS_RULES'));
      let currentRules = DEFAULT_CLASS_RULES;
      if (settingsResult.length > 0) {
        try { currentRules = JSON.parse(settingsResult[0].value); } catch (e) { }
      }

      const subClassRules = currentRules[subscriber.classType as keyof typeof currentRules];

      let targetDate = new Date();
      if (subClassRules && subClassRules.allowedDays) {
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          if (subClassRules.allowedDays.includes(d.getDay())) {
            targetDate = d;
            break;
          }
        }
      } else {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      targetDate.setHours(23, 59, 59, 999);

      const result = await db.update(subscribers)
        .set({ isVerified: true, activeUntil: targetDate.toISOString(), expiryNotificationSent: false })
        .where(eq(subscribers.id, req.params.id))
        .returning();

      const price = subClassRules?.packages?.Trial?.price || 0;
      if (price > 0) {
        await db.insert(payments).values({
          subscriberId: subscriber.id,
          amount: price,
          type: 'Renew 1 Session'
        });
      }

      res.json({ success: true, subscriber: result[0] });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to renew session" });
    }
  });

  // Protected route: Update subscriber
  app.put("/api/subscribers/:id", requireAuth, async (req, res) => {
    try {
      const data = req.body;
      const result = await db.update(subscribers)
        .set({
          fullName: data.fullName,
          age: data.age,
          gender: data.gender,
          guardianName: data.guardianName,
          whatsappNumber: data.whatsappNumber,
          previousExperience: data.previousExperience,
          classType: data.classType,
          packageType: data.packageType,
          isVerified: data.isVerified,
          activeUntil: data.activeUntil,
          expiryNotificationSent: false,
        })
        .where(eq(subscribers.id, req.params.id))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: "Subscriber not found" });
      }
      res.json({ success: true, subscriber: result[0] });
    } catch (error: any) {
      console.error("Failed to update subscriber:", error);
      res.status(500).json({ error: "Failed to update subscriber" });
    }
  });

  // Protected route: Delete a subscriber
  app.delete("/api/subscribers/:id", requireAuth, async (req, res) => {
    try {
      // Also delete associated scan logs to maintain referential integrity
      await db.delete(scanLogs).where(eq(scanLogs.subscriberId, req.params.id));
      await db.delete(payments).where(eq(payments.subscriberId, req.params.id));

      const result = await db.delete(subscribers)
        .where(eq(subscribers.id, req.params.id))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: "Subscriber not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete subscriber:", error);
      res.status(500).json({ error: "Failed to delete subscriber" });
    }
  });

  // Protected route: Log a scan (check-in)
  app.post("/api/scan", requireAuth, async (req, res) => {
    try {
      const { subscriberId } = req.body;
      const subResult = await db.select().from(subscribers).where(eq(subscribers.id, subscriberId));
      if (subResult.length === 0) {
        return res.status(404).json({ error: "Subscriber not found" });
      }

      const subscriber = subResult[0];

      // Fetch class rules
      const settingsResult = await db.select().from(settings).where(eq(settings.key, 'CLASS_RULES'));
      let currentRules = DEFAULT_CLASS_RULES;
      if (settingsResult.length > 0) {
        try {
          currentRules = JSON.parse(settingsResult[0].value);
        } catch (e) { }
      }

      const subClassRules = currentRules[subscriber.classType as keyof typeof currentRules];

      if (subClassRules && subClassRules.allowedDays && subClassRules.startTime && subClassRules.endTime) {
        const now = new Date();
        const currentDay = now.getDay();

        if (!subClassRules.allowedDays.includes(currentDay)) {
          return res.status(400).json({ error: `Not your class day. Your class schedule is: ${subClassRules.schedule}` });
        }

        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const [startH, startM] = subClassRules.startTime.split(':').map(Number);
        const [endH, endM] = subClassRules.endTime.split(':').map(Number);

        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        // 30 min grace period before and after
        if (currentMinutes < startMinutes - 30 || currentMinutes > endMinutes + 30) {
          return res.status(400).json({ error: `Wrong time. Your class time is: ${subClassRules.schedule}` });
        }
      }

      // Check if already scanned today
      const latestScan = await db.select()
        .from(scanLogs)
        .where(eq(scanLogs.subscriberId, subscriberId))
        .orderBy(desc(scanLogs.scannedAt))
        .limit(1);

      if (latestScan.length > 0) {
        // SQLite CURRENT_TIMESTAMP is UTC (YYYY-MM-DD HH:MM:SS)
        // Convert to Date object, appending 'Z' to explicitly mark as UTC
        const lastScanDate = new Date(latestScan[0].scannedAt.replace(' ', 'T') + 'Z');
        const todayDate = new Date();

        if (lastScanDate.toDateString() === todayDate.toDateString()) {
          return res.status(400).json({ error: "Subscriber already scanned today" });
        }
      }

      const scanResult = await db.insert(scanLogs).values({
        subscriberId,
      }).returning();

      res.json({ success: true, subscriber: subResult[0], scanLog: scanResult[0] });
    } catch (error: any) {
      console.error("Failed to log scan:", error);
      res.status(500).json({ error: "Failed to log scan" });
    }
  });

  // Protected route: Get all scan logs
  app.get("/api/scans", requireAuth, async (req, res) => {
    try {
      const result = await db.select({
        id: scanLogs.id,
        subscriberId: scanLogs.subscriberId,
        scannedAt: scanLogs.scannedAt,
        subscriberName: subscribers.fullName,
        subscriberClass: subscribers.classType,
        subscriberPackage: subscribers.packageType,
        subscriberRegistrationDate: subscribers.createdAt,
      })
        .from(scanLogs)
        .leftJoin(subscribers, eq(scanLogs.subscriberId, subscribers.id))
        .orderBy(desc(scanLogs.scannedAt));

      res.json(result);
    } catch (error: any) {
      console.error("Failed to fetch scan logs:", error);
      res.status(500).json({ error: "Failed to fetch scan logs" });
    }
  });

  // Protected route: Delete a scan log
  app.delete("/api/scans/:id", requireAuth, async (req, res) => {
    try {
      const result = await db.delete(scanLogs)
        .where(eq(scanLogs.id, req.params.id))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: "Scan log not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete scan log:", error);
      res.status(500).json({ error: "Failed to delete scan log" });
    }
  });

  // Protected route: Update a scan log
  app.put("/api/scans/:id", requireAuth, async (req, res) => {
    try {
      const { scannedAt } = req.body;
      const result = await db.update(scanLogs)
        .set({ scannedAt })
        .where(eq(scanLogs.id, req.params.id))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: "Scan log not found" });
      }
      res.json({ success: true, scanLog: result[0] });
    } catch (error: any) {
      console.error("Failed to update scan log:", error);
      res.status(500).json({ error: "Failed to update scan log" });
    }
  });

  // Public route: Get class settings
  app.get("/api/settings/classes", async (req, res) => {
    try {
      const result = await db.select().from(settings).where(eq(settings.key, 'CLASS_RULES'));
      if (result.length === 0) {
        // Return defaults if not found
        return res.json(DEFAULT_CLASS_RULES);
      }
      res.json(JSON.parse(result[0].value));
    } catch (error: any) {
      console.error("Failed to fetch settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Protected route: Update class settings
  app.put("/api/settings/classes", requireAuth, async (req, res) => {
    try {
      const rules = req.body;
      const jsonValue = JSON.stringify(rules);

      const existing = await db.select().from(settings).where(eq(settings.key, 'CLASS_RULES'));

      if (existing.length === 0) {
        await db.insert(settings).values({ key: 'CLASS_RULES', value: jsonValue });
      } else {
        await db.update(settings).set({ value: jsonValue, updatedAt: new Date().toISOString() }).where(eq(settings.key, 'CLASS_RULES'));
      }

      res.json({ success: true, rules });
    } catch (error: any) {
      console.error("Failed to update settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Protected route: Get finance logs
  app.get("/api/finance", requireAuth, async (req, res) => {
    try {
      const result = await db.select({
        id: payments.id,
        subscriberId: payments.subscriberId,
        amount: payments.amount,
        type: payments.type,
        date: payments.date,
        subscriberName: subscribers.fullName,
        subscriberClass: subscribers.classType,
      })
        .from(payments)
        .leftJoin(subscribers, eq(payments.subscriberId, subscribers.id))
        .orderBy(desc(payments.date));

      res.json(result);
    } catch (error: any) {
      console.error("Failed to fetch finance logs:", error);
      res.status(500).json({ error: "Failed to fetch finance logs" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist', 'client');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Background Job: Expiry Notifications
  setInterval(async () => {
    try {
      const now = new Date();
      const allSubs = await db.select().from(subscribers);
      for (const sub of allSubs) {
        if (sub.activeUntil && sub.isVerified && !sub.expiryNotificationSent) {
          if (new Date(sub.activeUntil) < now) {
            // Expired!
            const subs = await db.select().from(pushSubscriptions);
            const payload = JSON.stringify({
              title: 'اشتراك منتهي ⚠️',
              body: `انتهى اشتراك ${sub.fullName} (${sub.classType})`
            });
            await Promise.all(subs.map(async (pSub) => {
              try {
                await webpush.sendNotification({ endpoint: pSub.endpoint, keys: { p256dh: pSub.p256dh, auth: pSub.auth } }, payload);
              } catch (e: any) {
                if (e.statusCode === 410 || e.statusCode === 404) {
                  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, pSub.id));
                }
              }
            }));
            // Mark as sent
            await db.update(subscribers).set({ expiryNotificationSent: true }).where(eq(subscribers.id, sub.id));
            console.log(`Sent expiry notification for ${sub.fullName}`);
          }
        }
      }
    } catch (err) {
      console.error("Expiry check job failed:", err);
    }
  }, 10 * 60 * 1000); // Check every 10 minutes

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);

import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import QRCode from "qrcode";
import { createStorage } from "./storage.js";
import {
  gameDefinition,
  getPublicGameDefinition,
  getSolution
} from "./game-definition.js";

const app = express();
const port = process.env.PORT || 3000;
const storage = createStorage();
const trainerKey = process.env.TRAINER_KEY || "";

app.use(express.json({ limit: "100kb" }));
app.use(express.static("public", { extensions: ["html"] }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, storage: storage.constructor.name });
});

app.get("/api/config", (req, res) => {
  res.json(getPublicGameDefinition());
});

app.get("/api/solution", requireTrainer, (req, res) => {
  res.json({ solution: getSolution() });
});

app.get("/api/qr", async (req, res, next) => {
  try {
    const text = String(req.query.text || "");
    if (!text) {
      res.status(400).json({ error: "Missing text query parameter." });
      return;
    }

    const svg = await QRCode.toString(text, {
      type: "svg",
      margin: 1,
      color: { dark: "#102a43", light: "#ffffff" }
    });
    res.type("image/svg+xml").send(svg);
  } catch (error) {
    next(error);
  }
});

app.get("/api/sessions", requireTrainer, async (req, res, next) => {
  try {
    const sessions = await storage.listSessions();
    res.json({ sessions: sessions.map(publicSession) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/sessions", requireTrainer, async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const sessionId = createSessionCode();
    const session = {
      id: `session:${sessionId}`,
      sessionId,
      title: sanitizeText(req.body?.title, 80) || `AZ-104 group ${sessionId}`,
      createdAt: now,
      updatedAt: now,
      resetAt: null,
      active: true
    };
    await storage.createSession(session);
    res.status(201).json({ session: publicSession(session) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/sessions/:sessionId", async (req, res, next) => {
  try {
    const session = await requireSession(req.params.sessionId);
    const submissions = await storage.listSubmissions(session.sessionId);
    res.json({
      session: publicSession(session),
      submissionCount: submissions.length
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/sessions/:sessionId/reset", requireTrainer, async (req, res, next) => {
  try {
    const session = await requireSession(req.params.sessionId);
    await storage.clearSubmissions(session.sessionId);
    const updated = {
      ...session,
      updatedAt: new Date().toISOString(),
      resetAt: new Date().toISOString()
    };
    await storage.upsertSession(updated);
    res.json({ session: publicSession(updated), submissionCount: 0 });
  } catch (error) {
    next(error);
  }
});

app.post("/api/sessions/:sessionId/submissions", async (req, res, next) => {
  try {
    const session = await requireSession(req.params.sessionId);
    const participantName = sanitizeText(req.body?.participantName, 48);
    const placements = validatePlacements(req.body?.placements);

    if (!participantName) {
      res.status(400).json({ error: "Participant name is required." });
      return;
    }

    const participantId =
      sanitizeText(req.body?.participantId, 64) || crypto.randomUUID();
    const now = new Date().toISOString();
    const submission = {
      id: `submission:${session.sessionId}:${participantId}`,
      sessionId: session.sessionId,
      participantId,
      participantName,
      placements,
      createdAt: now,
      updatedAt: now
    };

    await storage.saveSubmission(submission);
    const submissions = await storage.listSubmissions(session.sessionId);
    res.status(201).json({
      participantId,
      submissionCount: submissions.length,
      message: "Submission saved."
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/sessions/:sessionId/recap", requireTrainer, async (req, res, next) => {
  try {
    const session = await requireSession(req.params.sessionId);
    const submissions = await storage.listSubmissions(session.sessionId);
    res.json({
      session: publicSession(session),
      submissionCount: submissions.length,
      participants: submissions.map((submission) => ({
        participantId: submission.participantId,
        participantName: submission.participantName,
        placements: submission.placements || {},
        updatedAt: submission.updatedAt || submission.createdAt
      })),
      consensus: buildConsensus(submissions),
      solution: getSolution()
    });
  } catch (error) {
    next(error);
  }
});

app.get(["/join", "/j", "/trainer", "/play/:sessionId", "/recap/:sessionId"], (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.use((error, req, res, next) => {
  const status = error.status || 500;
  if (status >= 500) {
    console.error(error);
  }
  res.status(status).json({ error: error.message || "Server error." });
});

app.listen(port, () => {
  console.log(`AZ-104 placement game running on http://localhost:${port}`);
});

function requireTrainer(req, res, next) {
  if (!trainerKey) {
    next();
    return;
  }

  const suppliedKey =
    req.header("x-trainer-key") ||
    req.query.trainerKey ||
    req.body?.trainerKey;

  if (suppliedKey === trainerKey) {
    next();
    return;
  }

  res.status(401).json({ error: "Trainer key required." });
}

async function requireSession(rawSessionId) {
  const sessionId = sanitizeSessionId(rawSessionId);
  const session = await storage.getSession(sessionId);
  if (!session) {
    const error = new Error("Session not found.");
    error.status = 404;
    throw error;
  }
  return session;
}

function createSessionCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function publicSession(session) {
  return {
    sessionId: session.sessionId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    resetAt: session.resetAt,
    active: session.active
  };
}

function sanitizeSessionId(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 24);
}

function sanitizeText(value, maxLength) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function validatePlacements(input) {
  const validSlotIds = new Set(gameDefinition.slots.map((slot) => slot.id));
  const validServiceIds = new Set(gameDefinition.services.map((service) => service.id));
  const placements = {};

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return placements;
  }

  for (const [slotId, serviceId] of Object.entries(input)) {
    if (validSlotIds.has(slotId) && validServiceIds.has(serviceId)) {
      placements[slotId] = serviceId;
    }
  }

  return placements;
}

function buildConsensus(submissions) {
  const serviceById = new Map(
    gameDefinition.services.map((service) => [service.id, service])
  );

  return gameDefinition.slots.map((slot) => {
    const counts = {};

    for (const submission of submissions) {
      const serviceId = submission.placements?.[slot.id];
      if (serviceId) {
        counts[serviceId] = (counts[serviceId] || 0) + 1;
      }
    }

    const choices = Object.entries(counts)
      .map(([serviceId, count]) => ({
        serviceId,
        serviceName: serviceById.get(serviceId)?.shortName || serviceId,
        count,
        percentage: submissions.length
          ? Math.round((count / submissions.length) * 100)
          : 0
      }))
      .sort((a, b) => b.count - a.count || a.serviceName.localeCompare(b.serviceName));

    const topChoice = choices[0] || null;

    return {
      slotId: slot.id,
      slotLabel: slot.label,
      correctServiceId: slot.correctServiceId,
      topChoice,
      choices
    };
  });
}

import { promises as fs } from "node:fs";
import path from "node:path";

const localDataPath = path.join(process.cwd(), ".data", "local-db.json");

export function createStorage() {
  if (process.env.COSMOS_ENDPOINT && process.env.COSMOS_KEY) {
    return new CosmosStorage();
  }

  return new LocalStorage();
}

class CosmosStorage {
  constructor() {
    const databaseId = process.env.COSMOS_DATABASE_ID || "az104-placement-game";
    const containerId = process.env.COSMOS_CONTAINER_ID || "sessions";

    this.databaseId = databaseId;
    this.containerId = containerId;
    this.container = null;
  }

  async getContainer() {
    if (!this.container) {
      const { CosmosClient } = await import("@azure/cosmos");
      const client = new CosmosClient({
        endpoint: process.env.COSMOS_ENDPOINT,
        key: process.env.COSMOS_KEY
      });
      this.container = client.database(this.databaseId).container(this.containerId);
    }

    return this.container;
  }

  async createSession(session) {
    const container = await this.getContainer();
    await container.items.create({ ...session, type: "session" });
    return session;
  }

  async getSession(sessionId) {
    const container = await this.getContainer();
    const { resource } = await container
      .item(`session:${sessionId}`, sessionId)
      .read();
    return resource || null;
  }

  async listSessions() {
    const querySpec = {
      query: "SELECT * FROM c WHERE c.type = @type ORDER BY c.createdAt DESC",
      parameters: [{ name: "@type", value: "session" }]
    };
    const container = await this.getContainer();
    const { resources } = await container.items.query(querySpec).fetchAll();
    return resources;
  }

  async upsertSession(session) {
    const container = await this.getContainer();
    await container.items.upsert({ ...session, type: "session" });
    return session;
  }

  async saveSubmission(submission) {
    const container = await this.getContainer();
    await container.items.upsert({ ...submission, type: "submission" });
    return submission;
  }

  async listSubmissions(sessionId) {
    const querySpec = {
      query: "SELECT * FROM c WHERE c.type = @type AND c.sessionId = @sessionId ORDER BY c.createdAt ASC",
      parameters: [
        { name: "@type", value: "submission" },
        { name: "@sessionId", value: sessionId }
      ]
    };
    const container = await this.getContainer();
    const { resources } = await container.items
      .query(querySpec, { partitionKey: sessionId })
      .fetchAll();
    return resources;
  }

  async clearSubmissions(sessionId) {
    const submissions = await this.listSubmissions(sessionId);
    const container = await this.getContainer();
    await Promise.all(
      submissions.map((submission) =>
        container.item(submission.id, sessionId).delete()
      )
    );
  }

  async deleteSession(sessionId) {
    const container = await this.getContainer();
    await this.clearSubmissions(sessionId);
    await container.item(`session:${sessionId}`, sessionId).delete();
  }
}

class LocalStorage {
  async readDb() {
    try {
      const raw = await fs.readFile(localDataPath, "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      return { sessions: [], submissions: [] };
    }
  }

  async writeDb(db) {
    await fs.mkdir(path.dirname(localDataPath), { recursive: true });
    await fs.writeFile(localDataPath, JSON.stringify(db, null, 2));
  }

  async createSession(session) {
    const db = await this.readDb();
    db.sessions = db.sessions.filter((item) => item.id !== session.id);
    db.sessions.unshift(session);
    await this.writeDb(db);
    return session;
  }

  async getSession(sessionId) {
    const db = await this.readDb();
    return db.sessions.find((session) => session.sessionId === sessionId) || null;
  }

  async listSessions() {
    const db = await this.readDb();
    return db.sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async upsertSession(session) {
    const db = await this.readDb();
    db.sessions = db.sessions.filter((item) => item.id !== session.id);
    db.sessions.unshift(session);
    await this.writeDb(db);
    return session;
  }

  async saveSubmission(submission) {
    const db = await this.readDb();
    db.submissions = db.submissions.filter((item) => item.id !== submission.id);
    db.submissions.push(submission);
    await this.writeDb(db);
    return submission;
  }

  async listSubmissions(sessionId) {
    const db = await this.readDb();
    return db.submissions
      .filter((submission) => submission.sessionId === sessionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async clearSubmissions(sessionId) {
    const db = await this.readDb();
    db.submissions = db.submissions.filter(
      (submission) => submission.sessionId !== sessionId
    );
    await this.writeDb(db);
  }

  async deleteSession(sessionId) {
    const db = await this.readDb();
    db.sessions = db.sessions.filter((session) => session.sessionId !== sessionId);
    db.submissions = db.submissions.filter(
      (submission) => submission.sessionId !== sessionId
    );
    await this.writeDb(db);
  }
}

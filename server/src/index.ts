import "dotenv/config";
import cors from "cors";
import express from "express";
import http from "node:http";
import path from "node:path";
import { existsSync } from "node:fs";
import { Server } from "socket.io";
import { z } from "zod";
import {
  acknowledgeCard,
  createSession,
  finalizeVoting,
  getPrivateCard,
  getPublicStateByCode,
  impostorGuess,
  joinSession,
  leaveSession,
  nextRound,
  openVoting,
  removePlayer,
  resetGame,
  startGame,
  submitVote,
  updateLobbySettings
} from "./gameEngine.js";
import { Category } from "@prisma/client";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const createSchema = z.object({
  hostUsername: z.string().max(20).optional().default(""),
  impostorCount: z.number().min(1).max(3),
  selectedCategories: z.array(z.nativeEnum(Category)).min(1),
  hintEnabled: z.boolean(),
  impostorsKnowEachOther: z.boolean()
});
app.post("/api/session/create", async (req, res) => {
  try {
    const parsed = createSchema.parse(req.body);
    const out = await createSession(parsed);
    res.json(out);
  } catch (e) {
    res.status(400).json({ message: (e as Error).message });
  }
});

app.post("/api/session/join", async (req, res) => {
  try {
    const parsed = z.object({ code: z.string().length(6), username: z.string().max(20).optional().default("") }).parse(req.body);
    const out = await joinSession(parsed.code, parsed.username);
    res.json(out);
  } catch (e) {
    res.status(400).json({ message: (e as Error).message });
  }
});

app.get("/api/session/:code/state", async (req, res) => {
  try {
    const state = await getPublicStateByCode(req.params.code);
    res.json(state);
  } catch (e) {
    res.status(404).json({ message: (e as Error).message });
  }
});

app.get("/api/player/:sessionPlayerId/card", async (req, res) => {
  try {
    const card = await getPrivateCard(req.params.sessionPlayerId);
    res.json(card);
  } catch (e) {
    res.status(400).json({ message: (e as Error).message });
  }
});

const clientDistPath = process.env.CLIENT_DIST_PATH ?? path.resolve(process.cwd(), "..", "client", "dist");
if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("session:watch", async ({ code }: { code: string }) => {
    socket.join(code);
    const state = await getPublicStateByCode(code);
    io.to(code).emit("session:state", state);
  });

  socket.on("session:leave", async ({ sessionPlayerId, code }) => {
    try {
      const result = await leaveSession(sessionPlayerId);
      socket.leave(code);
      if (!result || result.deleted) {
        io.to(code).emit("session:closed", { code });
        return;
      }
      io.to(code).emit("session:state", await getPublicStateByCode(code));
    } catch (e) {
      socket.emit("session:error", { message: (e as Error).message });
    }
  });

  socket.on("session:kick", async ({ hostSessionPlayerId, targetSessionPlayerId, code }) => {
    try {
      await removePlayer(hostSessionPlayerId, targetSessionPlayerId);
      io.to(code).emit("session:state", await getPublicStateByCode(code));
    } catch (e) {
      socket.emit("session:error", { message: (e as Error).message });
    }
  });

  socket.on("session:update-settings", async ({ hostSessionPlayerId, code, settings }) => {
    try {
      await updateLobbySettings(hostSessionPlayerId, settings);
      io.to(code).emit("session:state", await getPublicStateByCode(code));
    } catch (e) {
      socket.emit("session:error", { message: (e as Error).message });
    }
  });

  socket.on("game:start", async ({ hostSessionPlayerId, code }) => {
    try {
      await startGame(hostSessionPlayerId);
      io.to(code).emit("session:state", await getPublicStateByCode(code));
    } catch (e) {
      socket.emit("session:error", { message: (e as Error).message });
    }
  });

  socket.on("card:acknowledge", async ({ sessionPlayerId, code }) => {
    await acknowledgeCard(sessionPlayerId);
    io.to(code).emit("session:state", await getPublicStateByCode(code));
  });

  socket.on("vote:start", async ({ hostSessionPlayerId, code }) => {
    try {
      await openVoting(hostSessionPlayerId);
      io.to(code).emit("session:state", await getPublicStateByCode(code));
    } catch (e) {
      socket.emit("session:error", { message: (e as Error).message });
    }
  });

  socket.on("vote:submit", async ({ voterId, targetId, code }) => {
    try {
      await submitVote(voterId, targetId);
      io.to(code).emit("session:state", await getPublicStateByCode(code));
    } catch (e) {
      socket.emit("session:error", { message: (e as Error).message });
    }
  });

  socket.on("vote:finalize", async ({ hostSessionPlayerId, code }) => {
    try {
      const result = await finalizeVoting(hostSessionPlayerId);
      io.to(code).emit("round:result", result);
      if (result.winner) {
        io.to(code).emit("game:result", { winner: result.winner });
      }
      io.to(code).emit("session:state", await getPublicStateByCode(code));
    } catch (e) {
      socket.emit("session:error", { message: (e as Error).message });
    }
  });

  socket.on("impostor:guess", async ({ sessionPlayerId, guessedWord, code }) => {
    try {
      const result = await impostorGuess(sessionPlayerId, guessedWord);
      io.to(code).emit("impostor:guess:result", { sessionPlayerId, ...result });
      if (result.isCorrect) {
        io.to(code).emit("game:result", { winner: "IMPOSTORS" });
      }
      io.to(code).emit("session:state", await getPublicStateByCode(code));
    } catch (e) {
      socket.emit("session:error", { message: (e as Error).message });
    }
  });

  socket.on("round:next", async ({ hostSessionPlayerId, code }) => {
    try {
      await nextRound(hostSessionPlayerId);
      io.to(code).emit("session:state", await getPublicStateByCode(code));
    } catch (e) {
      socket.emit("session:error", { message: (e as Error).message });
    }
  });

  socket.on("game:reset", async ({ hostSessionPlayerId, code }) => {
    try {
      await resetGame(hostSessionPlayerId);
      io.to(code).emit("session:state", await getPublicStateByCode(code));
    } catch (e) {
      socket.emit("session:error", { message: (e as Error).message });
    }
  });
});

const port = Number(process.env.PORT ?? 3001);
server.listen(port, () => {
  console.log(`Server listening on ${port}`);
});

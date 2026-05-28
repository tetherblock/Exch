// backend/src/index.ts
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server as SocketServer } from "socket.io";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

import authRouter from "./routes/auth";
import offersRouter from "./routes/offers";
import dealsRouter from "./routes/deals";
import adminRouter from "./routes/admin";
import { setupChat } from "./socket/chat";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";

dotenv.config();

export const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);

// Socket.IO с CORS
export const io = new SocketServer(server, {
  cors: { origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true },
});

// ─── Middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(requestLogger); // Логируем все запросы

// Rate limiter: 100 запросов/минуту на IP
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true }));

// ─── Routes ───────────────────────────────────────────────────
app.use("/api/auth",   authRouter);
app.use("/api/offers", offersRouter);
app.use("/api/deals",  dealsRouter);
app.use("/api/admin",  adminRouter);

// Статические файлы (загруженные доказательства)
app.use("/uploads", express.static("uploads"));

app.use(errorHandler);

// ─── WebSocket ────────────────────────────────────────────────
setupChat(io);

// ─── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

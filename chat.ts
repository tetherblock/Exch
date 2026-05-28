// backend/src/socket/chat.ts
// Realtime-чат внутри сделки через Socket.IO
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "../index";

export function setupChat(io: Server) {
  // Middleware: проверяем JWT при подключении
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Не авторизован"));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
      (socket as any).userId = payload.userId;
      (socket as any).role   = payload.role;

      // Администраторы входят в специальную комнату
      if (payload.role === "ADMIN") socket.join("admins");
      next();
    } catch {
      next(new Error("Токен недействителен"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId as string;
    const role   = (socket as any).role   as string;

    console.log(`[WS] Connected: ${userId} (${role})`);

    // ─── Вход в комнату сделки ───────────────────────────────
    socket.on("deal:join", async ({ dealId }: { dealId: string }) => {
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      if (!deal) return socket.emit("error", "Сделка не найдена");

      // Доступ — только участники или админ
      if (deal.buyerId !== userId && deal.sellerId !== userId && role !== "ADMIN") {
        return socket.emit("error", "Нет доступа к этой сделке");
      }

      socket.join(`deal:${dealId}`);
      socket.emit("deal:joined", { dealId });
    });

    // ─── Отправка сообщения ──────────────────────────────────
    socket.on("message:send", async ({ dealId, content }: { dealId: string; content: string }) => {
      if (!content?.trim()) return;
      if (content.length > 2000) return socket.emit("error", "Сообщение слишком длинное");

      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      if (!deal) return socket.emit("error", "Сделка не найдена");
      if (deal.buyerId !== userId && deal.sellerId !== userId && role !== "ADMIN")
        return socket.emit("error", "Нет доступа");

      // Сохраняем сообщение в БД
      const msg = await prisma.message.create({
        data: { dealId, senderId: userId, content: content.trim() },
        include: { sender: { select: { username: true, role: true } } },
      });

      // Рассылаем всем в комнате
      io.to(`deal:${dealId}`).emit("message:new", msg);
    });

    // ─── Набор текста (typing indicator) ────────────────────
    socket.on("message:typing", ({ dealId }: { dealId: string }) => {
      socket.to(`deal:${dealId}`).emit("message:typing", { userId });
    });

    socket.on("disconnect", () => {
      console.log(`[WS] Disconnected: ${userId}`);
    });
  });
}


// ─── backend/src/services/logger.ts ──────────────────────────────────────────
import { prisma } from "../index";

interface LogParams {
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: object;
  ip?: string;
}

export async function logAction(params: LogParams) {
  try {
    await prisma.log.create({ data: params });
  } catch (err) {
    console.error("[Logger] Failed to write log:", err);
  }
}


// ─── backend/src/services/mailer.ts ──────────────────────────────────────────
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || "smtp.gmail.com",
  port:   parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, text: string) {
  try {
    await transporter.sendMail({
      from: `"P2P Exchange" <${process.env.SMTP_USER}>`,
      to, subject, text,
    });
  } catch (err) {
    console.error("[Mailer] Failed to send email:", err);
  }
}

import type { Request, Response } from "express";
import { createApp } from "../server";

let cachedApp: any = null;

export default async function handler(req: Request, res: Response) {
  if (!cachedApp) {
    cachedApp = await createApp();
  }
  // En Vercel, si la reescritura remueve el prefijo /api, restaurarlo para que coincida con las rutas Express
  if (req.url && !req.url.startsWith("/api")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  return cachedApp(req, res);
}

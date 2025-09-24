import type { NextApiRequest, NextApiResponse } from "next";

import { fetchTicketmasterEvents } from "@/lib/fetchers/ticketmaster";
import { upsertTicketmasterEventsForUser } from "@/lib/services/ingestion";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  const city = typeof req.query.city === "string" ? req.query.city : undefined;
  const keyword = typeof req.query.keyword === "string" ? req.query.keyword : undefined;

  try {
    const events = await fetchTicketmasterEvents({ city, keyword });
    const { inserted, updated } = await upsertTicketmasterEventsForUser(userId, events);

    return res.status(200).json({ inserted, updated });
  } catch (error) {
    console.error("Failed to sync Ticketmaster events", error);
    return res.status(500).json({ error: "Failed to sync Ticketmaster events" });
  }
}

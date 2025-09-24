import prisma from "@/lib/prisma";
import { fetchTicketmasterEvents, type NormalizedEvent } from "@/lib/fetchers/ticketmaster";

function parseDate(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function sanitizeOptional(value?: string): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export type UpsertSummary = {
  inserted: number;
  updated: number;
};

export async function upsertTicketmasterEventsForUser(
  userId: string,
  events: NormalizedEvent[],
): Promise<UpsertSummary> {
  let inserted = 0;
  let updated = 0;

  for (const event of events) {
    if (!event.uid) {
      console.warn("Skipping Ticketmaster event with missing uid");
      continue;
    }

    const startUtc = parseDate(event.startUtc);
    if (!startUtc) {
      console.warn(`Skipping Ticketmaster event ${event.uid} due to invalid start time`);
      continue;
    }

    const lastSeenAtUtc = parseDate(event.lastSeenAtUtc);
    if (!lastSeenAtUtc) {
      console.warn(`Skipping Ticketmaster event ${event.uid} due to invalid lastSeenAtUtc`);
      continue;
    }

    const where = {
      userId_uid: {
        userId,
        uid: event.uid,
      },
    } as const;


    const record = await prisma.event.upsert({
      where,
      update: {
        lastSeenAtUtc,
      },
      create: {

    const existing = await prisma.event.findUnique({ where });

    if (existing) {
      await prisma.event.update({
        where,
        data: {
          lastSeenAtUtc,
        },
      });
      updated += 1;
      continue;
    }

    await prisma.event.create({
      data: {

        userId,
        uid: event.uid,
        source: event.source,
        title: sanitizeOptional(event.title) ?? "Untitled Event",

        description: sanitizeOptional(event.description),

        description: sanitizeOptional(event.description ?? undefined),

        startUtc,
        venueName: sanitizeOptional(event.venueName),
        address: sanitizeOptional(event.address),
        url: sanitizeOptional(event.url),
        lastSeenAtUtc,
      },
    });


    if (record.createdAt.getTime() === record.updatedAt.getTime()) {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  console.log(
    `Ticketmaster upsert summary for user ${userId}: ${inserted} inserted, ${updated} updated`,
  );


    inserted += 1;
  }


  return { inserted, updated };
}

export async function ingestSampleTicketmasterEvents(userId: string): Promise<UpsertSummary> {

  const events = await fetchTicketmasterEvents("Dallas", "music");

  const events = await fetchTicketmasterEvents({ city: "Dallas", keyword: "music" });

  const result = await upsertTicketmasterEventsForUser(userId, events);
  console.log(
    `Ticketmaster ingestion completed for user ${userId}: ${result.inserted} inserted, ${result.updated} updated`,
  );
  return result;
}

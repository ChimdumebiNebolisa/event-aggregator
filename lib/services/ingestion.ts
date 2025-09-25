import prisma from "@/lib/prisma";
import {
  fetchTicketmasterEvents,
  type FetchTicketmasterParams,
  type NormalizedEvent,
} from "@/lib/fetchers/ticketmaster";

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

async function upsertTicketmasterEvent(userId: string, event: NormalizedEvent): Promise<"inserted" | "updated" | "skipped"> {
  if (!event.uid) {
    console.warn("Skipping Ticketmaster event with missing uid");
    return "skipped";
  }

  const startUtc = parseDate(event.startUtc);
  if (!startUtc) {
    console.warn(`Skipping Ticketmaster event ${event.uid} due to invalid start time`);
    return "skipped";
  }

  const lastSeenAtUtc = parseDate(event.lastSeenAtUtc);
  if (!lastSeenAtUtc) {
    console.warn(`Skipping Ticketmaster event ${event.uid} due to invalid lastSeenAtUtc`);
    return "skipped";
  }

  const where = {
    userId_uid: {
      userId,
      uid: event.uid,
    },
  } as const;

  const baseData = {
    source: event.source,
    title: sanitizeOptional(event.title) ?? "Untitled Event",
    description: sanitizeOptional(event.description ?? undefined) ?? undefined,
    startUtc,
    venueName: sanitizeOptional(event.venueName) ?? undefined,
    address: sanitizeOptional(event.address) ?? undefined,
    url: sanitizeOptional(event.url) ?? undefined,
    lastSeenAtUtc,
  };

  const existing = await prisma.event.findUnique({ where });

  if (existing) {
    await prisma.event.update({
      where,
      data: baseData,
    });
    return "updated";
  }

  await prisma.event.create({
    data: {
      userId,
      uid: event.uid,
      ...baseData,
    },
  });

  return "inserted";
}

export async function upsertTicketmasterEventsForUser(
  userId: string,
  events: NormalizedEvent[],
): Promise<UpsertSummary> {
  let inserted = 0;
  let updated = 0;

  for (const event of events) {
    const result = await upsertTicketmasterEvent(userId, event);
    if (result === "inserted") {
      inserted += 1;
    } else if (result === "updated") {
      updated += 1;
    }
  }

  console.log(
    `Ticketmaster upsert summary for user ${userId}: ${inserted} inserted, ${updated} updated`,
  );

  return { inserted, updated };
}


type TicketmasterFetchParams = {
  city: string;
  keyword?: string;
};


export async function ingestSampleTicketmasterEvents(
  userId: string,
  params: TicketmasterFetchParams = { city: "Dallas", keyword: "music" },
): Promise<UpsertSummary> {
  const events = await fetchTicketmasterEvents(params.city, params.keyword);

export async function ingestSampleTicketmasterEvents(
  userId: string,
  params: FetchTicketmasterParams = { city: "Dallas", keyword: "music" },
): Promise<UpsertSummary> {
  const events = await fetchTicketmasterEvents(params);


export async function ingestSampleTicketmasterEvents(
  userId: string,
  params: TicketmasterFetchParams = { city: "Dallas", keyword: "music" },
): Promise<UpsertSummary> {
  const events = await fetchTicketmasterEvents(params.city, params.keyword);
  const result = await upsertTicketmasterEventsForUser(userId, events);
  console.log(
    `Ticketmaster ingestion completed for user ${userId}: ${result.inserted} inserted, ${result.updated} updated`,
  );
  return result;
}

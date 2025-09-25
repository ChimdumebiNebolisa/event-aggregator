export interface NormalizedEvent {
  uid: string;
  source: "googlecal" | "eventbrite" | "ticketmaster" | "manual";
  title: string;
  description?: string;
  startUtc: string;
  endUtc?: string;
  venueName?: string;
  address?: string;
  url?: string;
  lastSeenAtUtc: string;
}

interface EventbriteEvent {
  id?: string;
  name?: {
    text?: string | null;
  } | null;
  description?: {
    text?: string | null;
  } | null;
  start?: {
    utc?: string | null;
  } | null;
  end?: {
    utc?: string | null;
  } | null;
  url?: string | null;
  venue_id?: string | null;
  venue?: {
    name?: string | null;
    address?: {
      localized_address_display?: string | null;
    } | null;
  } | null;
}

interface EventbriteResponse {
  events?: EventbriteEvent[];
}

const EVENTBRITE_API_BASE = "https://www.eventbriteapi.com/v3";

export async function fetchEventbriteEvents(keyword?: string): Promise<NormalizedEvent[]> {
  const apiKey = process.env.EVENTBRITE_API_KEY;
  if (!apiKey) {
    console.error("Missing Eventbrite API key");
    return [];
  }

  try {
    const url = new URL("/events/search/", EVENTBRITE_API_BASE);
    if (keyword) {
      url.searchParams.set("q", keyword);
    }
    url.searchParams.set("expand", "venue");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("Eventbrite API request failed", response.status, response.statusText);
      return [];
    }

    const data: EventbriteResponse = await response.json();
    const seenAt = new Date().toISOString();

    return (data.events ?? []).map((event) => {
      const venueName = event.venue?.name ?? "";
      const address =
        event.venue?.address?.localized_address_display ?? "";

      return {
        uid: event.id ?? "",
        source: "eventbrite" as const,
        title: event.name?.text ?? "",
        description: event.description?.text ?? "",
        startUtc: event.start?.utc ?? "",
        endUtc: event.end?.utc ?? "",
        venueName,
        address,
        url: event.url ?? "",
        lastSeenAtUtc: seenAt,
      } satisfies NormalizedEvent;
    });
  } catch (error) {
    console.error("Failed to fetch Eventbrite events", error);
    return [];
  }
}

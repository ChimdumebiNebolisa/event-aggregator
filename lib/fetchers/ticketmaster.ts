export interface NormalizedEvent {
  uid: string;

  source: "googlecal" | "eventbrite" | "ticketmaster" | "manual";


  source: "googlecal" | "eventbrite" | "ticketmaster" | "manual";


  source: "googlecal" | "eventbrite" | "ticketmaster" | "manual";

  source: "ticketmaster";



  title: string;
  description?: string;
  startUtc: string;
  endUtc?: string;
  venueName?: string;
  address?: string;
  url?: string;
  lastSeenAtUtc: string;
}


interface TicketmasterVenueAddress {
  line1?: string;
  line2?: string;
}

interface TicketmasterVenue {
  name?: string;
  address?: TicketmasterVenueAddress;
  city?: {
    name?: string;
  };
  state?: {
    name?: string;
  };
  postalCode?: string;
  country?: {
    name?: string;
  };


interface TicketmasterVenueAddress {
  line1?: string;
  line2?: string;
}

interface TicketmasterVenue {
  name?: string;
  address?: TicketmasterVenueAddress;
  city?: {
    name?: string;
  };
  state?: {
    name?: string;
  };
  postalCode?: string;
  country?: {
    name?: string;
  };
}


export interface FetchTicketmasterParams {
  city: string;
  keyword?: string;

}

interface TicketmasterEvent {
  id?: string;
  name?: string;
  info?: string;
  description?: string;
  url?: string;
  dates?: {
    start?: {
      dateTime?: string;
    };
    end?: {
      dateTime?: string;
    };
  };
  _embedded?: {
    venues?: TicketmasterVenue[];
  };
}

interface TicketmasterResponse {
  _embedded?: {
    events?: TicketmasterEvent[];
  };
}

export async function fetchTicketmasterEvents(city: string, keyword?: string): Promise<NormalizedEvent[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    console.error("Missing Ticketmaster API key");
    return [];
  }

  try {
    const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("city", city);
    if (keyword) {
      url.searchParams.set("keyword", keyword);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error("Ticketmaster API request failed", response.status, response.statusText);
      return [];
    }

    const data: TicketmasterResponse = await response.json();
    const seenAt = new Date().toISOString();

    return (data._embedded?.events ?? []).map((event) => {
      const venue = event._embedded?.venues?.[0];
      const addressParts = [
        venue?.address?.line1 ?? "",
        venue?.address?.line2 ?? "",
        venue?.city?.name ?? "",
        venue?.state?.name ?? "",
        venue?.postalCode ?? "",
        venue?.country?.name ?? "",
      ].filter((part) => part && part.trim().length > 0);

      return {
        uid: event.id ?? "",
        source: "ticketmaster" as const,
        title: event.name ?? "",
        description: event.info ?? event.description ?? "",
        startUtc: event.dates?.start?.dateTime ?? "",
        endUtc: event.dates?.end?.dateTime ?? "",
        venueName: venue?.name ?? "",
        address: addressParts.join(", "),
        url: event.url ?? "",
        lastSeenAtUtc: seenAt,
      } satisfies NormalizedEvent;
    });
  } catch (error) {
    console.error("Failed to fetch Ticketmaster events", error);
    return [];
  }


export async function fetchTicketmasterEvents(city: string, keyword?: string): Promise<NormalizedEvent[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    console.error("Missing Ticketmaster API key");
    return [];
  }

  try {
    const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("city", city);
    if (keyword) {
      url.searchParams.set("keyword", keyword);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error("Ticketmaster API request failed", response.status, response.statusText);
      return [];
    }

    const data: TicketmasterResponse = await response.json();
    const seenAt = new Date().toISOString();

    return (data._embedded?.events ?? []).map((event) => {
      const venue = event._embedded?.venues?.[0];
      const addressParts = [
        venue?.address?.line1 ?? "",
        venue?.address?.line2 ?? "",
        venue?.city?.name ?? "",
        venue?.state?.name ?? "",
        venue?.postalCode ?? "",
        venue?.country?.name ?? "",
      ].filter((part) => part && part.trim().length > 0);

      return {
        uid: event.id ?? "",
        source: "ticketmaster" as const,
        title: event.name ?? "",
        description: event.info ?? event.description ?? "",
        startUtc: event.dates?.start?.dateTime ?? "",
        endUtc: event.dates?.end?.dateTime ?? "",
        venueName: venue?.name ?? "",
        address: addressParts.join(", "),
        url: event.url ?? "",
        lastSeenAtUtc: seenAt,
      } satisfies NormalizedEvent;
    });
  } catch (error) {
    console.error("Failed to fetch Ticketmaster events", error);
    return [];
  }


export async function fetchTicketmasterEvents(city: string, keyword?: string): Promise<NormalizedEvent[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    console.error("Missing Ticketmaster API key");
    return [];
  }

  try {
    const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("city", city);
    if (keyword) {
      url.searchParams.set("keyword", keyword);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error("Ticketmaster API request failed", response.status, response.statusText);
      return [];
    }

    const data: TicketmasterResponse = await response.json();
    const seenAt = new Date().toISOString();

    return (data._embedded?.events ?? []).map((event) => {
      const venue = event._embedded?.venues?.[0];
      const addressParts = [
        venue?.address?.line1 ?? "",
        venue?.address?.line2 ?? "",
        venue?.city?.name ?? "",
        venue?.state?.name ?? "",
        venue?.postalCode ?? "",
        venue?.country?.name ?? "",
      ].filter((part) => part && part.trim().length > 0);

      return {
        uid: event.id ?? "",
        source: "ticketmaster" as const,
        title: event.name ?? "",
        description: event.info ?? event.description ?? "",
        startUtc: event.dates?.start?.dateTime ?? "",
        endUtc: event.dates?.end?.dateTime ?? "",
        venueName: venue?.name ?? "",
        address: addressParts.join(", "),
        url: event.url ?? "",
        lastSeenAtUtc: seenAt,
      } satisfies NormalizedEvent;
    });
  } catch (error) {
    console.error("Failed to fetch Ticketmaster events", error);
    return [];
  }

export async function fetchTicketmasterEvents({
  city,
  keyword,
}: FetchTicketmasterParams): Promise<NormalizedEvent[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing Ticketmaster API key");
  }

  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("city", city);
  if (keyword) {
    url.searchParams.set("keyword", keyword);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Ticketmaster API request failed with status ${response.status}`);
  }

  const data: TicketmasterResponse = await response.json();
  const events = data._embedded?.events ?? [];
  const seenAt = new Date().toISOString();

  return events.map((event) => {
    const venue = event._embedded?.venues?.[0];
    const addressParts = [
      venue?.address?.line1 ?? "",
      venue?.address?.line2 ?? "",
      venue?.city?.name ?? "",
      venue?.state?.name ?? "",
      venue?.postalCode ?? "",
      venue?.country?.name ?? "",
    ].filter((part) => part && part.trim() !== "");

    return {
      uid: event.id ?? "",
      source: "ticketmaster" as const,
      title: event.name ?? "",
      description: event.description ?? event.info ?? undefined,
      startUtc: event.dates?.start?.dateTime ?? "",
      venueName: venue?.name ?? undefined,
      address: addressParts.length > 0 ? addressParts.join(", ") : undefined,
      url: event.url ?? undefined,
      lastSeenAtUtc: seenAt,
    } satisfies NormalizedEvent;
  });


}

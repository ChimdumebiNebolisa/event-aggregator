export interface NormalizedEvent {
  uid: string;
  source: 'ticketmaster';
  title: string;
  description?: string;
  startUtc: string;
  venueName?: string;
  address?: string;
  url?: string;
  lastSeenAtUtc: string;
}

interface FetchTicketmasterParams {
  city?: string;
  keyword?: string;
}



interface TicketmasterEvent {
  id?: string;
  name?: string;
  description?: string;
  info?: string;
  url?: string;
  dates?: {
    start?: {
      dateTime?: string;
    };
  };
  _embedded?: {
    venues?: Array<{
      name?: string;
      address?: {
        line1?: string;
        line2?: string;
      };
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
    }>;
  };
}

interface TicketmasterResponse {
  _embedded?: {
    events?: TicketmasterEvent[];
  };
}


export async function fetchTicketmasterEvents(
  city: string,
  keyword?: string,
): Promise<NormalizedEvent[]> {




export async function fetchTicketmasterEvents({
  city,
  keyword,
}: FetchTicketmasterParams): Promise<NormalizedEvent[]> {




  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    throw new Error('Missing Ticketmaster API key');
  }

  const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
  url.searchParams.set('apikey', apiKey);
  if (city) {
    url.searchParams.set('city', city);
  }
  if (keyword) {
    url.searchParams.set('keyword', keyword);
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
      venue?.address?.line1 ?? '',
      venue?.address?.line2 ?? '',
      venue?.city?.name ?? '',
      venue?.state?.name ?? '',
      venue?.postalCode ?? '',
      venue?.country?.name ?? '',
    ].filter((part) => part && part.trim() !== '');

    return {
      uid: event.id ?? '',
      source: 'ticketmaster',
      title: event.name ?? '',
      description: event.description ?? event.info ?? '',
      startUtc: event.dates?.start?.dateTime ?? '',
      venueName: venue?.name ?? '',
      address: addressParts.join(', '),
      url: event.url ?? '',
      lastSeenAtUtc: seenAt,
    };
  });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";

import { authOptions } from "../auth/[...nextauth]/route";

type SessionWithGoogleToken = Session & {
  accessToken?: string;
  error?: string;
};

type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  location?: string;
  status?: string;
};

type GoogleCalendarEventsResponse = {
  items?: GoogleCalendarEvent[];
};

const GOOGLE_CALENDAR_EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export async function GET() {
  const session = (await getServerSession(authOptions)) as SessionWithGoogleToken | null;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.error === "RefreshAccessTokenError") {
    return NextResponse.json(
      { error: "Google access token has expired. Please sign in again." },
      { status: 401 },
    );
  }

  const accessToken = session.accessToken;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Missing Google access token. Please reconnect your account." },
      { status: 401 },
    );
  }

  const params = new URLSearchParams({
    maxResults: "5",
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: new Date().toISOString(),
  });

  try {
    const response = await fetch(`${GOOGLE_CALENDAR_EVENTS_URL}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json(
        { error: "Google access token is invalid or expired. Please sign in again." },
        { status: 401 },
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch Google Calendar events", errorText);
      return NextResponse.json(
        { error: "Failed to fetch Google Calendar events" },
        { status: 500 },
      );
    }

    const data = (await response.json()) as GoogleCalendarEventsResponse;
    const events = data.items ?? [];

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Unexpected error fetching Google Calendar events", error);
    return NextResponse.json(
      { error: "Unable to retrieve Google Calendar events" },
      { status: 500 },
    );
  }
}

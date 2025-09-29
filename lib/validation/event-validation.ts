import { z } from 'zod';

// Event validation schemas
export const EventValidationSchema = z.object({
  uid: z.string()
    .min(1, 'Event UID is required')
    .max(255, 'Event UID too long')
    .refine((val) => !/[\x00-\x1F\x7F]/.test(val), 'Event UID contains invalid characters'),
  source: z.enum(['googlecal', 'eventbrite', 'ticketmaster', 'seatgeek', 'manual'], {
    errorMap: () => ({ message: 'Invalid event source' })
  }),
  title: z.string()
    .min(1, 'Event title is required')
    .max(500, 'Event title too long')
    .refine((val) => val.trim().length > 0, 'Event title cannot be empty or whitespace')
    .refine((val) => !/[\x00-\x1F\x7F]/.test(val), 'Event title contains invalid characters'),
  description: z.string()
    .max(2000, 'Event description too long')
    .refine((val) => !val || !/[\x00-\x1F\x7F]/.test(val), 'Event description contains invalid characters')
    .optional(),
  startUtc: z.string().datetime('Invalid start date format'),
  endUtc: z.string().datetime('Invalid end date format').optional(),
  timezone: z.string()
    .max(50, 'Timezone too long')
    .refine((val) => !val || !/[\x00-\x1F\x7F]/.test(val), 'Timezone contains invalid characters')
    .optional(),
  venueName: z.string()
    .max(255, 'Venue name too long')
    .refine((val) => !val || !/[\x00-\x1F\x7F]/.test(val), 'Venue name contains invalid characters')
    .optional(),
  address: z.string()
    .max(500, 'Address too long')
    .refine((val) => !val || !/[\x00-\x1F\x7F]/.test(val), 'Address contains invalid characters')
    .optional(),
  lat: z.number()
    .min(-90, 'Latitude must be between -90 and 90 degrees')
    .max(90, 'Latitude must be between -90 and 90 degrees')
    .refine((val) => !Number.isNaN(val), 'Latitude must be a valid number')
    .refine((val) => Number.isFinite(val), 'Latitude must be a finite number')
    .optional(),
  lng: z.number()
    .min(-180, 'Longitude must be between -180 and 180 degrees')
    .max(180, 'Longitude must be between -180 and 180 degrees')
    .refine((val) => !Number.isNaN(val), 'Longitude must be a valid number')
    .refine((val) => Number.isFinite(val), 'Longitude must be a finite number')
    .optional(),
  category: z.string()
    .max(100, 'Category too long')
    .refine((val) => !val || !/[\x00-\x1F\x7F]/.test(val), 'Category contains invalid characters')
    .optional(),
  tag: z.enum(['Work', 'Social', 'Music', 'Other']).default('Other'),
  url: z.string()
    .url('Invalid URL format')
    .optional()
    .or(z.literal('')),
  organizerEmail: z.string()
    .email('Invalid organizer email')
    .optional()
    .or(z.literal('')),
  contactEmail: z.string()
    .email('Invalid contact email')
    .optional()
    .or(z.literal('')),
  createdByUser: z.boolean().default(false),
  city: z.string()
    .max(100, 'City name too long')
    .refine((val) => !val || !/[\x00-\x1F\x7F]/.test(val), 'City name contains invalid characters')
    .optional(),
  country: z.string()
    .max(100, 'Country name too long')
    .refine((val) => !val || !/[\x00-\x1F\x7F]/.test(val), 'Country name contains invalid characters')
    .optional(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']).optional(),
  lastSeenAtUtc: z.string().datetime('Invalid last seen date format')
});

export type ValidatedEvent = z.infer<typeof EventValidationSchema>;

// Enhanced validation functions
export function validateEventData(event: any): { isValid: boolean; errors: string[]; data?: ValidatedEvent } {
  try {
    const validatedData = EventValidationSchema.parse(event);
    return { isValid: true, errors: [], data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { isValid: false, errors, data: undefined };
    }
    return { isValid: false, errors: ['Unknown validation error'], data: undefined };
  }
}

// Date validation utilities
export function validateDateString(dateString: string): { isValid: boolean; error?: string; date?: Date } {
  if (!dateString || typeof dateString !== 'string') {
    return { isValid: false, error: 'Date string is required' };
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return { isValid: false, error: 'Invalid date format' };
  }

  // Check if date is reasonable (not too far in past or future)
  const now = new Date();
  const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

  if (date < twoYearsAgo) {
    return { isValid: false, error: 'Date is too far in the past' };
  }

  if (date > twoYearsFromNow) {
    return { isValid: false, error: 'Date is too far in the future' };
  }

  return { isValid: true, date };
}

// Enhanced timezone validation utilities
export function validateTimezone(timezone: string): { isValid: boolean; error?: string; normalizedTimezone?: string } {
  if (!timezone || typeof timezone !== 'string') {
    return { isValid: false, error: 'Timezone is required' };
  }

  // Clean and trim the timezone string
  const cleanTimezone = timezone.trim();
  if (cleanTimezone === '') {
    return { isValid: false, error: 'Timezone cannot be empty' };
  }

  // Normalize common timezone variations first
  const normalizedTimezone = normalizeTimezone(cleanTimezone);

  // Check if it's a valid timezone identifier using Intl.DateTimeFormat
  try {
    // Test if the timezone is valid by creating a date with it
    const testDate = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: normalizedTimezone });
    const formatted = formatter.format(testDate);
    
    // Additional validation: check if the timezone offset can be calculated
    const offset = getTimezoneOffset(normalizedTimezone);
    if (isNaN(offset)) {
      return { isValid: false, error: 'Invalid timezone identifier' };
    }
    
    // If we get here without error, the timezone is valid
    return { isValid: true, normalizedTimezone };
  } catch (error) {
    return { isValid: false, error: 'Invalid timezone identifier' };
  }
}

// Get timezone offset in minutes
function getTimezoneOffset(timezone: string): number {
  // Use hardcoded offsets for common timezones (in January 2024, no DST)
  const timezoneOffsets: Record<string, number> = {
    'UTC': 0,
    'America/New_York': -300, // EST (UTC-5)
    'America/Chicago': -360, // CST (UTC-6)
    'America/Denver': -420, // MST (UTC-7)
    'America/Los_Angeles': -480, // PST (UTC-8)
    'Europe/London': 0, // GMT (UTC+0)
    'Europe/Paris': 60, // CET (UTC+1)
    'Europe/Berlin': 60, // CET (UTC+1)
    'Asia/Tokyo': 540, // JST (UTC+9)
    'Asia/Shanghai': 480, // CST (UTC+8)
    'Australia/Sydney': 660, // AEDT (UTC+11)
    'Pacific/Auckland': 780, // NZDT (UTC+13)
  };

  if (timezoneOffsets[timezone] !== undefined) {
    return timezoneOffsets[timezone];
  }

  // For other timezones, try to calculate dynamically
  try {
    // Use a known UTC time to calculate the offset
    const utcDate = new Date('2024-01-01T12:00:00Z'); // Noon UTC on Jan 1, 2024
    
    // Get the time in the target timezone using Intl.DateTimeFormat
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Format the UTC date in the target timezone
    const parts = formatter.formatToParts(utcDate);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    const second = parts.find(p => p.type === 'second')?.value;

    if (year && month && day && hour && minute && second) {
      // Create a date from the formatted parts (this will be interpreted as local time)
      const localDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
      
      // Calculate the offset: how much to add to local time to get UTC
      // If local time is behind UTC, the offset should be positive
      const offsetMs = localDate.getTime() - utcDate.getTime();
      return offsetMs / 60000; // Convert to minutes
    }
    
    return 0; // UTC fallback
  } catch (error) {
    return 0; // UTC fallback
  }
}

// Normalize timezone identifiers
export function normalizeTimezone(timezone: string): string {
  const timezoneMap: Record<string, string> = {
    'EST': 'America/New_York',
    'EDT': 'America/New_York',
    'CST': 'America/Chicago',
    'CDT': 'America/Chicago',
    'MST': 'America/Denver',
    'MDT': 'America/Denver',
    'PST': 'America/Los_Angeles',
    'PDT': 'America/Los_Angeles',
    'GMT': 'UTC',
    'Z': 'UTC',
    '+00:00': 'UTC',
    '-00:00': 'UTC'
  };

  return timezoneMap[timezone] || timezone;
}

// Enhanced date/time validation with timezone support
export function validateDateTimeWithTimezone(
  dateTimeString: string, 
  timezone?: string
): { 
  isValid: boolean; 
  error?: string; 
  utcDate?: Date; 
  localDate?: Date;
  timezone?: string;
} {
  // Validate the date string first
  const dateValidation = validateDateString(dateTimeString);
  if (!dateValidation.isValid) {
    return { isValid: false, error: dateValidation.error };
  }

  const date = dateValidation.date!;
  
  // If timezone is provided, validate it
  let normalizedTimezone = 'UTC';
  if (timezone) {
    const timezoneValidation = validateTimezone(timezone);
    if (!timezoneValidation.isValid) {
      return { isValid: false, error: timezoneValidation.error };
    }
    normalizedTimezone = timezoneValidation.normalizedTimezone!;
  }

  try {
    // If the date string already includes timezone info (like ISO 8601), use it directly
    // Check for 'Z' suffix or timezone offset patterns like +05:00 or -08:00
    const hasTimezoneInfo = dateTimeString.endsWith('Z') || 
      /[+-]\d{2}:\d{2}$/.test(dateTimeString) || 
      /[+-]\d{4}$/.test(dateTimeString);
    
    if (hasTimezoneInfo) {
      // Date string already has timezone info, treat as UTC
      return {
        isValid: true,
        utcDate: date,
        localDate: new Date(date.getTime() - (date.getTimezoneOffset() * 60000)),
        timezone: 'UTC'
      };
    }

    // If timezone is specified and date doesn't have timezone info, convert it
    if (timezone && timezone !== 'UTC') {
      // For dates without timezone info, treat them as local time in the specified timezone
      // and convert to UTC using a simpler approach
      try {
        // Use a known UTC time to calculate the offset
        const utcReference = new Date('2024-01-01T12:00:00Z');
        
        // Get the time in the target timezone
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: normalizedTimezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        
        const parts = formatter.formatToParts(utcReference);
        const year = parts.find(p => p.type === 'year')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const day = parts.find(p => p.type === 'day')?.value;
        const hour = parts.find(p => p.type === 'hour')?.value;
        const minute = parts.find(p => p.type === 'minute')?.value;
        const second = parts.find(p => p.type === 'second')?.value;

        if (year && month && day && hour && minute && second) {
          // Create a date from the formatted parts (this will be in local time)
          const localReference = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
          
          // Calculate the offset: how much to add to local time to get UTC
          const offsetMs = utcReference.getTime() - localReference.getTime();
          const offsetMinutes = offsetMs / 60000;
          
          // Convert the local time to UTC by adding the offset
          const utcDate = new Date(date.getTime() + offsetMs);
          
          return {
            isValid: true,
            utcDate,
            localDate: date,
            timezone: normalizedTimezone
          };
        }
      } catch (error) {
        // Fall through to default case
      }
    }

    // Default: treat as UTC
    return {
      isValid: true,
      utcDate: date,
      localDate: new Date(date.getTime() - (date.getTimezoneOffset() * 60000)),
      timezone: 'UTC'
    };
  } catch (error) {
    return { isValid: false, error: 'Failed to process date with timezone' };
  }
}

// Validate event duration
export function validateEventDuration(
  startUtc: string, 
  endUtc?: string
): { isValid: boolean; error?: string; durationMinutes?: number } {
  const startValidation = validateDateString(startUtc);
  if (!startValidation.isValid) {
    return { isValid: false, error: `Invalid start date: ${startValidation.error}` };
  }

  if (!endUtc) {
    return { isValid: true }; // No end date is valid
  }

  const endValidation = validateDateString(endUtc);
  if (!endValidation.isValid) {
    return { isValid: false, error: `Invalid end date: ${endValidation.error}` };
  }

  const startDate = startValidation.date!;
  const endDate = endValidation.date!;

  if (endDate <= startDate) {
    return { isValid: false, error: 'End date must be after start date' };
  }

  const durationMs = endDate.getTime() - startDate.getTime();
  const durationMinutes = Math.floor(durationMs / (1000 * 60));

  // Check for reasonable duration (not more than 7 days)
  const maxDurationMinutes = 7 * 24 * 60; // 7 days
  if (durationMinutes > maxDurationMinutes) {
    return { 
      isValid: false, 
      error: `Event duration too long: ${Math.floor(durationMinutes / 60)} hours (max 168 hours)` 
    };
  }

  // Check for very short duration (less than 1 minute)
  if (durationMinutes < 1) {
    return { 
      isValid: false, 
      error: 'Event duration too short: must be at least 1 minute' 
    };
  }

  return { isValid: true, durationMinutes };
}

// Format date for display with timezone
export function formatDateWithTimezone(
  date: Date, 
  timezone: string = 'UTC', 
  options: Intl.DateTimeFormatOptions = {}
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    ...options
  };

  try {
    return new Intl.DateTimeFormat('en-US', {
      ...defaultOptions,
      timeZone: timezone
    }).format(date);
  } catch (error) {
    // Fallback to UTC if timezone is invalid
    return new Intl.DateTimeFormat('en-US', {
      ...defaultOptions,
      timeZone: 'UTC'
    }).format(date);
  }
}

// Get timezone offset string (e.g., "+05:30", "-08:00")
export function getTimezoneOffsetString(timezone: string): string {
  try {
    const now = new Date();
    const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    const targetTime = new Date(utc.toLocaleString('en-US', { timeZone: timezone }));
    const offsetMinutes = (targetTime.getTime() - utc.getTime()) / 60000;
    
    // Round to avoid floating point precision issues
    const roundedOffsetMinutes = Math.round(offsetMinutes);
    
    const sign = roundedOffsetMinutes >= 0 ? '+' : '-';
    const absOffset = Math.abs(roundedOffsetMinutes);
    const hours = Math.floor(absOffset / 60);
    const minutes = absOffset % 60;
    
    return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } catch (error) {
    return '+00:00'; // UTC fallback
  }
}

// Convert UTC date to timezone-specific date
export function convertUtcToTimezone(utcDate: Date, timezone: string): {
  isValid: boolean;
  localDate?: Date;
  error?: string;
} {
  try {
    const timezoneValidation = validateTimezone(timezone);
    if (!timezoneValidation.isValid) {
      return { isValid: false, error: timezoneValidation.error };
    }

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(utcDate);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    const second = parts.find(p => p.type === 'second')?.value;

    if (year && month && day && hour && minute && second) {
      const localDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
      return { isValid: true, localDate };
    }

    return { isValid: false, error: 'Failed to convert UTC date to timezone' };
  } catch (error) {
    return { isValid: false, error: 'Failed to convert UTC date to timezone' };
  }
}

// Convert timezone-specific date to UTC
export function convertTimezoneToUtc(localDate: Date, timezone: string): {
  isValid: boolean;
  utcDate?: Date;
  error?: string;
} {
  try {
    const timezoneValidation = validateTimezone(timezone);
    if (!timezoneValidation.isValid) {
      return { isValid: false, error: timezoneValidation.error };
    }

    // Get the timezone offset
    const offset = getTimezoneOffset(timezone);
    const utcDate = new Date(localDate.getTime() + (offset * 60000));
    
    return { isValid: true, utcDate };
  } catch (error) {
    return { isValid: false, error: 'Failed to convert timezone date to UTC' };
  }
}

// Get all available timezones
export function getAvailableTimezones(): string[] {
  try {
    // Get a comprehensive list of timezones
    const timezones = Intl.supportedValuesOf('timeZone');
    // Ensure UTC is included
    const allTimezones = [...timezones];
    if (!allTimezones.includes('UTC')) {
      allTimezones.push('UTC');
    }
    return allTimezones.sort();
  } catch (error) {
    // Fallback to common timezones if Intl.supportedValuesOf is not available
    return [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney',
      'Pacific/Auckland'
    ];
  }
}

// Check if a timezone is currently in daylight saving time
export function isDaylightSavingTime(timezone: string, date: Date = new Date()): {
  isValid: boolean;
  isDST?: boolean;
  error?: string;
} {
  try {
    const timezoneValidation = validateTimezone(timezone);
    if (!timezoneValidation.isValid) {
      return { isValid: false, error: timezoneValidation.error };
    }

    // Get the timezone offset for January 1st (standard time)
    const jan1 = new Date(date.getFullYear(), 0, 1);
    const jan1Offset = getTimezoneOffset(timezone);
    
    // Get the current offset
    const currentOffset = getTimezoneOffset(timezone);
    
    // If current offset is different from January offset, it's DST
    const isDST = Math.abs(currentOffset - jan1Offset) > 0;
    
    return { isValid: true, isDST };
  } catch (error) {
    return { isValid: false, error: 'Failed to determine daylight saving time status' };
  }
}

// Get timezone information for a specific date
export function getTimezoneInfo(timezone: string, date: Date = new Date()): {
  isValid: boolean;
  info?: {
    name: string;
    offset: string;
    isDST: boolean;
    abbreviation: string;
  };
  error?: string;
} {
  try {
    const timezoneValidation = validateTimezone(timezone);
    if (!timezoneValidation.isValid) {
      return { isValid: false, error: timezoneValidation.error };
    }

    const offset = getTimezoneOffsetString(timezone);
    const dstInfo = isDaylightSavingTime(timezone, date);
    
    if (!dstInfo.isValid) {
      return { isValid: false, error: dstInfo.error };
    }

    // Get timezone abbreviation
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    
    const parts = formatter.formatToParts(date);
    const abbreviation = parts.find(p => p.type === 'timeZoneName')?.value || '';

    return {
      isValid: true,
      info: {
        name: timezone,
        offset,
        isDST: dstInfo.isDST!,
        abbreviation
      }
    };
  } catch (error) {
    return { isValid: false, error: 'Failed to get timezone information' };
  }
}

// URL validation utilities
export function validateUrl(url: string): { isValid: boolean; error?: string; normalizedUrl?: string } {
  if (!url || url.trim() === '') {
    return { isValid: true, normalizedUrl: '' };
  }

  try {
    // Clean and trim the URL
    let cleanUrl = url.trim();
    
    // Remove any whitespace and control characters
    cleanUrl = cleanUrl.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Check for dangerous protocols first
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'ftp:', 'gopher:'];
    if (dangerousProtocols.some(protocol => cleanUrl.toLowerCase().startsWith(protocol))) {
      return { isValid: false, error: 'Dangerous protocol not allowed' };
    }
    
    // Check for malformed URLs that shouldn't be auto-corrected
    if (cleanUrl.startsWith('://') || cleanUrl.endsWith('://') || 
        cleanUrl.match(/^https?:\/\/$/) || cleanUrl.match(/^https?:\/\/\./) ||
        cleanUrl.includes('..') || cleanUrl.endsWith(':')) {
      return { isValid: false, error: 'Invalid URL format' };
    }
    
    // Add protocol if missing, but only for URLs that look like domains
    let normalizedUrl = cleanUrl;
    if (!cleanUrl.match(/^https?:\/\//i)) {
      // Only add protocol if it looks like a domain (contains a dot or is localhost)
      if (cleanUrl.includes('.') || cleanUrl.toLowerCase() === 'localhost') {
        normalizedUrl = `https://${cleanUrl}`;
      } else {
        return { isValid: false, error: 'Invalid URL format' };
      }
    }

    const urlObj = new URL(normalizedUrl);
    
    // Validate protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
    }

    // Validate hostname
    if (!urlObj.hostname || urlObj.hostname.length === 0) {
      return { isValid: false, error: 'Invalid hostname' };
    }

    // Check for invalid port numbers
    if (urlObj.port) {
      const port = parseInt(urlObj.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        return { isValid: false, error: 'Invalid port number' };
      }
    }

    // Check for suspicious patterns
    if (isSuspiciousUrl(urlObj)) {
      return { isValid: false, error: 'URL contains suspicious patterns' };
    }

    // Normalize the URL
    const finalUrl = normalizeUrl(urlObj);

    return { isValid: true, normalizedUrl: finalUrl };
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

// Check for suspicious URL patterns
function isSuspiciousUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();
  const fullUrl = url.toString().toLowerCase();
  
  // Check for dangerous protocols first
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'ftp:',
    'gopher:'
  ];
  
  if (dangerousProtocols.some(protocol => fullUrl.startsWith(protocol))) {
    return true;
  }
  
  // Check for suspicious patterns in hostname
  const suspiciousPatterns = [
    /localhost/i,
    /127\.0\.0\.1/i,
    /0\.0\.0\.0/i,
    /192\.168\./i,
    /10\.0\./i,
    /172\.(1[6-9]|2[0-9]|3[0-1])\./i,
    /\.local$/i,
    /\.onion$/i,
    /phishing/i,
    /malware/i,
    /virus/i,
    /scam/i
  ];

  // Check hostname for suspicious patterns
  return suspiciousPatterns.some(pattern => pattern.test(hostname));
}

// Normalize URL for consistent storage
function normalizeUrl(url: URL): string {
  // Remove default ports
  if (url.port === '80' && url.protocol === 'http:') {
    url.port = '';
  }
  if (url.port === '443' && url.protocol === 'https:') {
    url.port = '';
  }

  // Remove trailing slash from pathname
  if (url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
    // If pathname becomes empty, set it to empty string to avoid trailing slash
    if (url.pathname === '') {
      url.pathname = '';
    }
  }

  // Sort query parameters for consistency
  if (url.search) {
    const params = new URLSearchParams(url.search);
    const sortedParams = new URLSearchParams();
    
    // Sort parameters alphabetically
    Array.from(params.keys()).sort().forEach(key => {
      sortedParams.set(key, params.get(key) || '');
    });
    
    url.search = sortedParams.toString();
  }

  // Manually construct URL to avoid trailing slash for root URLs
  let result = `${url.protocol}//${url.hostname}`;
  if (url.port && url.port !== '80' && url.port !== '443') {
    result += `:${url.port}`;
  }
  if (url.pathname && url.pathname !== '/') {
    result += url.pathname;
  }
  if (url.search) {
    result += url.search;
  }
  if (url.hash) {
    result += url.hash;
  }
  return result;
}

// Sanitize URL for display (remove sensitive query parameters)
export function sanitizeUrlForDisplay(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Remove sensitive query parameters
    const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth', 'session'];
    sensitiveParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });

    // Truncate very long URLs for display
    const displayUrl = urlObj.toString();
    return displayUrl.length > 100 ? displayUrl.substring(0, 97) + '...' : displayUrl;
  } catch (error) {
    return url.length > 100 ? url.substring(0, 97) + '...' : url;
  }
}

// Extract domain from URL
export function extractDomain(url: string): string | null {
  if (!url || url.trim() === '') {
    return null;
  }
  
  try {
    let urlToParse = url.trim();
    
    // Only add protocol if it looks like a domain
    if (!urlToParse.match(/^https?:\/\//i)) {
      if (urlToParse.includes('.') || urlToParse.toLowerCase() === 'localhost') {
        urlToParse = `https://${urlToParse}`;
      } else {
        return null;
      }
    }
    
    const urlObj = new URL(urlToParse);
    
    // Check if it's a valid hostname
    if (!urlObj.hostname || urlObj.hostname.length === 0) {
      return null;
    }
    
    return urlObj.hostname;
  } catch (error) {
    return null;
  }
}

// Check if URL is from a trusted domain
export function isTrustedDomain(url: string, trustedDomains: string[] = []): boolean {
  const domain = extractDomain(url);
  if (!domain) return false;

  const defaultTrustedDomains = [
    'google.com',
    'eventbrite.com',
    'ticketmaster.com',
    'seatgeek.com',
    'facebook.com',
    'meetup.com',
    'youtube.com',
    'vimeo.com',
    'github.com',
    'stackoverflow.com'
  ];

  const allTrustedDomains = [...defaultTrustedDomains, ...trustedDomains];
  
  return allTrustedDomains.some(trustedDomain => 
    domain === trustedDomain || domain.endsWith(`.${trustedDomain}`)
  );
}

// Validate and sanitize URL with additional security checks
export function validateAndSanitizeUrl(
  url: string, 
  options: {
    allowHttp?: boolean;
    maxLength?: number;
    trustedDomains?: string[];
    requireHttps?: boolean;
  } = {}
): { 
  isValid: boolean; 
  error?: string; 
  normalizedUrl?: string;
  warnings?: string[];
} {
  const {
    allowHttp = false,
    maxLength = 2000,
    trustedDomains = [],
    requireHttps = !allowHttp // If allowHttp is true, don't require HTTPS
  } = options;

  const warnings: string[] = [];

  if (!url || url.trim() === '') {
    return { isValid: true, normalizedUrl: '' };
  }

  try {
    // Clean and trim the URL
    let cleanUrl = url.trim();
    
    // Remove any whitespace and control characters
    cleanUrl = cleanUrl.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Check for dangerous protocols first
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'ftp:', 'gopher:'];
    if (dangerousProtocols.some(protocol => cleanUrl.toLowerCase().startsWith(protocol))) {
      return { isValid: false, error: 'Dangerous protocol not allowed' };
    }
    
    // Add protocol if missing
    let normalizedUrl = cleanUrl;
    if (!cleanUrl.match(/^https?:\/\//i)) {
      // Use HTTP if allowHttp is true, otherwise HTTPS
      normalizedUrl = allowHttp ? `http://${cleanUrl}` : `https://${cleanUrl}`;
    }

    const urlObj = new URL(normalizedUrl);
    
    // Validate protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
    }

    // Validate hostname
    if (!urlObj.hostname || urlObj.hostname.length === 0) {
      return { isValid: false, error: 'Invalid hostname' };
    }

    // Check for suspicious patterns
    if (isSuspiciousUrl(urlObj)) {
      return { isValid: false, error: 'URL contains suspicious patterns' };
    }

    // Check protocol requirements
    if (requireHttps && urlObj.protocol !== 'https:') {
      return { isValid: false, error: 'HTTPS is required for this URL' };
    }

    if (!allowHttp && urlObj.protocol === 'http:') {
      return { isValid: false, error: 'HTTP URLs are not allowed' };
    }

    // Check length
    if (normalizedUrl.length > maxLength) {
      return { isValid: false, error: `URL too long (max ${maxLength} characters)` };
    }

    // Check if domain is trusted
    if (!isTrustedDomain(normalizedUrl, trustedDomains)) {
      warnings.push('URL is from an untrusted domain');
    }

    // Check for suspicious patterns
    if (urlObj.hostname.includes('bit.ly') || urlObj.hostname.includes('tinyurl.com')) {
      warnings.push('URL appears to be a shortened link');
    }

    // Normalize the URL
    const finalUrl = normalizeUrl(urlObj);

    return {
      isValid: true,
      normalizedUrl: finalUrl,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

// Enhanced location validation utilities
export function validateCoordinates(
  lat?: number, 
  lng?: number,
  options: {
    allowPartial?: boolean;
    precision?: number;
    checkRealisticBounds?: boolean;
  } = {}
): { 
  isValid: boolean; 
  error?: string; 
  warnings?: string[];
  normalized?: { lat: number; lng: number };
} {
  const { allowPartial = false, precision = 6, checkRealisticBounds = true } = options;
  const warnings: string[] = [];

  // Handle undefined values
  if (lat === undefined && lng === undefined) {
    return { isValid: true };
  }

  if (!allowPartial && (lat === undefined || lng === undefined)) {
    return { isValid: false, error: 'Both latitude and longitude must be provided' };
  }

  // Type validation
  if (lat !== undefined && (typeof lat !== 'number' || Number.isNaN(lat))) {
    return { isValid: false, error: 'Latitude must be a valid number' };
  }

  if (lng !== undefined && (typeof lng !== 'number' || Number.isNaN(lng))) {
    return { isValid: false, error: 'Longitude must be a valid number' };
  }

  // Basic bounds validation
  if (lat !== undefined) {
    if (lat < -90 || lat > 90) {
      return { isValid: false, error: 'Latitude must be between -90 and 90 degrees' };
    }
  }

  if (lng !== undefined) {
    if (lng < -180 || lng > 180) {
      return { isValid: false, error: 'Longitude must be between -180 and 180 degrees' };
    }
  }

  // Precision validation
  if (lat !== undefined) {
    const latPrecision = getDecimalPlaces(lat);
    if (latPrecision > precision) {
      warnings.push(`Latitude has ${latPrecision} decimal places (recommended: ${precision})`);
    }
  }

  if (lng !== undefined) {
    const lngPrecision = getDecimalPlaces(lng);
    if (lngPrecision > precision) {
      warnings.push(`Longitude has ${lngPrecision} decimal places (recommended: ${precision})`);
    }
  }

  // Realistic bounds checking (optional)
  if (checkRealisticBounds && lat !== undefined && lng !== undefined) {
    const realisticBounds = checkRealisticCoordinateBounds(lat, lng);
    if (!realisticBounds.isValid) {
      return { isValid: false, error: realisticBounds.error };
    }
    if (realisticBounds.warnings) {
      warnings.push(...realisticBounds.warnings);
    }
  }

  // Normalize coordinates (round to specified precision)
  const normalized = {
    lat: lat !== undefined ? roundToPrecision(lat, precision) : lat!,
    lng: lng !== undefined ? roundToPrecision(lng, precision) : lng!
  };

  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    normalized
  };
}

// Get number of decimal places
function getDecimalPlaces(num: number): number {
  if (Number.isInteger(num)) return 0;
  const str = num.toString();
  if (str.includes('e')) {
    const parts = str.split('e');
    const decimalPart = parts[0].split('.')[1] || '';
    return decimalPart.length - parseInt(parts[1]);
  }
  return str.split('.')[1]?.length || 0;
}

// Round number to specified precision
function roundToPrecision(num: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(num * factor) / factor;
}

// Check if coordinates are within realistic bounds for populated areas
function checkRealisticCoordinateBounds(
  lat: number, 
  lng: number
): { 
  isValid: boolean; 
  error?: string; 
  warnings?: string[] 
} {
  const warnings: string[] = [];

  // Check for coordinates in the ocean (very rough approximation)
  const isInOcean = isCoordinateInOcean(lat, lng);
  if (isInOcean) {
    warnings.push('Coordinates appear to be in the ocean - please verify location');
  }

  // Check for coordinates in uninhabited areas (very rough approximation)
  const isInUninhabitedArea = isCoordinateInUninhabitedArea(lat, lng);
  if (isInUninhabitedArea) {
    warnings.push('Coordinates appear to be in an uninhabited area - please verify location');
  }

  // Check for coordinates that are clearly wrong (like 0,0 which is in the ocean)
  if (lat === 0 && lng === 0) {
    return { isValid: false, error: 'Coordinates (0,0) are in the ocean and likely incorrect' };
  }

  // Check for coordinates that are too close to the poles
  if (Math.abs(lat) > 85) {
    warnings.push('Coordinates are very close to the poles - please verify location');
  }

  return { isValid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

// Very basic ocean detection (this is a simplified approximation)
function isCoordinateInOcean(lat: number, lng: number): boolean {
  // This is a very rough approximation - in a real application, you'd use
  // a proper geospatial library or service to determine land vs ocean
  
  // Check for some known ocean coordinates
  const oceanCoordinates = [
    { lat: 0, lng: 0 }, // Gulf of Guinea
    { lat: 0, lng: 180 }, // Pacific Ocean
    { lat: 0, lng: -180 }, // Pacific Ocean
    { lat: 90, lng: 0 }, // North Pole
    { lat: -90, lng: 0 }, // South Pole
  ];

  return oceanCoordinates.some(coord => 
    Math.abs(coord.lat - lat) < 1 && Math.abs(coord.lng - lng) < 1
  );
}

// Very basic uninhabited area detection
function isCoordinateInUninhabitedArea(lat: number, lng: number): boolean {
  // This is a very rough approximation - in a real application, you'd use
  // a proper geospatial library or service
  
  // Check for coordinates in extreme environments
  if (Math.abs(lat) > 80) return true; // Arctic/Antarctic regions
  if (Math.abs(lat) < 5 && Math.abs(lng) > 150) return true; // Remote Pacific
  
  return false;
}

// Validate coordinate precision for different use cases
export function validateCoordinatePrecision(
  lat: number, 
  lng: number, 
  useCase: 'general' | 'city' | 'venue' | 'exact'
): { isValid: boolean; error?: string; recommendedPrecision?: number } {
  const precision = getDecimalPlaces(lat);
  const lngPrecision = getDecimalPlaces(lng);
  const maxPrecision = Math.max(precision, lngPrecision);

  const precisionRequirements = {
    general: 2, // ~1.1 km accuracy
    city: 3,    // ~110 m accuracy
    venue: 4,   // ~11 m accuracy
    exact: 6    // ~0.11 m accuracy
  };

  const requiredPrecision = precisionRequirements[useCase];

  if (maxPrecision < requiredPrecision) {
    return {
      isValid: false,
      error: `Coordinates need at least ${requiredPrecision} decimal places for ${useCase} use case`,
      recommendedPrecision: requiredPrecision
    };
  }

  if (maxPrecision > 8) {
    return {
      isValid: false,
      error: 'Coordinates have too many decimal places (max 8)',
      recommendedPrecision: 6
    };
  }

  return { isValid: true };
}

// Calculate distance between two coordinates (Haversine formula)
export function calculateDistance(
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Convert degrees to radians
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Check if coordinates are within a specific radius of a point
export function isWithinRadius(
  lat: number, 
  lng: number, 
  centerLat: number, 
  centerLng: number, 
  radiusKm: number
): boolean {
  const distance = calculateDistance(lat, lng, centerLat, centerLng);
  return distance <= radiusKm;
}

// Validate coordinates for specific geographic regions
export function validateCoordinatesForRegion(
  lat: number, 
  lng: number, 
  region: 'US' | 'EU' | 'ASIA' | 'GLOBAL'
): { isValid: boolean; error?: string; warnings?: string[] } {
  const warnings: string[] = [];

  const regionBounds = {
    US: { latMin: 24, latMax: 71, lngMin: -179, lngMax: -66 },
    EU: { latMin: 35, latMax: 71, lngMin: -25, lngMax: 45 },
    ASIA: { latMin: -11, latMax: 55, lngMin: 73, lngMax: 180 },
    GLOBAL: { latMin: -90, latMax: 90, lngMin: -180, lngMax: 180 }
  };

  const bounds = regionBounds[region];

  if (lat < bounds.latMin || lat > bounds.latMax) {
    return { isValid: false, error: `Latitude ${lat} is outside ${region} bounds` };
  }

  if (lng < bounds.lngMin || lng > bounds.lngMax) {
    return { isValid: false, error: `Longitude ${lng} is outside ${region} bounds` };
  }

  // Add warnings for coordinates near region boundaries
  if (lat < bounds.latMin + 5 || lat > bounds.latMax - 5) {
    warnings.push(`Latitude is near ${region} boundary`);
  }

  if (lng < bounds.lngMin + 5 || lng > bounds.lngMax - 5) {
    warnings.push(`Longitude is near ${region} boundary`);
  }

  return { isValid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

// Text sanitization utilities
export function sanitizeText(text: string | null | undefined, maxLength?: number): string | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // Remove control characters and normalize whitespace
  let sanitized = text
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Truncate if maxLength is specified
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength).trim();
  }

  return sanitized === '' ? null : sanitized;
}

// Email validation utilities
export function validateEmail(email: string): { isValid: boolean; error?: string; normalizedEmail?: string } {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  // Clean and normalize email
  let cleanEmail = email.trim().toLowerCase();
  
  // Remove any whitespace and control characters
  cleanEmail = cleanEmail.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Basic format validation
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(cleanEmail)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  // Length validation
  if (cleanEmail.length > 254) {
    return { isValid: false, error: 'Email too long (max 254 characters)' };
  }

  // Check for suspicious patterns
  if (isSuspiciousEmail(cleanEmail)) {
    return { isValid: false, error: 'Email contains suspicious patterns' };
  }

  // Validate domain
  const domainValidation = validateEmailDomain(cleanEmail);
  if (!domainValidation.isValid) {
    return { isValid: false, error: domainValidation.error };
  }

  return { isValid: true, normalizedEmail: cleanEmail };
}

// Check for suspicious email patterns
function isSuspiciousEmail(email: string): boolean {
  const suspiciousPatterns = [
    /test@test/i,
    /example@example/i,
    /admin@admin/i,
    /root@root/i,
    /user@user/i,
    /noreply@noreply/i,
    /no-reply@no-reply/i,
    /donotreply@donotreply/i,
    /spam@spam/i,
    /fake@fake/i,
    /temp@temp/i,
    /temporary@temporary/i,
    /throwaway@throwaway/i,
    /disposable@disposable/i,
    /10minutemail/i,
    /guerrillamail/i,
    /mailinator/i,
    /tempmail/i,
    /trashmail/i
  ];

  return suspiciousPatterns.some(pattern => pattern.test(email));
}

// Validate email domain
function validateEmailDomain(email: string): { isValid: boolean; error?: string } {
  const domain = email.split('@')[1];
  
  if (!domain) {
    return { isValid: false, error: 'Invalid email domain' };
  }

  // Check for valid domain format
  const domainRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!domainRegex.test(domain)) {
    return { isValid: false, error: 'Invalid domain format' };
  }

  // Check for minimum domain length
  if (domain.length < 3) {
    return { isValid: false, error: 'Domain too short' };
  }

  // Check for maximum domain length
  if (domain.length > 253) {
    return { isValid: false, error: 'Domain too long' };
  }

  // Check for valid TLD
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) {
    return { isValid: false, error: 'Invalid top-level domain' };
  }

  return { isValid: true };
}

// Validate multiple emails
export function validateEmails(emails: string[]): { 
  valid: string[]; 
  invalid: Array<{ email: string; error: string }>; 
  normalized: string[] 
} {
  const valid: string[] = [];
  const invalid: Array<{ email: string; error: string }> = [];
  const normalized: string[] = [];

  emails.forEach(email => {
    const validation = validateEmail(email);
    if (validation.isValid) {
      valid.push(email);
      normalized.push(validation.normalizedEmail!);
    } else {
      invalid.push({ email, error: validation.error! });
    }
  });

  return { valid, invalid, normalized };
}

// Check if email is from a trusted domain
export function isTrustedEmailDomain(email: string, trustedDomains: string[] = []): boolean {
  const domain = email.split('@')[1];
  if (!domain) return false;

  const defaultTrustedDomains = [
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'icloud.com',
    'aol.com',
    'protonmail.com',
    'google.com',
    'microsoft.com',
    'apple.com',
    'eventbrite.com',
    'ticketmaster.com',
    'seatgeek.com',
    'meetup.com',
    'facebook.com'
  ];

  const allTrustedDomains = [...defaultTrustedDomains, ...trustedDomains];
  
  return allTrustedDomains.some(trustedDomain => 
    domain === trustedDomain || domain.endsWith(`.${trustedDomain}`)
  );
}

// Sanitize email for display (hide part of local part)
export function sanitizeEmailForDisplay(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email;

  if (localPart.length <= 2) {
    return `${localPart[0]}*@${domain}`;
  }

  const visibleStart = localPart.substring(0, 2);
  const visibleEnd = localPart.substring(localPart.length - 1);
  const hiddenMiddle = '*'.repeat(Math.min(localPart.length - 3, 6));
  
  return `${visibleStart}${hiddenMiddle}${visibleEnd}@${domain}`;
}

// Validate and sanitize email with additional checks
export function validateAndSanitizeEmail(
  email: string,
  options: {
    allowDisposable?: boolean;
    trustedDomains?: string[];
    maxLength?: number;
    requireTrustedDomain?: boolean;
  } = {}
): {
  isValid: boolean;
  error?: string;
  normalizedEmail?: string;
  warnings?: string[];
} {
  const {
    allowDisposable = false,
    trustedDomains = [],
    maxLength = 254,
    requireTrustedDomain = false
  } = options;

  const warnings: string[] = [];

  // Basic validation
  const validation = validateEmail(email);
  if (!validation.isValid) {
    return validation;
  }

  const normalizedEmail = validation.normalizedEmail!;

  // Check length
  if (normalizedEmail.length > maxLength) {
    return { isValid: false, error: `Email too long (max ${maxLength} characters)` };
  }

  // Check for disposable email if not allowed
  if (!allowDisposable && isDisposableEmail(normalizedEmail)) {
    return { isValid: false, error: 'Disposable email addresses are not allowed' };
  }

  // Check if domain is trusted
  if (!isTrustedEmailDomain(normalizedEmail, trustedDomains)) {
    if (requireTrustedDomain) {
      return { isValid: false, error: 'Email must be from a trusted domain' };
    } else {
      warnings.push('Email is from an untrusted domain');
    }
  }

  // Check for suspicious patterns
  if (isSuspiciousEmail(normalizedEmail)) {
    warnings.push('Email appears to be suspicious or temporary');
  }

  return {
    isValid: true,
    normalizedEmail,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

// Check if email is from a disposable email service
function isDisposableEmail(email: string): boolean {
  const disposableDomains = [
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'tempmail.org',
    'trashmail.com',
    'throwaway.email',
    'temp-mail.org',
    'getnada.com',
    'maildrop.cc',
    'yopmail.com'
  ];

  const domain = email.split('@')[1];
  return disposableDomains.some(disposableDomain => 
    domain === disposableDomain || domain.endsWith(`.${disposableDomain}`)
  );
}

// Phone number validation utilities
export function validatePhoneNumber(phone: string): { isValid: boolean; error?: string; normalizedPhone?: string } {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length < 10) {
    return { isValid: false, error: 'Phone number too short' };
  }

  if (digits.length > 15) {
    return { isValid: false, error: 'Phone number too long' };
  }

  return { isValid: true, normalizedPhone: digits };
}

// Comprehensive event validation
export function validateCompleteEvent(event: any): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: ValidatedEvent;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic schema validation
  const schemaResult = validateEventData(event);
  if (!schemaResult.isValid) {
    errors.push(...schemaResult.errors);
    return { isValid: false, errors, warnings };
  }

  const data = schemaResult.data!;

  // Enhanced date/time validation with timezone support
  const startDateValidation = validateDateTimeWithTimezone(data.startUtc, data.timezone);
  if (!startDateValidation.isValid) {
    errors.push(`Start date validation failed: ${startDateValidation.error}`);
  }

  if (data.endUtc) {
    const endDateValidation = validateDateTimeWithTimezone(data.endUtc, data.timezone);
    if (!endDateValidation.isValid) {
      errors.push(`End date validation failed: ${endDateValidation.error}`);
    } else {
      // Validate event duration
      const durationValidation = validateEventDuration(data.startUtc, data.endUtc);
      if (!durationValidation.isValid) {
        errors.push(durationValidation.error!);
      } else if (durationValidation.durationMinutes) {
        // Add duration warnings
        const durationHours = Math.floor(durationValidation.durationMinutes / 60);
        if (durationHours > 24) {
          warnings.push(`Event duration is ${durationHours} hours (${Math.floor(durationHours / 24)} days)`);
        }
      }
    }
  }

  // Validate timezone if provided
  if (data.timezone) {
    const timezoneValidation = validateTimezone(data.timezone);
    if (!timezoneValidation.isValid) {
      errors.push(`Timezone validation failed: ${timezoneValidation.error}`);
    }
  }

  // Validate coordinates if provided
  if (data.lat !== undefined || data.lng !== undefined) {
    const coordResult = validateCoordinates(data.lat, data.lng, {
      allowPartial: false,
      precision: 6,
      checkRealisticBounds: true
    });
    if (!coordResult.isValid) {
      errors.push(coordResult.error!);
    } else {
      // Add coordinate warnings to the main warnings array
      if (coordResult.warnings) {
        warnings.push(...coordResult.warnings.map(w => `Coordinates: ${w}`));
      }
    }
  }

  // Validate URL if provided
  if (data.url && data.url !== '') {
    const urlResult = validateAndSanitizeUrl(data.url, {
      allowHttp: false,
      requireHttps: true,
      maxLength: 2000,
      trustedDomains: ['eventbrite.com', 'ticketmaster.com', 'seatgeek.com', 'google.com']
    });
    
    if (!urlResult.isValid) {
      errors.push(urlResult.error!);
    } else {
      // Add URL warnings to the main warnings array
      if (urlResult.warnings) {
        warnings.push(...urlResult.warnings);
      }
    }
  }

  // Validate organizer email if provided
  if (data.organizerEmail && data.organizerEmail !== '') {
    const emailResult = validateAndSanitizeEmail(data.organizerEmail, {
      allowDisposable: false,
      trustedDomains: ['eventbrite.com', 'ticketmaster.com', 'seatgeek.com', 'google.com', 'meetup.com'],
      requireTrustedDomain: false
    });
    
    if (!emailResult.isValid) {
      errors.push(`Organizer email validation failed: ${emailResult.error}`);
    } else {
      // Add email warnings to the main warnings array
      if (emailResult.warnings) {
        warnings.push(...emailResult.warnings.map(w => `Organizer email: ${w}`));
      }
    }
  }

  // Validate contact email if provided
  if (data.contactEmail && data.contactEmail !== '') {
    const emailResult = validateAndSanitizeEmail(data.contactEmail, {
      allowDisposable: false,
      trustedDomains: ['eventbrite.com', 'ticketmaster.com', 'seatgeek.com', 'google.com', 'meetup.com'],
      requireTrustedDomain: false
    });
    
    if (!emailResult.isValid) {
      errors.push(`Contact email validation failed: ${emailResult.error}`);
    } else {
      // Add email warnings to the main warnings array
      if (emailResult.warnings) {
        warnings.push(...emailResult.warnings.map(w => `Contact email: ${w}`));
      }
    }
  }

  // Check for potential duplicates based on title and date
  if (data.title && data.startUtc) {
    const titleWords = data.title.toLowerCase().split(/\s+/);
    if (titleWords.length < 2) {
      warnings.push('Event title is very short, consider adding more details');
    }
  }

  // Add timezone-related warnings
  if (!data.timezone) {
    warnings.push('No timezone specified, assuming UTC');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    data: errors.length === 0 ? data : undefined
  };
}

// Venue name formatting utilities
export function formatVenueName(
  venueName: string | null | undefined,
  source: 'googlecal' | 'eventbrite' | 'ticketmaster' | 'seatgeek' | 'manual'
): string | null {
  if (!venueName || typeof venueName !== 'string') {
    return null;
  }

  // Clean and normalize the venue name
  let formatted = venueName.trim();
  
  // Remove control characters and normalize whitespace
  formatted = formatted
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (formatted === '') {
    return null;
  }

  // Apply source-specific formatting
  switch (source) {
    case 'googlecal':
      return formatGoogleCalendarVenueName(formatted);
    case 'eventbrite':
      return formatEventbriteVenueName(formatted);
    case 'ticketmaster':
      return formatTicketmasterVenueName(formatted);
    case 'seatgeek':
      return formatSeatGeekVenueName(formatted);
    case 'manual':
      return formatManualVenueName(formatted);
    default:
      return formatGenericVenueName(formatted);
  }
}

// Format venue name from Google Calendar
function formatGoogleCalendarVenueName(venueName: string): string {
  // Google Calendar often includes full addresses in location field
  // Extract just the venue name if possible
  let formatted = venueName;
  
  // Remove common address patterns
  formatted = formatted
    .replace(/,\s*\d{5}(-\d{4})?(\s*[A-Z]{2})?/g, '') // Remove ZIP codes
    .replace(/,\s*[A-Z]{2}\s*\d{5}/g, '') // Remove state ZIP
    .replace(/,\s*[A-Z]{2}$/g, '') // Remove trailing state
    .replace(/,\s*USA$/i, '') // Remove trailing USA
    .replace(/,\s*United States$/i, '') // Remove trailing United States
    .replace(/,\s*US$/i, '') // Remove trailing US
    .trim();

  // If it looks like a full address, try to extract venue name
  if (formatted.includes(',')) {
    const parts = formatted.split(',');
    // Take the first part as venue name if it looks like a venue
    const firstPart = parts[0].trim();
    if (isLikelyVenueName(firstPart)) {
      formatted = firstPart;
    }
  }

  return capitalizeVenueName(formatted);
}

// Format venue name from Eventbrite
function formatEventbriteVenueName(venueName: string): string {
  let formatted = venueName;
  
  // Eventbrite venue names are usually clean, but may have extra info
  // Remove common suffixes
  formatted = formatted
    .replace(/\s*-\s*Eventbrite$/i, '')
    .replace(/\s*@\s*Eventbrite$/i, '')
    .replace(/\s*\(Eventbrite\)$/i, '')
    .trim();

  return capitalizeVenueName(formatted);
}

// Format venue name from Ticketmaster
function formatTicketmasterVenueName(venueName: string): string {
  let formatted = venueName;
  
  // Ticketmaster venue names are usually clean
  // Remove common suffixes
  formatted = formatted
    .replace(/\s*-\s*Ticketmaster$/i, '')
    .replace(/\s*@\s*Ticketmaster$/i, '')
    .replace(/\s*\(Ticketmaster\)$/i, '')
    .trim();

  return capitalizeVenueName(formatted);
}

// Format venue name from SeatGeek
function formatSeatGeekVenueName(venueName: string): string {
  let formatted = venueName;
  
  // SeatGeek venue names are usually clean
  // Remove common suffixes
  formatted = formatted
    .replace(/\s*-\s*SeatGeek$/i, '')
    .replace(/\s*@\s*SeatGeek$/i, '')
    .replace(/\s*\(SeatGeek\)$/i, '')
    .trim();

  return capitalizeVenueName(formatted);
}

// Format manually entered venue name
function formatManualVenueName(venueName: string): string {
  let formatted = venueName;
  
  // Clean up common manual entry issues
  formatted = formatted
    .replace(/\s*-\s*Manual$/i, '')
    .replace(/\s*@\s*Manual$/i, '')
    .replace(/\s*\(Manual\)$/i, '')
    .trim();

  return capitalizeVenueName(formatted);
}

// Format generic venue name
function formatGenericVenueName(venueName: string): string {
  return capitalizeVenueName(venueName);
}

// Check if a string looks like a venue name
function isLikelyVenueName(text: string): boolean {
  const venueIndicators = [
    'theater', 'theatre', 'center', 'centre', 'arena', 'stadium', 'hall',
    'auditorium', 'pavilion', 'club', 'bar', 'restaurant', 'cafe', 'coffee',
    'gallery', 'museum', 'library', 'church', 'temple', 'mosque', 'synagogue',
    'park', 'garden', 'plaza', 'square', 'mall', 'shopping', 'convention',
    'conference', 'hotel', 'resort', 'casino', 'racetrack', 'field', 'grounds'
  ];

  const lowerText = text.toLowerCase();
  return venueIndicators.some(indicator => lowerText.includes(indicator)) ||
         text.length > 5; // Assume longer text is more likely to be a venue
}

// Capitalize venue name properly
function capitalizeVenueName(venueName: string): string {
  if (!venueName) return venueName;

  // Split into words and capitalize each appropriately
  const words = venueName.split(/\s+/);
  const capitalizedWords = words.map(word => {
    if (!word) return word;
    
    // Handle common venue name patterns
    const lowerWord = word.toLowerCase();
    
    // Articles and prepositions (lowercase unless first word)
    const articles = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    if (articles.includes(lowerWord) && words.indexOf(word) > 0) {
      return lowerWord;
    }
    
    // Common venue suffixes (always capitalize)
    const suffixes = ['theater', 'theatre', 'center', 'centre', 'arena', 'stadium', 'hall', 'auditorium'];
    if (suffixes.includes(lowerWord)) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    
    // Handle special cases for common venue names and acronyms
    const specialCases: Record<string, string> = {
      'msg': 'MSG',
      'at&t': 'AT&T',
      'nba': 'NBA',
      'nfl': 'NFL',
      'mlb': 'MLB',
      'nhl': 'NHL',
      'ncaa': 'NCAA',
      'vip': 'VIP',
      'usa': 'USA',
      'us': 'US',
      'uk': 'UK',
      'nyc': 'NYC',
      'la': 'LA',
      'sf': 'SF',
      'dc': 'DC'
    };
    
    if (specialCases[lowerWord]) {
      return specialCases[lowerWord];
    }
    
    // Handle hyphenated words
    if (word.includes('-')) {
      return word.split('-').map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join('-');
    }
    
    // Handle apostrophes
    if (word.includes("'")) {
      return word.split("'").map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join("'");
    }
    
    // Handle parentheses (capitalize content)
    if (word.includes('(') && word.includes(')')) {
      const openParen = word.indexOf('(');
      const closeParen = word.indexOf(')');
      const beforeParen = word.substring(0, openParen);
      const inParen = word.substring(openParen + 1, closeParen);
      const afterParen = word.substring(closeParen + 1);
      
      return capitalizeVenueName(beforeParen) + 
             '(' + capitalizeVenueName(inParen) + ')' + 
             capitalizeVenueName(afterParen);
    }
    
    // Regular word capitalization
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return capitalizedWords.join(' ');
}

// Validate venue name
export function validateVenueName(venueName: string): {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  normalizedName?: string;
} {
  if (!venueName || typeof venueName !== 'string') {
    return { isValid: true };
  }

  const warnings: string[] = [];
  let normalizedName = venueName.trim();

  // Check length
  if (normalizedName.length > 255) {
    return { isValid: false, error: 'Venue name too long (max 255 characters)' };
  }

  if (normalizedName.length < 2) {
    return { isValid: false, error: 'Venue name too short (min 2 characters)' };
  }

  // Check for suspicious patterns
  if (isSuspiciousVenueName(normalizedName)) {
    warnings.push('Venue name contains suspicious patterns');
  }

  // Check for common issues
  if (normalizedName === normalizedName.toUpperCase()) {
    warnings.push('Venue name is all uppercase - consider proper capitalization');
  }

  if (normalizedName === normalizedName.toLowerCase()) {
    warnings.push('Venue name is all lowercase - consider proper capitalization');
  }

  // Check for excessive punctuation
  const punctuationCount = (normalizedName.match(/[.,!?;:]/g) || []).length;
  if (punctuationCount > 3) {
    warnings.push('Venue name has excessive punctuation');
  }

  // Check for numbers at the beginning (might be an address)
  if (/^\d/.test(normalizedName)) {
    warnings.push('Venue name starts with a number - might be an address');
  }

  // Normalize the name
  normalizedName = normalizedName
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:]+$/, '') // Remove trailing punctuation
    .trim();

  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    normalizedName
  };
}

// Check for suspicious venue name patterns
function isSuspiciousVenueName(venueName: string): boolean {
  const suspiciousPatterns = [
    /test/i,
    /example/i,
    /sample/i,
    /placeholder/i,
    /temp/i,
    /temporary/i,
    /fake/i,
    /dummy/i,
    /spam/i,
    /scam/i,
    /malware/i,
    /virus/i,
    /phishing/i,
    /javascript:/i,
    /<script/i,
    /onclick/i,
    /onload/i,
    /onerror/i
  ];

  return suspiciousPatterns.some(pattern => pattern.test(venueName));
}

// Extract venue name from address string
export function extractVenueNameFromAddress(address: string): string | null {
  if (!address || typeof address !== 'string') {
    return null;
  }

  // Split by common separators
  const parts = address.split(/[,;]/).map(part => part.trim());
  
  // Look for the first part that looks like a venue name
  for (const part of parts) {
    if (isLikelyVenueName(part) && part.length > 3) {
      return formatGenericVenueName(part);
    }
  }

  // If no venue-like part found, return the first part
  return parts[0] ? formatGenericVenueName(parts[0]) : null;
}

// Normalize venue name across sources
export function normalizeVenueName(
  venueName: string | null | undefined,
  source: 'googlecal' | 'eventbrite' | 'ticketmaster' | 'seatgeek' | 'manual'
): {
  normalizedName: string | null | undefined;
  warnings?: string[];
} {
  const warnings: string[] = [];

  // Format the venue name
  const formattedName = formatVenueName(venueName, source);
  if (!formattedName) {
    return { normalizedName: undefined };
  }

  // Validate the formatted name
  const validation = validateVenueName(formattedName);
  if (!validation.isValid) {
    warnings.push(`Venue name validation failed: ${validation.error}`);
    return { normalizedName: undefined, warnings };
  }

  if (validation.warnings) {
    warnings.push(...validation.warnings);
  }

  return {
    normalizedName: validation.normalizedName || formattedName,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

// Address normalization interfaces
export interface NormalizedAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  fullAddress?: string;
}

export interface AddressParseResult {
  isValid: boolean;
  normalizedAddress?: NormalizedAddress;
  warnings?: string[];
  error?: string;
}

// Address normalization utilities
export function normalizeAddress(
  address: string | null | undefined,
  source: 'googlecal' | 'eventbrite' | 'ticketmaster' | 'seatgeek' | 'manual'
): AddressParseResult {
  if (!address || typeof address !== 'string') {
    return { isValid: true };
  }

  const warnings: string[] = [];
  let cleanAddress = address.trim();

  // Remove control characters and normalize whitespace
  cleanAddress = cleanAddress
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanAddress === '') {
    return { isValid: true };
  }

  // Apply source-specific normalization
  switch (source) {
    case 'googlecal':
      return normalizeGoogleCalendarAddress(cleanAddress);
    case 'eventbrite':
      return normalizeEventbriteAddress(cleanAddress);
    case 'ticketmaster':
      return normalizeTicketmasterAddress(cleanAddress);
    case 'seatgeek':
      return normalizeSeatGeekAddress(cleanAddress);
    case 'manual':
      return normalizeManualAddress(cleanAddress);
    default:
      return normalizeGenericAddress(cleanAddress);
  }
}

// Normalize address from Google Calendar (often contains full location info)
function normalizeGoogleCalendarAddress(address: string): AddressParseResult {
  const warnings: string[] = [];
  
  // Google Calendar addresses often mix venue names with addresses
  // Try to extract structured address components
  
  // Remove common venue indicators that might be mixed in
  let cleanAddress = address
    .replace(/^(The\s+)?[A-Z][a-z]+\s+(Theater|Theatre|Center|Centre|Arena|Stadium|Hall|Auditorium|Pavilion)\s*,?\s*/i, '')
    .replace(/\s*-\s*Google\s*Calendar$/i, '')
    .replace(/\s*@\s*Google$/i, '')
    .trim();

  // If the address contains a venue name followed by an address, try to extract just the address part
  // Look for patterns like "Venue Name, 123 Street, City, State ZIP"
  const venueAddressPattern = /^[^,]+,\s*(\d+\s+[^,]+),\s*(.+)$/;
  const venueMatch = cleanAddress.match(venueAddressPattern);
  if (venueMatch) {
    // Extract just the address part (street + rest)
    cleanAddress = `${venueMatch[1]}, ${venueMatch[2]}`;
  }

  const result = parseStructuredAddress(cleanAddress);
  if (result.warnings) {
    warnings.push(...result.warnings);
  }

  return {
    isValid: result.isValid,
    normalizedAddress: result.normalizedAddress,
    warnings: warnings.length > 0 ? warnings : undefined,
    error: result.error
  };
}

// Normalize address from Eventbrite (usually well-structured)
function normalizeEventbriteAddress(address: string): AddressParseResult {
  const warnings: string[] = [];
  
  let cleanAddress = address
    .replace(/\s*-\s*Eventbrite$/i, '')
    .replace(/\s*@\s*Eventbrite$/i, '')
    .replace(/\s*\(Eventbrite\)$/i, '')
    .trim();

  const result = parseStructuredAddress(cleanAddress);
  if (result.warnings) {
    warnings.push(...result.warnings);
  }

  return {
    isValid: result.isValid,
    normalizedAddress: result.normalizedAddress,
    warnings: warnings.length > 0 ? warnings : undefined,
    error: result.error
  };
}

// Normalize address from Ticketmaster (usually well-structured)
function normalizeTicketmasterAddress(address: string): AddressParseResult {
  const warnings: string[] = [];
  
  let cleanAddress = address
    .replace(/\s*-\s*Ticketmaster$/i, '')
    .replace(/\s*@\s*Ticketmaster$/i, '')
    .replace(/\s*\(Ticketmaster\)$/i, '')
    .trim();

  const result = parseStructuredAddress(cleanAddress);
  if (result.warnings) {
    warnings.push(...result.warnings);
  }

  return {
    isValid: result.isValid,
    normalizedAddress: result.normalizedAddress,
    warnings: warnings.length > 0 ? warnings : undefined,
    error: result.error
  };
}

// Normalize address from SeatGeek (usually well-structured)
function normalizeSeatGeekAddress(address: string): AddressParseResult {
  const warnings: string[] = [];
  
  let cleanAddress = address
    .replace(/\s*-\s*SeatGeek$/i, '')
    .replace(/\s*@\s*SeatGeek$/i, '')
    .replace(/\s*\(SeatGeek\)$/i, '')
    .trim();

  const result = parseStructuredAddress(cleanAddress);
  if (result.warnings) {
    warnings.push(...result.warnings);
  }

  return {
    isValid: result.isValid,
    normalizedAddress: result.normalizedAddress,
    warnings: warnings.length > 0 ? warnings : undefined,
    error: result.error
  };
}

// Normalize manually entered address
function normalizeManualAddress(address: string): AddressParseResult {
  const warnings: string[] = [];
  
  let cleanAddress = address
    .replace(/\s*-\s*Manual$/i, '')
    .replace(/\s*@\s*Manual$/i, '')
    .replace(/\s*\(Manual\)$/i, '')
    .trim();

  const result = parseStructuredAddress(cleanAddress);
  if (result.warnings) {
    warnings.push(...result.warnings);
  }

  return {
    isValid: result.isValid,
    normalizedAddress: result.normalizedAddress,
    warnings: warnings.length > 0 ? warnings : undefined,
    error: result.error
  };
}

// Normalize generic address
function normalizeGenericAddress(address: string): AddressParseResult {
  return parseStructuredAddress(address);
}

// Parse structured address from string
function parseStructuredAddress(address: string): AddressParseResult {
  const warnings: string[] = [];
  
  if (!address || address.trim() === '') {
    return { isValid: true };
  }

  // Common address patterns to handle (in order of specificity)
  const patterns = [
    // US format with ZIP: "123 Main St, City, State ZIP"
    {
      regex: /^(.+?),\s*([^,]+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i,
      handler: (match: RegExpMatchArray) => ({
        street: match[1].trim(),
        city: match[2].trim(),
        state: match[3].trim().toUpperCase(),
        postalCode: match[4].trim(),
        country: 'United States'
      })
    },
    // Canadian format: "123 Main St, City, Province PostalCode"
    {
      regex: /^(.+?),\s*([^,]+?),\s*([A-Z]{2})\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d)$/i,
      handler: (match: RegExpMatchArray) => ({
        street: match[1].trim(),
        city: match[2].trim(),
        state: match[3].trim().toUpperCase(),
        postalCode: match[4].trim().toUpperCase(),
        country: 'Canada'
      })
    },
    // UK format: "123 Main St, City PostalCode"
    {
      regex: /^(.+?),\s*([^,]+?)\s+([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})$/i,
      handler: (match: RegExpMatchArray) => ({
        street: match[1].trim(),
        city: match[2].trim(),
        postalCode: match[3].trim().toUpperCase(),
        country: 'United Kingdom'
      })
    },
    // International format: "123 Main St, City, Country"
    {
      regex: /^(.+?),\s*([^,]+?),\s*([^,]+)$/,
      handler: (match: RegExpMatchArray) => ({
        street: match[1].trim(),
        city: match[2].trim(),
        country: match[3].trim()
      })
    },
    // Simple format: "123 Main St, City"
    {
      regex: /^(.+?),\s*([^,]+)$/,
      handler: (match: RegExpMatchArray) => ({
        street: match[1].trim(),
        city: match[2].trim()
      })
    },
    // Just city, state (US)
    {
      regex: /^([^,]+),\s*([A-Z]{2})$/i,
      handler: (match: RegExpMatchArray) => ({
        city: match[1].trim(),
        state: match[2].trim().toUpperCase(),
        country: 'United States'
      })
    },
    // Just city, country
    {
      regex: /^([^,]+),\s*([^,]+)$/,
      handler: (match: RegExpMatchArray) => ({
        city: match[1].trim(),
        country: match[2].trim()
      })
    }
  ];

  let normalizedAddress: NormalizedAddress = {};
  let matched = false;

  for (const pattern of patterns) {
    const match = address.match(pattern.regex);
    if (match) {
      matched = true;
      normalizedAddress = pattern.handler(match);
      break;
    }
  }

  // If no pattern matched, treat as a single component
  if (!matched) {
    // Check if it looks like a city name
    if (isLikelyCityName(address)) {
      normalizedAddress = { city: address.trim() };
    } else {
      // Treat as street address
      normalizedAddress = { street: address.trim() };
      warnings.push('Address format not recognized - treating as street address');
    }
  }

  // Validate and clean components
  if (normalizedAddress.street) {
    normalizedAddress.street = cleanStreetAddress(normalizedAddress.street);
  }
  
  if (normalizedAddress.city) {
    normalizedAddress.city = cleanCityName(normalizedAddress.city);
  }
  
  if (normalizedAddress.state) {
    normalizedAddress.state = cleanStateName(normalizedAddress.state);
  }
  
  if (normalizedAddress.country) {
    normalizedAddress.country = cleanCountryName(normalizedAddress.country);
  }
  
  if (normalizedAddress.postalCode) {
    normalizedAddress.postalCode = cleanPostalCode(normalizedAddress.postalCode);
  }

  // Build full address with proper formatting
  const fullAddressParts = [];
  
  if (normalizedAddress.street) {
    fullAddressParts.push(normalizedAddress.street);
  }
  
  if (normalizedAddress.city) {
    fullAddressParts.push(normalizedAddress.city);
  }
  
  if (normalizedAddress.state && normalizedAddress.postalCode) {
    fullAddressParts.push(`${normalizedAddress.state} ${normalizedAddress.postalCode}`);
  } else if (normalizedAddress.state) {
    fullAddressParts.push(normalizedAddress.state);
  } else if (normalizedAddress.postalCode) {
    fullAddressParts.push(normalizedAddress.postalCode);
  }
  
  if (normalizedAddress.country) {
    fullAddressParts.push(normalizedAddress.country);
  }

  normalizedAddress.fullAddress = fullAddressParts.join(', ');

  // Add validation warnings
  if (!normalizedAddress.street && !normalizedAddress.city) {
    warnings.push('Address missing both street and city information');
  }

  if (normalizedAddress.state && !isValidUSState(normalizedAddress.state)) {
    warnings.push(`State "${normalizedAddress.state}" may not be valid`);
  }

  if (normalizedAddress.postalCode && !isValidPostalCode(normalizedAddress.postalCode)) {
    warnings.push(`Postal code "${normalizedAddress.postalCode}" format may be invalid`);
  }

  return {
    isValid: true,
    normalizedAddress,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

// Clean street address
function cleanStreetAddress(street: string): string {
  return street
    .replace(/[.,!?;:]+$/, '') // Remove trailing punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

// Clean city name
function cleanCityName(city: string): string {
  return city
    .replace(/[.,!?;:]+$/, '') // Remove trailing punctuation
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Clean state name
function cleanStateName(state: string): string {
  const cleaned = state.trim().toUpperCase();
  
  // Convert full state names to abbreviations
  const stateMap: Record<string, string> = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
    'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
    'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
    'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
    'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
    'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
    'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
    'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
    'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
    'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
    'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC'
  };

  return stateMap[cleaned] || cleaned;
}

// Clean country name
function cleanCountryName(country: string): string {
  const cleaned = country.trim();
  
  // Convert common country variations to standard names
  const countryMap: Record<string, string> = {
    'USA': 'United States',
    'US': 'United States',
    'UNITED STATES': 'United States',
    'AMERICA': 'United States',
    'UK': 'United Kingdom',
    'ENGLAND': 'United Kingdom',
    'BRITAIN': 'United Kingdom',
    'GB': 'United Kingdom',
    'CA': 'Canada',
    'AU': 'Australia',
    'DE': 'Germany',
    'FR': 'France',
    'IT': 'Italy',
    'ES': 'Spain',
    'JP': 'Japan',
    'CN': 'China',
    'IN': 'India',
    'BR': 'Brazil',
    'MX': 'Mexico'
  };

  const upperCleaned = cleaned.toUpperCase();
  return countryMap[upperCleaned] || cleaned;
}

// Clean postal code
function cleanPostalCode(postalCode: string): string {
  return postalCode.trim().toUpperCase();
}

// Check if string looks like a city name
function isLikelyCityName(text: string): boolean {
  const cityIndicators = [
    'city', 'town', 'village', 'burg', 'ville', 'port', 'beach', 'springs',
    'heights', 'hills', 'valley', 'grove', 'park', 'ridge', 'dale', 'ford'
  ];

  const lowerText = text.toLowerCase();
  return cityIndicators.some(indicator => lowerText.includes(indicator)) ||
         text.length > 3; // Assume longer text is more likely to be a city
}

// Validate US state abbreviation
function isValidUSState(state: string): boolean {
  const validStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ];
  
  return validStates.includes(state.toUpperCase());
}

// Validate postal code format
function isValidPostalCode(postalCode: string): boolean {
  // US ZIP code pattern
  const usZipPattern = /^\d{5}(-\d{4})?$/;
  // Canadian postal code pattern
  const caPostalPattern = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/;
  // UK postal code pattern (simplified)
  const ukPostalPattern = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/;
  
  return usZipPattern.test(postalCode) || 
         caPostalPattern.test(postalCode) || 
         ukPostalPattern.test(postalCode);
}

// Format address for display
export function formatAddressForDisplay(address: NormalizedAddress): string {
  if (!address) return '';
  
  const parts = [
    address.street,
    address.city,
    address.state && address.postalCode ? `${address.state} ${address.postalCode}` : address.state,
    address.country
  ].filter(part => part && part.trim() !== '');
  
  return parts.join(', ');
}

// Extract address components from combined string
export function extractAddressComponents(
  addressString: string,
  source: 'googlecal' | 'eventbrite' | 'ticketmaster' | 'seatgeek' | 'manual'
): AddressParseResult {
  return normalizeAddress(addressString, source);
}

// Validate address completeness
export function validateAddressCompleteness(address: NormalizedAddress): {
  isValid: boolean;
  completeness: number; // 0-100 percentage
  missingComponents: string[];
  warnings: string[];
} {
  const missingComponents: string[] = [];
  const warnings: string[] = [];
  
  let score = 0;
  const maxScore = 100;
  
  // Street address (20 points)
  if (address.street && address.street.trim() !== '') {
    score += 20;
  } else {
    missingComponents.push('street');
  }
  
  // City (25 points)
  if (address.city && address.city.trim() !== '') {
    score += 25;
  } else {
    missingComponents.push('city');
  }
  
  // State/Province (15 points)
  if (address.state && address.state.trim() !== '') {
    score += 15;
  } else {
    missingComponents.push('state');
  }
  
  // Country (20 points)
  if (address.country && address.country.trim() !== '') {
    score += 20;
  } else {
    missingComponents.push('country');
  }
  
  // Postal Code (20 points)
  if (address.postalCode && address.postalCode.trim() !== '') {
    score += 20;
    if (!isValidPostalCode(address.postalCode)) {
      warnings.push('Postal code format may be invalid');
    }
  } else {
    missingComponents.push('postalCode');
  }
  
  // Add warnings based on missing critical components
  if (missingComponents.includes('city')) {
    warnings.push('City is missing - this may affect location accuracy');
  }
  
  if (missingComponents.includes('country')) {
    warnings.push('Country is missing - this may affect location accuracy');
  }
  
  if (missingComponents.length === 0) {
    warnings.push('Address is complete and well-structured');
  }
  
  return {
    isValid: score >= 40, // At least city and country or street and city
    completeness: score,
    missingComponents,
    warnings
  };
}

// Compare two addresses for similarity
export function compareAddresses(address1: NormalizedAddress, address2: NormalizedAddress): {
  similarity: number; // 0-100 percentage
  matchingComponents: string[];
  differences: Array<{ component: string; value1?: string; value2?: string }>;
} {
  const matchingComponents: string[] = [];
  const differences: Array<{ component: string; value1?: string; value2?: string }> = [];
  
  const components = ['street', 'city', 'state', 'country', 'postalCode'] as const;
  
  for (const component of components) {
    const val1 = address1[component]?.toLowerCase().trim();
    const val2 = address2[component]?.toLowerCase().trim();
    
    if (val1 && val2) {
      if (val1 === val2) {
        matchingComponents.push(component);
      } else {
        differences.push({ component, value1: address1[component], value2: address2[component] });
      }
    } else if (val1 || val2) {
      differences.push({ component, value1: address1[component], value2: address2[component] });
    }
  }
  
  const similarity = (matchingComponents.length / components.length) * 100;
  
  return {
    similarity,
    matchingComponents,
    differences
  };
}

// Validation result types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: ValidatedEvent;
}

export interface ValidationSummary {
  totalEvents: number;
  validEvents: number;
  invalidEvents: number;
  warnings: number;
  errors: string[];
}

// Enhanced validation error types
export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  suggestion?: string;
}

export interface DetailedValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  data?: ValidatedEvent;
  summary: {
    totalErrors: number;
    totalWarnings: number;
    fieldsWithErrors: string[];
    fieldsWithWarnings: string[];
  };
}

// Enhanced validation with detailed error reporting
export function validateEventDataDetailed(event: any): DetailedValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  try {
    const validatedData = EventValidationSchema.parse(event);
    
    // Additional business logic validations
    const businessValidation = performBusinessLogicValidation(validatedData);
    errors.push(...businessValidation.errors);
    warnings.push(...businessValidation.warnings);
    
    const fieldsWithErrors = [...new Set(errors.map(e => e.field))];
    const fieldsWithWarnings = [...new Set(warnings.map(w => w.field))];
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: errors.length === 0 ? validatedData : undefined,
      summary: {
        totalErrors: errors.length,
        totalWarnings: warnings.length,
        fieldsWithErrors,
        fieldsWithWarnings
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        const field = err.path.join('.');
        errors.push({
          field,
          code: err.code,
          message: err.message,
          value: (err as any).input
        });
      });
    } else {
      errors.push({
        field: 'unknown',
        code: 'unknown_error',
        message: 'Unknown validation error'
      });
    }
    
    return {
      isValid: false,
      errors,
      warnings,
      summary: {
        totalErrors: errors.length,
        totalWarnings: warnings.length,
        fieldsWithErrors: [...new Set(errors.map(e => e.field))],
        fieldsWithWarnings: []
      }
    };
  }
}

// Business logic validation
function performBusinessLogicValidation(event: ValidatedEvent): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // Check for reasonable event duration
  if (event.endUtc && event.startUtc) {
    const start = new Date(event.startUtc);
    const end = new Date(event.endUtc);
    const durationMs = end.getTime() - start.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    
    if (durationMs < 0) {
      errors.push({
        field: 'endUtc',
        code: 'invalid_duration',
        message: 'End date must be after start date',
        value: event.endUtc
      });
    } else if (durationHours > 168) { // 7 days
      warnings.push({
        field: 'endUtc',
        code: 'long_duration',
        message: `Event duration is ${Math.round(durationHours)} hours (${Math.round(durationHours / 24)} days)`,
        suggestion: 'Consider breaking this into multiple events if appropriate'
      });
    } else if (durationHours < 0.017) { // 1 minute
      warnings.push({
        field: 'endUtc',
        code: 'short_duration',
        message: 'Event duration is less than 1 minute',
        suggestion: 'Please verify the end time is correct'
      });
    }
  }
  
  // Check for events too far in the past
  const now = new Date();
  const startDate = new Date(event.startUtc);
  const daysDifference = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysDifference < -365) {
    errors.push({
      field: 'startUtc',
      code: 'too_far_past',
      message: 'Event start date is more than 1 year in the past',
      value: event.startUtc
    });
  } else if (daysDifference < -30) {
    warnings.push({
      field: 'startUtc',
      code: 'past_event',
      message: 'Event start date is in the past',
      suggestion: 'This may be a completed event'
    });
  }
  
  // Check for events too far in the future
  if (daysDifference > 365 * 2) {
    warnings.push({
      field: 'startUtc',
      code: 'far_future',
      message: 'Event start date is more than 2 years in the future',
      suggestion: 'Please verify the date is correct'
    });
  }
  
  // Check for suspicious title patterns
  if (event.title) {
    const titleLower = event.title.toLowerCase();
    if (titleLower.includes('test') || titleLower.includes('example') || titleLower.includes('sample')) {
      warnings.push({
        field: 'title',
        code: 'suspicious_title',
        message: 'Event title appears to be a test or example',
        suggestion: 'Please verify this is a real event'
      });
    }
    
    if (event.title.length < 3) {
      warnings.push({
        field: 'title',
        code: 'short_title',
        message: 'Event title is very short',
        suggestion: 'Consider adding more descriptive details'
      });
    }
  }
  
  // Check for missing location information
  if (!event.venueName && !event.address && !event.lat && !event.lng) {
    warnings.push({
      field: 'location',
      code: 'missing_location',
      message: 'No location information provided',
      suggestion: 'Consider adding venue name, address, or coordinates'
    });
  }
  
  // Check for incomplete location information
  if ((event.lat && !event.lng) || (!event.lat && event.lng)) {
    errors.push({
      field: 'coordinates',
      code: 'incomplete_coordinates',
      message: 'Both latitude and longitude must be provided together',
      value: { lat: event.lat, lng: event.lng }
    });
  }
  
  // Check for URL accessibility (basic check)
  if (event.url && event.url !== '') {
    try {
      const url = new URL(event.url);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push({
          field: 'url',
          code: 'invalid_protocol',
          message: 'URL must use HTTP or HTTPS protocol',
          value: event.url
        });
      }
    } catch {
      // URL validation already handled by Zod schema
    }
  }
  
  // Check for duplicate email addresses
  if (event.organizerEmail && event.contactEmail && 
      event.organizerEmail === event.contactEmail) {
    warnings.push({
      field: 'contactEmail',
      code: 'duplicate_email',
      message: 'Organizer and contact emails are the same',
      suggestion: 'Consider using different email addresses if appropriate'
    });
  }
  
  return { errors, warnings };
}

// User-friendly error message formatting
export function formatValidationErrors(errors: ValidationError[]): string[] {
  return errors.map(error => {
    const fieldName = formatFieldName(error.field);
    return `${fieldName}: ${error.message}`;
  });
}

export function formatValidationWarnings(warnings: ValidationWarning[]): string[] {
  return warnings.map(warning => {
    const fieldName = formatFieldName(warning.field);
    let message = `${fieldName}: ${warning.message}`;
    if (warning.suggestion) {
      message += ` (${warning.suggestion})`;
    }
    return message;
  });
}

function formatFieldName(field: string): string {
  const fieldMap: Record<string, string> = {
    'uid': 'Event ID',
    'source': 'Event Source',
    'title': 'Event Title',
    'description': 'Description',
    'startUtc': 'Start Date',
    'endUtc': 'End Date',
    'timezone': 'Timezone',
    'venueName': 'Venue Name',
    'address': 'Address',
    'lat': 'Latitude',
    'lng': 'Longitude',
    'category': 'Category',
    'tag': 'Tag',
    'url': 'URL',
    'organizerEmail': 'Organizer Email',
    'contactEmail': 'Contact Email',
    'createdByUser': 'Created by User',
    'city': 'City',
    'country': 'Country',
    'status': 'Status',
    'lastSeenAtUtc': 'Last Seen Date',
    'coordinates': 'Coordinates',
    'location': 'Location'
  };
  
  return fieldMap[field] || field;
}

// Validation result formatting for API responses
export function formatValidationResultForAPI(result: DetailedValidationResult) {
  return {
    isValid: result.isValid,
    errors: result.errors.map(error => ({
      field: error.field,
      code: error.code,
      message: error.message
    })),
    warnings: result.warnings.map(warning => ({
      field: warning.field,
      code: warning.code,
      message: warning.message,
      suggestion: warning.suggestion
    })),
    summary: result.summary,
    data: result.data
  };
}

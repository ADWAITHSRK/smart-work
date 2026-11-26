import { hc } from 'hono/client';

import type { AppType } from '@/app/api/[[...route]]/route';

// In the browser, call the API on the same origin the page was served from,
// so a build-time base URL (e.g. localhost) can't send requests to the wrong host.
const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_BASE_URL!;

export const client = hc<AppType>(baseUrl);

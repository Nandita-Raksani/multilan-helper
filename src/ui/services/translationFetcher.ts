/**
 * Translation Fetcher Service
 *
 * Fetches translations from the multilan:search API with pagination.
 * Falls back to bundled JSON if API fails.
 * This runs in the UI context which has access to fetch().
 */

import { config } from '../config';
import type { SearchApiResponse, SearchApiRequest } from '../../adapters/types/searchApi.types';

export interface ApiTranslationResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  source: 'api' | 'bundled';
  stats?: {
    totalElements: number;
    pagesLoaded: number;
  };
}

// Progress callback type
type ProgressCallback = (loaded: number, total: number) => void;

// Store progress callback
let progressCallback: ProgressCallback | null = null;

/**
 * Set progress callback for UI updates
 */
export function setFetchProgressCallback(callback: ProgressCallback | null): void {
  progressCallback = callback;
}

/**
 * Fetch a single page from the search API
 */
async function fetchPage(page: number): Promise<SearchApiResponse | null> {
  const requestBody: SearchApiRequest = {
    pagination: {
      page,
      pageSize: config.apiPageSize,
    },
    sorting: {
      field: 'id',
      direction: 'DESC',
    },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.apiTimeout);

    const response = await fetch(config.translationApiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        // Add any auth headers here if needed
        // 'Authorization': 'Bearer YOUR_TOKEN',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`API returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data as SearchApiResponse;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.warn(`API request timed out (page ${page})`);
      } else if (error.message.includes('CORS') || error.message.includes('NetworkError')) {
        console.warn('API request blocked by CORS');
      } else {
        console.warn('API fetch failed:', error.message);
      }
    }
    return null;
  }
}

/**
 * Fetch all translations from the API with pagination
 * Returns merged response or null if fetch fails
 */
async function fetchAllFromApi(): Promise<{ data: SearchApiResponse; pagesLoaded: number } | null> {
  if (!config.useApiFirst || !config.translationApiUrl) {
    return null;
  }

  // Fetch first page to get total count
  console.log('Fetching translations from API (page 0)...');
  const firstPage = await fetchPage(0);

  if (!firstPage) {
    return null;
  }

  const totalPages = Math.min(firstPage.totalPages, config.maxPages);
  const totalElements = firstPage.totalElements;

  console.log(`Total: ${totalElements} translations across ${totalPages} pages`);

  // Report progress
  if (progressCallback) {
    progressCallback(firstPage.numberOfElements, totalElements);
  }

  // If only one page, return it
  if (totalPages <= 1) {
    return { data: firstPage, pagesLoaded: 1 };
  }

  // Fetch remaining pages
  const allResults = [...firstPage.resultList];
  let pagesLoaded = 1;

  for (let page = 1; page < totalPages; page++) {
    console.log(`Fetching page ${page + 1}/${totalPages}...`);
    const pageData = await fetchPage(page);

    if (!pageData) {
      console.warn(`Failed to fetch page ${page}, stopping pagination`);
      break;
    }

    allResults.push(...pageData.resultList);
    pagesLoaded++;

    // Report progress
    if (progressCallback) {
      progressCallback(allResults.length, totalElements);
    }

    // Check if this was the last page
    if (pageData.isLastPage) {
      break;
    }
  }

  // Build merged response
  const mergedResponse: SearchApiResponse = {
    resultList: allResults,
    isLastPage: true,
    numberOfElements: allResults.length,
    totalElements: firstPage.totalElements,
    totalPages: firstPage.totalPages,
  };

  console.log(`Successfully fetched ${allResults.length} translations from ${pagesLoaded} pages`);
  return { data: mergedResponse, pagesLoaded };
}

/**
 * Attempt to fetch translations from API
 * UI layer calls this and sends result to plugin
 */
export async function fetchTranslations(): Promise<ApiTranslationResponse> {
  // Try API first
  const result = await fetchAllFromApi();

  if (result !== null) {
    return {
      success: true,
      data: result.data,
      source: 'api',
      stats: {
        totalElements: result.data.totalElements,
        pagesLoaded: result.pagesLoaded,
      },
    };
  }

  // API failed - plugin will use bundled JSON
  return {
    success: false,
    error: 'API fetch failed, using bundled translations',
    source: 'bundled',
  };
}

/**
 * Check if API is reachable (for diagnostics)
 */
export async function checkApiConnection(): Promise<{ reachable: boolean; error?: string }> {
  if (!config.translationApiUrl) {
    return { reachable: false, error: 'No API URL configured' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Try a small request to check connectivity
    const response = await fetch(config.translationApiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pagination: { page: 0, pageSize: 1 },
        sorting: { field: 'id', direction: 'DESC' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return { reachable: response.ok };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { reachable: false, error: message };
  }
}

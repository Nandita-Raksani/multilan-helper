// UI Configuration

export const config = {
  // Translation Search API endpoint
  translationApiUrl: 'https://g-net880-prod.be.echonet/EBML-fa01/transversal/ebml-fa01/v1/multilans:search',

  // Request timeout in milliseconds (per request)
  apiTimeout: 30000,

  // Page size for fetching translations (larger = fewer requests)
  apiPageSize: 1000,

  // Maximum pages to fetch (safety limit: 1000 pages * 1000 items = 1M items max)
  maxPages: 1000,

  // Whether to try API first (set to false to always use bundled JSON)
  useApiFirst: true,
};

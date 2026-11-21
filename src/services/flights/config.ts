export function getSerpApiKey(): string {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) throw new Error("SERPAPI_API_KEY environment variable is not set.");
  return key;
}

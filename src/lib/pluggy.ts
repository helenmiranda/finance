import "server-only";

const PLUGGY_API_URL = "https://api.pluggy.ai";
let cachedKey: { value: string; expiresAt: number } | null = null;

export async function getPluggyApiKey() {
  if (cachedKey && cachedKey.expiresAt > Date.now() + 60_000) return cachedKey.value;
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("As credenciais da Pluggy não estão configuradas.");
  const response = await fetch(`${PLUGGY_API_URL}/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, clientSecret }), cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível autenticar com a Pluggy.");
  const data = await response.json() as { apiKey?: string };
  if (!data.apiKey) throw new Error("A Pluggy não retornou uma API Key válida.");
  cachedKey = { value: data.apiKey, expiresAt: Date.now() + 110 * 60_000 };
  return data.apiKey;
}

export async function pluggyRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = await getPluggyApiKey();
  const response = await fetch(`${PLUGGY_API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", "X-API-KEY": apiKey, ...init?.headers }, cache: "no-store" });
  if (!response.ok) throw new Error(`A Pluggy respondeu com o código ${response.status}.`);
  return response.json() as Promise<T>;
}

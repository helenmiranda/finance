import "server-only";

const PLUGGY_API_URL = "https://api.pluggy.ai";
export type PluggyCredentialProfile = "default" | "helen";

const cachedKeys = new Map<PluggyCredentialProfile, { value: string; expiresAt: number }>();

export function credentialProfileForUser(email?: string | null): PluggyCredentialProfile {
  const helenEmail = (process.env.PLUGGY_HELEN_EMAIL ?? "helensmiranda92@gmail.com").trim().toLowerCase();
  return email?.trim().toLowerCase() === helenEmail ? "helen" : "default";
}

function credentialsFor(profile: PluggyCredentialProfile) {
  if (profile === "helen") {
    return { clientId: process.env.PLUGGY_HELEN_CLIENT_ID, clientSecret: process.env.PLUGGY_HELEN_CLIENT_SECRET };
  }
  return { clientId: process.env.PLUGGY_CLIENT_ID, clientSecret: process.env.PLUGGY_CLIENT_SECRET };
}

function configuredProfiles(): PluggyCredentialProfile[] {
  const profiles: PluggyCredentialProfile[] = ["default"];
  const helen = credentialsFor("helen");
  if (helen.clientId && helen.clientSecret) profiles.push("helen");
  return profiles;
}

export async function getPluggyApiKey(profile: PluggyCredentialProfile = "default") {
  const cachedKey = cachedKeys.get(profile);
  if (cachedKey && cachedKey.expiresAt > Date.now() + 60_000) return cachedKey.value;
  const { clientId, clientSecret } = credentialsFor(profile);
  if (!clientId || !clientSecret) throw new Error(profile === "helen"
    ? "As credenciais da segunda conta Pluggy da Helen não estão configuradas."
    : "As credenciais da Pluggy não estão configuradas.");
  const response = await fetch(`${PLUGGY_API_URL}/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, clientSecret }), cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível autenticar com a Pluggy.");
  const data = await response.json() as { apiKey?: string };
  if (!data.apiKey) throw new Error("A Pluggy não retornou uma API Key válida.");
  cachedKeys.set(profile, { value: data.apiKey, expiresAt: Date.now() + 110 * 60_000 });
  return data.apiKey;
}

export async function pluggyRequest<T>(path: string, init?: RequestInit, profile: PluggyCredentialProfile = "default"): Promise<T> {
  const apiKey = await getPluggyApiKey(profile);
  const response = await fetch(`${PLUGGY_API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", "X-API-KEY": apiKey, ...init?.headers }, cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string; codeDescription?: string } | null;
    const detail = body?.message || body?.codeDescription;
    throw new Error(detail ? `Pluggy: ${detail}` : `A Pluggy respondeu com o código ${response.status}.`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

type PluggyWebhook = { id: string; event: string; url: string; enabled?: boolean };
let webhookSetup: Promise<void> | null = null;

export async function ensurePluggyWebhooks() {
  if (webhookSetup) return webhookSetup;
  webhookSetup = (async () => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    const secret = process.env.CRON_SECRET;
    if (!siteUrl?.startsWith("https://") || !secret) throw new Error("A URL pública ou o segredo do webhook não estão configurados.");
    const url = `${siteUrl}/api/webhooks/pluggy`;
    await Promise.all(configuredProfiles().map(async (profile) => {
      const response = await pluggyRequest<PluggyWebhook[] | { results?: PluggyWebhook[] } | undefined>("/webhooks", undefined, profile);
      const existing = Array.isArray(response) ? response : response?.results ?? [];
      for (const event of ["item/updated", "item/error", "transactions/created", "transactions/updated", "transactions/deleted"]) {
        const webhook = existing.find((item) => item.event === event && item.url === url);
        const body = JSON.stringify({ url, event, headers: { Authorization: `Bearer ${secret}` }, enabled: true });
        if (webhook) await pluggyRequest(`/webhooks/${webhook.id}`, { method: "PATCH", body }, profile);
        else await pluggyRequest("/webhooks", { method: "POST", body }, profile);
      }
    }));
  })().catch((error) => {
    webhookSetup = null;
    throw error;
  });
  return webhookSetup;
}

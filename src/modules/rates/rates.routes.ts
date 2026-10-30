import { Router } from "express";

// Taux de conversion du franc CFA (XAF), pour afficher discrètement l'équivalent en euros et en
// dollars à côté des prix. L'euro est à parité fixe (1 € = 655,957 FCFA) ; le dollar suit le taux
// de référence de la BCE (service Frankfurter, sans clé), mis en cache 12 h. Si ce taux n'a jamais
// pu être obtenu, `usd` vaut null et le site n'affiche que l'euro : jamais de taux inventé.

export const XAF_PER_EUR = 655.957;
const TTL_MS = 12 * 60 * 60 * 1000;
const SOURCE = "https://api.frankfurter.app/latest?from=EUR&to=USD";

type UsdRate = { usdPerEur: number; date: string; fetchedAt: number };
let cached: UsdRate | null = null;

async function usdPerEur(fetcher: typeof fetch): Promise<UsdRate | null> {
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached;
  try {
    const response = await fetcher(SOURCE, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as { date?: string; rates?: { USD?: number } };
    const rate = body.rates?.USD;
    if (typeof rate !== "number" || !(rate > 0)) throw new Error("taux absent");
    cached = { usdPerEur: rate, date: body.date ?? "", fetchedAt: Date.now() };
  } catch {
    // On garde le dernier taux connu, même expiré, plutôt que rien.
  }
  return cached;
}

export function createRatesRouter({ fetcher = fetch }: { fetcher?: typeof fetch | undefined } = {}) {
  const router = Router();
  router.get("/", async (_req, res) => {
    const usd = await usdPerEur(fetcher);
    res.json({
      data: {
        base: "XAF",
        // Montant en devise étrangère pour 1 FCFA.
        eur: 1 / XAF_PER_EUR,
        usd: usd ? usd.usdPerEur / XAF_PER_EUR : null,
        usdDate: usd?.date ?? null,
      },
    });
  });
  return router;
}

/** Pour les tests : oublie le taux en cache. */
export function resetRatesCache() {
  cached = null;
}

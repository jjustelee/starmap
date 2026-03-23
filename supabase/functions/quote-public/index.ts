import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TTL_MS = 60 * 1000;

type QuoteStatus = "live" | "cached" | "syncing" | "unavailable";

type QuoteResponse = {
  symbol: string;
  currentPrice: number | null;
  updatedAt: string | null;
  status: QuoteStatus;
  isStale: boolean;
  errorCode?: string;
  priceChange?: number | null;
  priceChangeRate?: number | null;
  priceHigh?: number | null;
  priceLow?: number | null;
};

const inflightQuotes = new Map<string, Promise<QuoteResponse>>();

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeSymbol = (value: unknown): string => String(value ?? "").trim().toUpperCase();

const toIsoOrNull = (value: unknown): string | null => {
  if (!value) return null;
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
};

const withSingleFlight = (key: string, runner: () => Promise<QuoteResponse>): Promise<QuoteResponse> => {
  const existing = inflightQuotes.get(key);
  if (existing) return existing;
  const promise = runner().finally(() => {
    inflightQuotes.delete(key);
  });
  inflightQuotes.set(key, promise);
  return promise;
};

const getKisAccessToken = async (supabase: ReturnType<typeof createClient>, forceRefresh = false) => {
  const KIS_APP_KEY = Deno.env.get("KIS_APP_KEY");
  const KIS_APP_SECRET = Deno.env.get("KIS_APP_SECRET");
  const KIS_URL = Deno.env.get("KIS_URL") || "https://openapi.koreainvestment.com:9443";

  if (!KIS_APP_KEY || !KIS_APP_SECRET) {
    throw new Error("KIS_KEYS_MISSING");
  }

  const { data: tokenRecord } = await supabase
    .from("api_tokens")
    .select("*")
    .eq("service_name", "KIS")
    .maybeSingle();

  const now = new Date();
  const tokenExpiresSoon = !tokenRecord?.expired_at || new Date(tokenRecord.expired_at) <= new Date(now.getTime() + 3600 * 1000);
  if (forceRefresh || !tokenRecord?.token || tokenExpiresSoon) {
    const tokenRes = await fetch(`${KIS_URL}/oauth2/tokenP`, {
      method: "POST",
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: KIS_APP_KEY,
        appsecret: KIS_APP_SECRET,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData?.access_token) {
      throw new Error(String(tokenData?.msg_cd || "KIS_TOKEN_FAILED"));
    }

    const accessToken = String(tokenData.access_token);
    const expiredAt = new Date(now.getTime() + Number(tokenData.expires_in || 0) * 1000);
    await supabase.from("api_tokens").upsert({
      service_name: "KIS",
      token: accessToken,
      expired_at: expiredAt.toISOString(),
      updated_at: now.toISOString(),
    });

    return { accessToken, KIS_URL, KIS_APP_KEY, KIS_APP_SECRET };
  }

  return {
    accessToken: String(tokenRecord.token),
    KIS_URL,
    KIS_APP_KEY,
    KIS_APP_SECRET,
  };
};

const requestQuote = async (
  supabase: ReturnType<typeof createClient>,
  symbol: string,
  forceRefreshToken = false,
): Promise<{ quote: QuoteResponse | null; errorCode: string | null }> => {
  try {
    const { accessToken, KIS_URL, KIS_APP_KEY, KIS_APP_SECRET } = await getKisAccessToken(supabase, forceRefreshToken);

    const res = await fetch(
      `${KIS_URL}/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${symbol}`,
      {
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${accessToken}`,
          appkey: KIS_APP_KEY,
          appsecret: KIS_APP_SECRET,
          tr_id: "FHKST01010100",
        },
      },
    );

    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text);
    } catch {
      return { quote: null, errorCode: `KIS_PARSE_${res.status}` };
    }

    if (!res.ok) {
      return { quote: null, errorCode: String((json as any)?.msg_cd || `KIS_HTTP_${res.status}`) };
    }
    if (String((json as any)?.rt_cd || "") !== "0") {
      return { quote: null, errorCode: String((json as any)?.msg_cd || "KIS_RT_ERROR") };
    }

    const out = ((json as any)?.output || {}) as Record<string, unknown>;
    const currentPrice = toNumber(out.stck_prpr);
    if (currentPrice === null || currentPrice <= 0) {
      return { quote: null, errorCode: "KIS_EMPTY_PRICE" };
    }

    const priceChange = toNumber(out.prdy_vrss);
    const priceChangeRate = toNumber(out.prdy_ctrt);
    const priceHigh = toNumber(out.stck_hgpr);
    const priceLow = toNumber(out.stck_lwpr);
    const high52w = toNumber(out.w52_hgpr);
    const low52w = toNumber(out.w52_lwpr);
    const nowIso = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("stocks")
      .update({
        current_price: currentPrice,
        price_change: priceChange,
        price_change_rate: priceChangeRate,
        price_high: priceHigh,
        price_low: priceLow,
        high_52w: high52w,
        low_52w: low52w,
        updated_at: nowIso,
      })
      .eq("symbol", symbol);

    if (updateError) {
      console.warn(`[quote-public] DB update failed for ${symbol}:`, updateError.message);
    }

    return {
      quote: {
        symbol,
        currentPrice,
        updatedAt: nowIso,
        status: "live",
        isStale: false,
        priceChange,
        priceChangeRate,
        priceHigh,
        priceLow,
      },
      errorCode: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { quote: null, errorCode: message || "KIS_FETCH_FAILED" };
  }
};

const shouldRetryWithFreshToken = (errorCode: string | null) => {
  return errorCode === "EGW00123";
};

const fetchLiveQuote = async (
  supabase: ReturnType<typeof createClient>,
  symbol: string,
): Promise<{ quote: QuoteResponse | null; errorCode: string | null }> => {
  const firstAttempt = await requestQuote(supabase, symbol, false);
  if (firstAttempt.quote || !shouldRetryWithFreshToken(firstAttempt.errorCode)) {
    return firstAttempt;
  }
  return requestQuote(supabase, symbol, true);
};

const ensureStockRow = async (supabase: ReturnType<typeof createClient>, symbol: string) => {
  const { data: stock } = await supabase
    .from("stocks")
    .select("symbol, name, market_type, base_price, current_price, price_change, price_change_rate, price_high, price_low, updated_at")
    .eq("symbol", symbol)
    .maybeSingle();

  if (stock) return stock;

  const { data: master } = await supabase
    .from("stock_master")
    .select("code, name, market_type, std_price")
    .eq("code", symbol)
    .maybeSingle();

  if (!master) return null;

  await supabase
    .from("stocks")
    .upsert({
      symbol,
      name: master.name,
      market_type: master.market_type || "J",
      base_price: toNumber(master.std_price),
    }, { onConflict: "symbol" });

  const { data: createdStock } = await supabase
    .from("stocks")
    .select("symbol, name, market_type, base_price, current_price, price_change, price_change_rate, price_high, price_low, updated_at")
    .eq("symbol", symbol)
    .maybeSingle();

  return createdStock;
};

const buildFromStock = (
  symbol: string,
  stock: Record<string, unknown> | null,
  status: QuoteStatus,
  isStale: boolean,
  errorCode?: string,
): QuoteResponse => {
  const currentPrice = toNumber(stock?.current_price) ?? toNumber(stock?.base_price);
  return {
    symbol,
    currentPrice,
    updatedAt: toIsoOrNull(stock?.updated_at),
    status,
    isStale,
    errorCode,
    priceChange: toNumber(stock?.price_change),
    priceChangeRate: toNumber(stock?.price_change_rate),
    priceHigh: toNumber(stock?.price_high),
    priceLow: toNumber(stock?.price_low),
  };
};

const resolveQuote = async (
  supabase: ReturnType<typeof createClient>,
  symbol: string,
  forceFresh = false,
): Promise<QuoteResponse> => {
  const stock = await ensureStockRow(supabase, symbol);
  if (!stock) {
    return {
      symbol,
      currentPrice: null,
      updatedAt: null,
      status: "unavailable",
      isStale: true,
      errorCode: "STOCK_NOT_FOUND",
    };
  }

  const cachedPrice = toNumber((stock as any).current_price);
  const cachedUpdatedAt = toIsoOrNull((stock as any).updated_at);
  const isFresh = Boolean(
    cachedPrice !== null &&
    cachedUpdatedAt &&
    (Date.now() - new Date(cachedUpdatedAt).getTime() <= TTL_MS),
  );

  if (!forceFresh && isFresh) {
    return buildFromStock(symbol, stock as Record<string, unknown>, "cached", false);
  }

  const live = await fetchLiveQuote(supabase, symbol);
  if (live.quote) {
    return live.quote;
  }

  if (cachedPrice !== null) {
    return buildFromStock(symbol, stock as Record<string, unknown>, "syncing", true, live.errorCode || "KIS_SYNC_FAILED");
  }

  const basePrice = toNumber((stock as any).base_price);
  if (basePrice !== null && basePrice > 0) {
    return {
      symbol,
      currentPrice: basePrice,
      updatedAt: cachedUpdatedAt,
      status: "syncing",
      isStale: true,
      errorCode: live.errorCode || "BASE_PRICE_ONLY",
      priceChange: toNumber((stock as any).price_change),
      priceChangeRate: toNumber((stock as any).price_change_rate),
      priceHigh: toNumber((stock as any).price_high),
      priceLow: toNumber((stock as any).price_low),
    };
  }

  return {
    symbol,
    currentPrice: null,
    updatedAt: cachedUpdatedAt,
    status: "unavailable",
    isStale: true,
    errorCode: live.errorCode || "QUOTE_UNAVAILABLE",
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const symbol = normalizeSymbol(body.symbol);
    const forceFresh = Boolean(body.force);
    if (!symbol) {
      return new Response(JSON.stringify({ error: "Symbol is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const singleFlightKey = forceFresh ? `${symbol}:force` : symbol;
    const result = await withSingleFlight(singleFlightKey, () => resolveQuote(supabase, symbol, forceFresh));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message || "quote-public failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

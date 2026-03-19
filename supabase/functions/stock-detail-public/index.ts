import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-service-key",
};
const REALITY_TTL_MS = 24 * 60 * 60 * 1000;

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeSymbol = (value: unknown): string => String(value ?? "").trim().toUpperCase();

const hasMeaningfulRealityCore = (row: Record<string, unknown> | null) => {
  if (!row) return false;
  const coreValues = [
    toNumber(row.per),
    toNumber(row.pbr),
    toNumber(row.supply_5d),
    toNumber(row.roe),
    toNumber(row.debt_ratio),
  ];
  return coreValues.some((value) => value !== null && value !== 0);
};

const isRealityCacheStale = (row: Record<string, unknown> | null) => {
  if (!row?.updated_at) return true;
  const updatedAtMs = new Date(String(row.updated_at)).getTime();
  if (!Number.isFinite(updatedAtMs)) return true;
  return (Date.now() - updatedAtMs) > REALITY_TTL_MS;
};

const invokeProtectedKisGateway = async (body: Record<string, unknown>) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const internalServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const response = await fetch(`${supabaseUrl}/functions/v1/kis-gateway`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-service-key": internalServiceKey,
    },
    body: JSON.stringify(body),
  });

  let data: Record<string, unknown> | null = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
};

const emptyReality = (symbol: string) => ({
  symbol,
  per: null,
  pbr: null,
  ind_area_per: null,
  beta: null,
  supply_5d: null,
  op_margin: null,
  debt_ratio: null,
  roe: null,
  eps: null,
  bps: null,
  currentPrice: null,
  priceChangeRate: null,
  priceHigh: null,
  priceLow: null,
  status: "unavailable",
  source: "detail_endpoint_empty",
  updatedAt: null,
  isStale: true,
  errorCode: "REALITY_EMPTY",
});

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

    const { data: stock } = await supabase
      .from("stocks")
      .select("id, symbol, current_price")
      .eq("symbol", symbol)
      .maybeSingle();

    const [historyResult, realityResult, dashboardResult, predictionsResult] = await Promise.all([
      invokeProtectedKisGateway({ symbol, type: "history" }),
      supabase
        .from("market_reality_cache")
        .select("symbol, per, pbr, ind_area_per, beta, supply_5d, op_margin, debt_ratio, roe, eps, bps, current_price, price_change_rate, price_high, price_low, status, source, error_code, updated_at")
        .eq("symbol", symbol)
        .maybeSingle(),
      supabase.rpc("get_community_dashboard", { stock_symbol: symbol }),
      stock?.id
        ? supabase
            .from("predictions")
            .select("price_target, x_future_ratio, opacity")
            .eq("stock_id", stock.id)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const historyData = Array.isArray((historyResult.data as any)?.output2)
      ? (historyResult.data as any).output2
          .map((day: Record<string, unknown>) => Number(day.stck_clpr))
          .filter((price: number) => Number.isFinite(price) && price > 0)
          .reverse()
      : [];

    const starsData = Array.isArray(predictionsResult.data)
      ? predictionsResult.data.map((item: Record<string, unknown>) => ({
          priceTarget: Number(item.price_target),
          xFutureRatio: Number(item.x_future_ratio),
          opacity: Number(item.opacity),
        }))
      : [];

    const realityRow = realityResult.data as Record<string, unknown> | null;
    const hasRealityCacheCore = hasMeaningfulRealityCore(realityRow);
    const shouldSyncRefreshReality = !realityRow || !realityRow.status || !hasRealityCacheCore;
    const shouldBackgroundRefreshReality = !shouldSyncRefreshReality && isRealityCacheStale(realityRow);
    const realityRefreshResult = shouldSyncRefreshReality
      ? await invokeProtectedKisGateway({ symbol, type: "reality" })
      : null;

    let realitySourceRow = realityRow;
    let realityRefreshStatus = "skipped";

    if (realityRefreshResult) {
      realityRefreshStatus = realityRefreshResult.ok ? "ok" : `http_${realityRefreshResult.status}`;
      const refreshedReality = realityRefreshResult.data as Record<string, unknown> | null;
      if (refreshedReality && String(refreshedReality.status || "") === "live") {
        realitySourceRow = refreshedReality;
      } else {
        const { data: latestRealityRow } = await supabase
          .from("market_reality_cache")
          .select("symbol, per, pbr, ind_area_per, beta, supply_5d, op_margin, debt_ratio, roe, eps, bps, current_price, price_change_rate, price_high, price_low, status, source, error_code, updated_at")
          .eq("symbol", symbol)
          .maybeSingle();
        if (latestRealityRow) {
          realitySourceRow = latestRealityRow as Record<string, unknown>;
        }
      }
    }

    if (shouldBackgroundRefreshReality) {
      const backgroundRefresh = invokeProtectedKisGateway({ symbol, type: "reality" })
        .then((result) => {
          console.log(JSON.stringify({
            symbol,
            reality_cache_hit: true,
            reality_refresh_attempted: true,
            reality_refresh_mode: "background",
            reality_refresh_status: result.ok ? "ok" : `http_${result.status}`,
          }));
        })
        .catch((error) => {
          console.log(JSON.stringify({
            symbol,
            reality_cache_hit: true,
            reality_refresh_attempted: true,
            reality_refresh_mode: "background",
            reality_refresh_status: "failed",
            reality_refresh_error: error instanceof Error ? error.message : String(error),
          }));
        });

      const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
      runtime?.waitUntil?.(backgroundRefresh);
      void backgroundRefresh;
    }

    console.log(JSON.stringify({
      symbol,
      reality_cache_hit: hasRealityCacheCore,
      reality_refresh_attempted: shouldSyncRefreshReality || shouldBackgroundRefreshReality,
      reality_refresh_mode: shouldSyncRefreshReality ? "blocking" : (shouldBackgroundRefreshReality ? "background" : "none"),
      reality_refresh_status: realityRefreshStatus,
    }));

    const currentPrice = toNumber(stock?.current_price) ?? toNumber(realitySourceRow?.current_price) ?? null;
    const responseRealityStatus = shouldBackgroundRefreshReality
      ? "cached"
      : String(realitySourceRow?.status || "unavailable");

    const realityData = realitySourceRow
      ? {
          symbol,
          per: toNumber(realitySourceRow.per),
          pbr: toNumber(realitySourceRow.pbr),
          ind_area_per: toNumber(realitySourceRow.ind_area_per),
          beta: toNumber(realitySourceRow.beta),
          supply_5d: toNumber(realitySourceRow.supply_5d),
          op_margin: toNumber(realitySourceRow.op_margin),
          debt_ratio: toNumber(realitySourceRow.debt_ratio),
          roe: toNumber(realitySourceRow.roe),
          eps: toNumber(realitySourceRow.eps),
          bps: toNumber(realitySourceRow.bps),
          currentPrice,
          priceChangeRate: toNumber(realitySourceRow.price_change_rate),
          priceHigh: toNumber(realitySourceRow.price_high),
          priceLow: toNumber(realitySourceRow.price_low),
          status: responseRealityStatus,
          source: String(realitySourceRow.source || "detail_endpoint_cache"),
          updatedAt: realitySourceRow.updated_at ? String(realitySourceRow.updated_at) : null,
          isStale: shouldBackgroundRefreshReality || responseRealityStatus !== "live",
          errorCode: realitySourceRow.error_code
            ? String(realitySourceRow.error_code)
            : (!hasMeaningfulRealityCore(realitySourceRow) && realityRefreshResult && !realityRefreshResult.ok
              ? `REALITY_REFRESH_${realityRefreshResult.status}`
              : undefined),
        }
      : emptyReality(symbol);

    const dashboardData = dashboardResult.error ? null : dashboardResult.data;
    if (dashboardData?.distribution?.history) {
      const hist = dashboardData.distribution.history;
      const market = dashboardData.market || {};
      const realPrice = currentPrice && currentPrice > 0 ? currentPrice : 0;
      hist.current = realPrice;
      if (hist.high52 && hist.low52 && (hist.high52 - hist.low52) > 0) {
        market.level52 = Math.round(((realPrice - hist.low52) / (hist.high52 - hist.low52)) * 100);
        market.gap52 = Math.max(0, hist.high52 - realPrice);
      }
      dashboardData.market = market;
    }

    return new Response(JSON.stringify({
      historyData: historyData.length >= 2 ? historyData : [],
      starsData,
      realityData,
      dashboardData,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message || "stock-detail-public failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

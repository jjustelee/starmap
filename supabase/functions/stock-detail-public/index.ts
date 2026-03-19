import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeSymbol = (value: unknown): string => String(value ?? "").trim().toUpperCase();

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
      supabase.functions.invoke("kis-gateway", { body: { symbol, type: "history" } }),
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
    const currentPrice = toNumber(stock?.current_price) ?? toNumber(realityRow?.current_price) ?? null;
    const realityData = realityRow
      ? {
          symbol,
          per: toNumber(realityRow.per),
          pbr: toNumber(realityRow.pbr),
          ind_area_per: toNumber(realityRow.ind_area_per),
          beta: toNumber(realityRow.beta),
          supply_5d: toNumber(realityRow.supply_5d),
          op_margin: toNumber(realityRow.op_margin),
          debt_ratio: toNumber(realityRow.debt_ratio),
          roe: toNumber(realityRow.roe),
          eps: toNumber(realityRow.eps),
          bps: toNumber(realityRow.bps),
          currentPrice,
          priceChangeRate: toNumber(realityRow.price_change_rate),
          priceHigh: toNumber(realityRow.price_high),
          priceLow: toNumber(realityRow.price_low),
          status: String(realityRow.status || "unavailable"),
          source: String(realityRow.source || "detail_endpoint_cache"),
          updatedAt: realityRow.updated_at ? String(realityRow.updated_at) : null,
          isStale: String(realityRow.status || "unavailable") !== "live",
          errorCode: realityRow.error_code ? String(realityRow.error_code) : undefined,
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

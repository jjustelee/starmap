import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SacredMode = "home" | "list" | "detail";
type SacredSort = "recent" | "accuracy";

const normalizeMode = (value: unknown): SacredMode => {
  const mode = String(value ?? "").trim().toLowerCase();
  return mode === "detail" ? "detail" : mode === "list" ? "list" : "home";
};

const normalizeSort = (value: unknown): SacredSort => {
  return String(value ?? "").trim().toLowerCase() === "accuracy" ? "accuracy" : "recent";
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const isISODateString = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));

const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const isMatured = (targetDate: unknown) => {
  const value = String(targetDate ?? "");
  if (!isISODateString(value)) return false;
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(target.getTime()) && today >= target;
};

const judgePrediction = (currentPrice: number | null, targetPrice: number | null, targetDate: unknown) => {
  if (!isMatured(targetDate) || !currentPrice || !targetPrice || targetPrice <= 0) {
    return null;
  }

  const deviationPct = Math.abs(currentPrice - targetPrice) / targetPrice * 100;
  if (deviationPct <= 1) {
    return { judgmentStatus: "HIT_EXACT", judgmentLabel: "적중 완료", deviationPct };
  }
  if (deviationPct <= 3) {
    return { judgmentStatus: "HIT_NEAR", judgmentLabel: "근접 적중", deviationPct };
  }
  return null;
};

const buildSacredItem = (
  row: Record<string, unknown>,
  profileMap: Record<string, { nickname: string; avatar_url: string | null }>,
  closePriceMap: Record<string, number>
) => {
  const stock = (row.stocks || {}) as Record<string, unknown>;
  const stockId = String(stock.id || "");
  const targetDate = String(row.target_date || "");
  const hitPrice = toNumber(closePriceMap[`${stockId}:${targetDate}`]);
  const targetPrice = toNumber(row.price_target);
  const judged = judgePrediction(hitPrice, targetPrice, targetDate);
  if (!judged) return null;

  const authorId = String(row.user_id || "");
  const profile = profileMap[authorId];

  return {
    id: String(row.id),
    predictionId: String(row.id),
    stockSymbol: String(stock.symbol || ""),
    stockName: String(stock.name || "알 수 없음"),
    authorNickname: profile?.nickname || "별지기",
    authorAvatar: profile?.avatar_url || null,
    targetPrice,
    currentOrHitPrice: hitPrice,
    createdAt: String(row.created_at || ""),
    hitDate: targetDate,
    targetDate: targetDate,
    judgmentStatus: judged.judgmentStatus,
    judgmentLabel: judged.judgmentLabel,
    deviationPct: judged.deviationPct,
    timeline: [
      {
        type: "created",
        date: String(row.created_at || ""),
      },
      {
        type: "hit",
        date: String(row.target_date || ""),
      },
    ],
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

    const mode = normalizeMode(body.mode);
    const sort = normalizeSort(body.sort);
    const id = String(body.id ?? "").trim();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let query = supabase
      .from("predictions")
      .select("id, user_id, price_target, target_date, created_at, stocks(id, symbol, name, current_price)")
      .order("created_at", { ascending: false })
      .limit(mode === "detail" ? 1 : 200);

    if (mode === "detail" && id) {
      query = query.eq("id", id);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const rows = Array.isArray(data) ? data : [];
    const userIds = [...new Set(rows.map((row: any) => row.user_id).filter(Boolean))];
    const profileMap: Record<string, { nickname: string; avatar_url: string | null }> = {};
    const closePriceMap: Record<string, number> = {};

    const maturedRows = rows.filter((row: any) => isMatured(row.target_date) && isISODateString(row.target_date));
    const stockIds = [...new Set(maturedRows.map((row: any) => row.stocks?.id).filter(Boolean))];
    const targetDates = [...new Set(maturedRows.map((row: any) => String(row.target_date)).filter(Boolean))].sort();

    if (stockIds.length > 0 && targetDates.length > 0) {
      const rangeStart = targetDates[0];
      const rangeEndExclusive = addDays(targetDates[targetDates.length - 1], 1);
      const { data: priceRows } = await supabase
        .from("price_history")
        .select("stock_id, price, recorded_at")
        .in("stock_id", stockIds)
        .gte("recorded_at", `${rangeStart}T00:00:00`)
        .lt("recorded_at", `${rangeEndExclusive}T00:00:00`)
        .order("recorded_at", { ascending: false });

      (priceRows || []).forEach((priceRow: any) => {
        const recordedAt = String(priceRow.recorded_at || "");
        const tradingDay = recordedAt.slice(0, 10);
        const key = `${String(priceRow.stock_id || "")}:${tradingDay}`;
        if (!key.startsWith(":") && closePriceMap[key] === undefined) {
          const price = toNumber(priceRow.price);
          if (price !== null) {
            closePriceMap[key] = price;
          }
        }
      });
    }

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("id", userIds);

      (profiles || []).forEach((profile: any) => {
        profileMap[String(profile.id)] = {
          nickname: String(profile.nickname || "별지기"),
          avatar_url: profile.avatar_url ? String(profile.avatar_url) : null,
        };
      });
    }

    const items = rows
      .map((row: any) => buildSacredItem(row, profileMap, closePriceMap))
      .filter(Boolean) as any[];

    if (mode === "detail") {
      return new Response(JSON.stringify({ item: items[0] || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const sortedItems = [...items].sort((a, b) => {
      if (sort === "accuracy") {
        if (a.deviationPct !== b.deviationPct) return a.deviationPct - b.deviationPct;
      }
      return new Date(b.hitDate).getTime() - new Date(a.hitDate).getTime();
    });

    return new Response(JSON.stringify({
      items: mode === "home" ? sortedItems.slice(0, 2) : sortedItems,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message || "sacred-posts-public failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

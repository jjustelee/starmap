import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PREDICTION_REACTION_KEYS = [
  "same_view",
  "can_go_higher",
  "seems_high",
  "seems_low",
  "want_reason",
] as const;

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

const judgePrediction = (hitPrice: number | null, targetPrice: number | null, targetDate: unknown) => {
  if (!isMatured(targetDate) || !hitPrice || !targetPrice || targetPrice <= 0) {
    return null;
  }

  const deviationPct = Math.abs(hitPrice - targetPrice) / targetPrice * 100;
  if (deviationPct <= 1) {
    return { judgmentStatus: "HIT_EXACT", judgmentLabel: "적중 완료", deviationPct };
  }
  if (deviationPct <= 3) {
    return { judgmentStatus: "HIT_NEAR", judgmentLabel: "근접 적중", deviationPct };
  }
  return null;
};

const createEmptyReactionCounts = () => Object.fromEntries(
  PREDICTION_REACTION_KEYS.map((key) => [key, 0])
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from("predictions")
      .select("id, user_id, price_target, target_date, created_at, stocks(id, symbol, name)")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    const rows = Array.isArray(data) ? data : [];
    const userIds = [...new Set(rows.map((row: any) => row.user_id).filter(Boolean))];
    const predictionIds = [...new Set(rows.map((row: any) => row.id).filter(Boolean))];
    const profileMap: Record<string, { nickname: string }> = {};
    const closePriceMap: Record<string, number> = {};
    const reactionCountsMap: Record<string, Record<string, number>> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", userIds);

      (profiles || []).forEach((profile: any) => {
        profileMap[String(profile.id)] = {
          nickname: String(profile.nickname || "별지기"),
        };
      });
    }

    if (predictionIds.length > 0) {
      const { data: reactionRows } = await supabase
        .from("prediction_reactions")
        .select("prediction_id, reaction_key")
        .in("prediction_id", predictionIds);

      (reactionRows || []).forEach((reactionRow: any) => {
        const predictionId = String(reactionRow.prediction_id || "");
        const reactionKey = String(reactionRow.reaction_key || "");
        if (!predictionId || !PREDICTION_REACTION_KEYS.includes(reactionKey as any)) return;
        if (!reactionCountsMap[predictionId]) {
          reactionCountsMap[predictionId] = createEmptyReactionCounts();
        }
        reactionCountsMap[predictionId][reactionKey] += 1;
      });
    }

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

    const recentPredictions = rows
      .slice(0, 5)
      .map((row: any) => {
        const stock = (row.stocks || {}) as Record<string, unknown>;
        const authorId = String(row.user_id || "");
        const stockId = String(stock.id || "");
        const predictionId = String(row.id || "");
        const targetDate = String(row.target_date || "");
        const hitPrice = toNumber(closePriceMap[`${stockId}:${targetDate}`]);
        const targetPrice = toNumber(row.price_target);
        const judged = judgePrediction(hitPrice, targetPrice, targetDate);
        const promotionStatus = judged
          ? "sacred"
          : (isMatured(targetDate) ? "judging" : "in_progress");
        const promotionLabel = judged
          ? "성지 입성"
          : (promotionStatus === "judging" ? "종가 체크 중" : "성지각");
        const reactionCounts = reactionCountsMap[predictionId] || createEmptyReactionCounts();
        const totalReactionCount = Object.values(reactionCounts).reduce((sum, count) => sum + Number(count || 0), 0);
        return {
          id: predictionId,
          stockSymbol: String(stock.symbol || ""),
          stockName: String(stock.name || "알 수 없음"),
          authorNickname: profileMap[authorId]?.nickname || "별지기",
          targetPrice,
          targetDate,
          createdAt: String(row.created_at || ""),
          promotionStatus,
          promotionLabel,
          sacredPostId: judged ? predictionId : null,
          reactionCounts,
          totalReactionCount,
        };
      })
      .filter((item) => item.id && item.stockSymbol);

    const hotMap = new Map<string, {
      stockSymbol: string;
      stockName: string;
      predictionCount: number;
      lastTargetPrice: number | null;
      lastTargetDate: string;
      lastCreatedAt: string;
    }>();

    rows.forEach((row: any) => {
      const stock = (row.stocks || {}) as Record<string, unknown>;
      const stockSymbol = String(stock.symbol || "");
      if (!stockSymbol) return;

      const nextCreatedAt = String(row.created_at || "");
      const existing = hotMap.get(stockSymbol);
      if (!existing) {
        hotMap.set(stockSymbol, {
          stockSymbol,
          stockName: String(stock.name || "알 수 없음"),
          predictionCount: 1,
          lastTargetPrice: toNumber(row.price_target),
          lastTargetDate: String(row.target_date || ""),
          lastCreatedAt: nextCreatedAt,
        });
        return;
      }

      existing.predictionCount += 1;
      if (nextCreatedAt > existing.lastCreatedAt) {
        existing.lastCreatedAt = nextCreatedAt;
        existing.lastTargetPrice = toNumber(row.price_target);
        existing.lastTargetDate = String(row.target_date || "");
      }
    });

    const hotStocks = [...hotMap.values()]
      .sort((a, b) => {
        if (b.predictionCount !== a.predictionCount) return b.predictionCount - a.predictionCount;
        return new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime();
      })
      .slice(0, 5);

    return new Response(JSON.stringify({ recentPredictions, hotStocks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({
      recentPredictions: [],
      hotStocks: [],
      error: message || "community-home-public failed",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

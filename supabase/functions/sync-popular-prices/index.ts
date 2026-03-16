import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

/**
 * [백엔드 Level 2] 인기 종목 가격 배치 동기화
 * 
 * 이 Edge Function은 주기적으로(Cron) 또는 수동 호출하여
 * 인기 종목들의 가격을 KIS API에서 가져와 DB에 업데이트합니다.
 * 
 * 호출 방식:
 *   - POST /sync-popular-prices  (body: { limit?: number })
 *   - Supabase Cron Job으로 5분 간격 설정 가능
 * 
 * 동작 흐름:
 *   1. stocks 테이블에서 prediction_count가 많은 TOP N 종목 조회
 *   2. KIS API 토큰 확보 (api_tokens 테이블 캐싱)
 *   3. 각 종목에 대해 현재가 조회 → DB 업데이트
 *   4. 결과 반환
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 동기화할 종목 수 (기본 10개)
    let limit = 10;
    try {
      const body = await req.json();
      if (body.limit) limit = Math.min(body.limit, 30); // 최대 30개 제한
    } catch {
      // body가 없는 Cron 호출도 허용
    }

    // 1. 인기 종목 조회 (predictions 수 기준)
    const { data: stocks, error: stocksError } = await supabase
      .from("stocks")
      .select("id, symbol, name, predictions:predictions(id)")
      .order("id", { ascending: true });

    if (stocksError) throw new Error(`Failed to fetch stocks: ${stocksError.message}`);

    // prediction count로 정렬 후 상위 N개 추출
    const popularStocks = (stocks || [])
      .map((s: any) => ({
        ...s,
        predictionCount: s.predictions ? s.predictions.length : 0,
      }))
      .sort((a: any, b: any) => b.predictionCount - a.predictionCount)
      .slice(0, limit);

    if (popularStocks.length === 0) {
      return new Response(JSON.stringify({ message: "No stocks to sync", synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. KIS API 토큰 확보
    const KIS_APP_KEY = Deno.env.get("KIS_APP_KEY");
    const KIS_APP_SECRET = Deno.env.get("KIS_APP_SECRET");
    const KIS_URL = Deno.env.get("KIS_URL") || "https://openapi.koreainvestment.com:9443";

    if (!KIS_APP_KEY || !KIS_APP_SECRET) {
      throw new Error("KIS API Keys are missing in environment variables");
    }

    const { data: tokenRecord } = await supabase
      .from("api_tokens")
      .select("*")
      .eq("service_name", "KIS")
      .single();

    let accessToken = tokenRecord?.token;
    const now = new Date();

    if (!tokenRecord || new Date(tokenRecord.expired_at) <= new Date(now.getTime() + 3600 * 1000)) {
      const tokenRes = await fetch(`${KIS_URL}/oauth2/tokenP`, {
        method: "POST",
        body: JSON.stringify({
          grant_type: "client_credentials",
          appkey: KIS_APP_KEY,
          appsecret: KIS_APP_SECRET,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new Error(`Failed to get access token: ${tokenData.msg1 || "Unknown error"}`);
      }

      accessToken = tokenData.access_token;
      const expiredAt = new Date(now.getTime() + tokenData.expires_in * 1000);

      await supabase.from("api_tokens").upsert({
        service_name: "KIS",
        token: accessToken,
        expired_at: expiredAt.toISOString(),
        updated_at: now.toISOString(),
      });
    }

    // 3. 각 종목 가격 갱신 (순차 처리 - KIS API Rate Limit 준수)
    const results: { symbol: string; price: number | null; error?: string }[] = [];

    for (const stock of popularStocks) {
      try {
        // KIS API Rate Limit: 초당 20건 이하 → 50ms 지연
        await new Promise((resolve) => setTimeout(resolve, 50));

        const priceRes = await fetch(
          `${KIS_URL}/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${stock.symbol}`,
          {
            headers: {
              "Content-Type": "application/json",
              authorization: `Bearer ${accessToken}`,
              appkey: KIS_APP_KEY!,
              appsecret: KIS_APP_SECRET!,
              tr_id: "FHKST01010100",
            },
          }
        );

        const priceData = await priceRes.json();

        if (priceData?.output?.stck_prpr) {
          const currentPrice = Number(priceData.output.stck_prpr);

          // [백엔드] DB 업데이트 → Supabase Realtime으로 자동 브로드캐스트
          await supabase
            .from("stocks")
            .update({
              current_price: currentPrice,
              price_change: Number(priceData.output.prdy_vrss),
              price_change_rate: Number(priceData.output.prdy_ctrt),
              price_high: Number(priceData.output.stck_hgpr),
              price_low: Number(priceData.output.stck_lwpr),
              updated_at: new Date().toISOString(),
            })
            .eq("symbol", stock.symbol);

          results.push({ symbol: stock.symbol, price: currentPrice });
        } else {
          results.push({ symbol: stock.symbol, price: null, error: "No price data" });
        }
      } catch (err: any) {
        results.push({ symbol: stock.symbol, price: null, error: err.message });
      }
    }

    const synced = results.filter((r) => r.price !== null).length;
    console.log(`[sync-popular-prices] Synced ${synced}/${popularStocks.length} stocks`);

    return new Response(
      JSON.stringify({
        message: `Synced ${synced} stocks`,
        synced,
        total: popularStocks.length,
        results,
        syncedAt: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[sync-popular-prices] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

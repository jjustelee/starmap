import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 간단한 보안: 요청의 apikey가 Supabase Anon Key와 일치하는지 확인 (비로그인 지원용)
  const clientApiKey = req.headers.get("apikey");
  if (clientApiKey !== Deno.env.get("SUPABASE_ANON_KEY") && clientApiKey !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    // console.error("[KIS Gateway] Unauthorized: Invalid API Key");
    // return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    // 일단 테스트를 위해 통과시키거나 로그만 남길 수 있음. 실제 운영 시에는 위 주석 해제 권장.
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { symbol, type = 'price' } = body;

    if (!symbol) throw new Error("Symbol is required");

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
      if (!tokenData.access_token) throw new Error(`Failed to get access token: ${tokenData.msg1 || 'Unknown error'}`);

      accessToken = tokenData.access_token;
      const expiredAt = new Date(now.getTime() + tokenData.expires_in * 1000);

      await supabase.from("api_tokens").upsert({
        service_name: "KIS",
        token: accessToken,
        expired_at: expiredAt.toISOString(),
        updated_at: now.toISOString(),
      });
    }

    let resultData;
    if (type === 'price') {
      const priceRes = await fetch(`${KIS_URL}/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${symbol}`, {
        headers: {
          "Content-Type": "application/json",
          "authorization": `Bearer ${accessToken}`,
          "appkey": KIS_APP_KEY,
          "appsecret": KIS_APP_SECRET,
          "tr_id": "FHKST01010100",
        },
      });
      resultData = await priceRes.json();

      if (resultData && resultData.output) {
        const out = resultData.output;
        await supabase
          .from("stocks")
          .update({
            current_price: Number(out.stck_prpr),
            price_change: Number(out.prdy_vrss),
            price_change_rate: Number(out.prdy_ctrt),
            price_high: Number(out.stck_hgpr),
            price_low: Number(out.stck_lwpr),
            updated_at: new Date().toISOString(),
          })
          .eq("symbol", symbol);
      }
    } else if (type === 'history') {
      const date2 = now.toISOString().split('T')[0].replace(/-/g, '');
      const past = new Date(now.getTime() - 50 * 24 * 3600 * 1000);
      const date1 = past.toISOString().split('T')[0].replace(/-/g, '');

      const historyRes = await fetch(`${KIS_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?fid_cond_mrkt_div_code=J&fid_input_iscd=${symbol}&fid_period_div_code=D&fid_org_adj_prc=0&fid_input_date_1=${date1}&fid_input_date_2=${date2}`, {
        headers: {
          "Content-Type": "application/json",
          "authorization": `Bearer ${accessToken}`,
          "appkey": KIS_APP_KEY,
          "appsecret": KIS_APP_SECRET,
          "tr_id": "FHKST03010100",
        },
      });
      resultData = await historyRes.json();
    }

    return new Response(JSON.stringify(resultData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

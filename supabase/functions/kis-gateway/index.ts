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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body or empty request" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    
    const { symbol, type = 'price' } = body;
    console.log(`[KIS Gateway] Received request: type=${type}, symbol=${symbol}`);

    let resultData;

    if (type === 'search') {
      // [백엔드] 네이버 증권 검색 API 프록시 (CORS 우회)
      const query = body.query;
      if (!query) throw new Error("Query is required for search");
      
      const searchRes = await fetch(`https://ac.stock.naver.com/ac?q=${encodeURIComponent(query)}&target=stock`);
      resultData = await searchRes.json();
    } else {
      // KIS 관련 요청 (price, history, reality)
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

        // DB 업데이트 로직 (주가 정보가 있으면 업데이트)
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
              high_52w: Number(out.w52_hgpr),
              low_52w: Number(out.w52_lwpr),
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
      } else if (type === 'reality') {
        const safeFetch = async (url: string, trId: string) => {
          try {
            const res = await fetch(url, {
              headers: {
                "Content-Type": "application/json",
                "authorization": `Bearer ${accessToken}`,
                "appkey": KIS_APP_KEY,
                "appsecret": KIS_APP_SECRET,
                "tr_id": trId,
                "custtype": "P",
              },
            });
            const text = await res.text();
            console.log(`[KIS Gateway] ${trId} Response (${res.status}): ${text.substring(0, 100)}`);
            if (!res.ok) return { _error: true, status: res.status, text: text.substring(0, 100) };
            return JSON.parse(text);
          } catch (e) {
            console.error(`[KIS Gateway] ${trId} Fetch Error:`, e.message);
            return { _error: true, message: e.message };
          }
        };

        const pricePromise = safeFetch(`${KIS_URL}/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${symbol}`, "FHKST01010100");
        const investorPromise = safeFetch(`${KIS_URL}/uapi/domestic-stock/v1/quotations/inquire-investor?fid_cond_mrkt_div_code=J&fid_input_iscd=${symbol}`, "FHKST01010900");
        // 경로 수정: /quotations -> /finance
        const ratioPromise = safeFetch(`${KIS_URL}/uapi/domestic-stock/v1/finance/financial-ratio?fid_cond_mrkt_div_code=J&fid_input_iscd=${symbol}&fid_div_cls_code=0`, "FHKST66430300");

        const [priceData, investorData, ratioData] = await Promise.all([pricePromise, investorPromise, ratioPromise]);
        
        // 데이터 정제
        const p = priceData.output || {};
        const inv = investorData.output || [];
        // FHKST66430300은 output이 배열일 가능성이 있음 (연도별/분기별)
        const ratOutput = ratioData.output || [];
        const rat = Array.isArray(ratOutput) ? (ratOutput[0] || {}) : ratOutput;
        
        // 최근 5일 기관+외인 합산 수급 계산
        const last5Days = Array.isArray(inv) ? inv.slice(0, 5) : [];
        const supply5d = last5Days.reduce((acc, day) => 
          acc + Number(day.frgn_ntby_qty || 0) + Number(day.orgn_ntby_qty || 0), 0
        );

        resultData = {
          per: p.per,
          pbr: p.pbr,
          ind_area_per: p.ind_area_per,
          beta: p.beta || "0.95",
          supply_5d: supply5d,
          // 실시간 재무비율 적용 (영업이익률, 부채비율)
          // 확인된 필드명: bsop_prfi_inrt(영업이익율), lblt_rate(부채비율)
          op_margin: Number(rat.bsop_prfi_inrt || rat.op_prfi_rate || rat.oprtr_prfit_rate || 0),
          debt_ratio: Number(rat.lblt_rate || rat.debt_rate || 0)
        };
      }
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

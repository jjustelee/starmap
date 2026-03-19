import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-service-key",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const internalServiceKey = req.headers.get("x-internal-service-key");
    const expectedInternalServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!internalServiceKey || internalServiceKey !== expectedInternalServiceKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

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
        const toNumber = (value: unknown): number | null => {
          if (value === null || value === undefined || value === "") return null;
          const normalized = typeof value === "string"
            ? value.replace(/,/g, "").replace(/%/g, "").trim()
            : value;
          if (normalized === "" || normalized === "-") return null;
          const n = Number(normalized);
          return Number.isFinite(n) ? n : null;
        };

        const { data: cachedReality } = await supabase
          .from("market_reality_cache")
          .select("symbol, per, pbr, ind_area_per, beta, supply_5d, op_margin, debt_ratio, roe, eps, bps, current_price, price_change_rate, price_high, price_low, status, source, error_code, updated_at")
          .eq("symbol", symbol)
          .maybeSingle();

        const { data: cachedStock } = await supabase
          .from("stocks")
          .select("current_price, price_change_rate, price_high, price_low")
          .eq("symbol", symbol)
          .maybeSingle();

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

            let json: Record<string, unknown> = {};
            try {
              json = JSON.parse(text);
            } catch {
              return { ok: false, errorCode: `PARSE_${res.status}`, data: null };
            }

            if (!res.ok) {
              return {
                ok: false,
                errorCode: String((json as any)?.msg_cd || `HTTP_${res.status}`),
                data: json,
              };
            }

            if (String((json as any)?.rt_cd || "") !== "0") {
              return {
                ok: false,
                errorCode: String((json as any)?.msg_cd || "KIS_RT_ERROR"),
                data: json,
              };
            }

            return { ok: true, errorCode: null, data: json };
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.error(`[KIS Gateway] ${trId} Fetch Error:`, message);
            return { ok: false, errorCode: "NETWORK_ERROR", data: null };
          }
        };

        const pricePromise = safeFetch(`${KIS_URL}/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${symbol}`, "FHKST01010100");
        const investorPromise = safeFetch(`${KIS_URL}/uapi/domestic-stock/v1/quotations/inquire-investor?fid_cond_mrkt_div_code=J&fid_input_iscd=${symbol}`, "FHKST01010900");
        const ratioPromise = safeFetch(`${KIS_URL}/uapi/domestic-stock/v1/finance/financial-ratio?fid_cond_mrkt_div_code=J&fid_input_iscd=${symbol}&fid_div_cls_code=0`, "FHKST66430300");
        const valuationPromise = safeFetch(`${KIS_URL}/uapi/domestic-stock/v1/quotations/inquire-valuation-info?fid_cond_mrkt_div_code=J&fid_input_iscd=${symbol}`, "FHKST01012100");

        const [priceData, investorData, ratioData, valuationData] = await Promise.all([pricePromise, investorPromise, ratioPromise, valuationPromise]);

        const priceOutput = priceData.ok ? (((priceData.data as any)?.output) || {}) : {};
        const investorOutput = investorData.ok ? (((investorData.data as any)?.output) || []) : [];
        const ratioOutputRaw = ratioData.ok ? (((ratioData.data as any)?.output) || []) : [];
        const ratioOutput = Array.isArray(ratioOutputRaw) ? (ratioOutputRaw[0] || {}) : ratioOutputRaw;
        const valuationBody = valuationData.ok ? (((valuationData.data as any) || {})) : {};
        const valuationOutputRaw =
          (valuationBody as any)?.output ??
          (valuationBody as any)?.output1 ??
          (valuationBody as any)?.output2 ??
          {};
        const valuationOutput = Array.isArray(valuationOutputRaw) ? (valuationOutputRaw[0] || {}) : valuationOutputRaw;

        const cachePerRaw = toNumber((cachedReality as any)?.per);
        const cachePbrRaw = toNumber((cachedReality as any)?.pbr);
        const cacheIndAreaPerRaw = toNumber((cachedReality as any)?.ind_area_per);
        const cacheBetaRaw = toNumber((cachedReality as any)?.beta);
        const cacheRoeRaw = toNumber((cachedReality as any)?.roe);
        const cacheEpsRaw = toNumber((cachedReality as any)?.eps);
        const cacheBpsRaw = toNumber((cachedReality as any)?.bps);
        const cachePer = cachePerRaw !== null && cachePerRaw > 0 ? cachePerRaw : null;
        const cachePbr = cachePbrRaw !== null && cachePbrRaw > 0 ? cachePbrRaw : null;
        const cacheIndAreaPer = cacheIndAreaPerRaw !== null && cacheIndAreaPerRaw > 0 ? cacheIndAreaPerRaw : null;
        const cacheBeta = cacheBetaRaw !== null && cacheBetaRaw > 0 ? cacheBetaRaw : null;
        const cacheRoe = cacheRoeRaw !== null ? cacheRoeRaw : null;
        const cacheEps = cacheEpsRaw !== null ? cacheEpsRaw : null;
        const cacheBps = cacheBpsRaw !== null ? cacheBpsRaw : null;
        const cacheSupply5d = toNumber((cachedReality as any)?.supply_5d);
        const cacheOpMargin = toNumber((cachedReality as any)?.op_margin);
        const cacheDebtRatio = toNumber((cachedReality as any)?.debt_ratio);
        const cacheCurrentPrice = toNumber((cachedReality as any)?.current_price) ?? toNumber((cachedStock as any)?.current_price);
        const cachePriceChangeRate = toNumber((cachedReality as any)?.price_change_rate) ?? toNumber((cachedStock as any)?.price_change_rate);
        const cachePriceHigh = toNumber((cachedReality as any)?.price_high) ?? toNumber((cachedStock as any)?.price_high);
        const cachePriceLow = toNumber((cachedReality as any)?.price_low) ?? toNumber((cachedStock as any)?.price_low);
        const hasMeaningfulCacheCore = [cachePer, cachePbr, cacheRoe, cacheDebtRatio]
          .some((value) => value !== null && value !== 0);
        const hasMeaningfulCachePrice = [cacheCurrentPrice, cachePriceChangeRate, cachePriceHigh, cachePriceLow]
          .some((value) => value !== null && value !== 0);
        const hasMeaningfulCacheData = hasMeaningfulCacheCore || hasMeaningfulCachePrice || (cacheSupply5d !== null && Math.abs(cacheSupply5d) > 0);

        const livePerRaw = toNumber((priceOutput as any)?.per);
        const livePbrRaw = toNumber((priceOutput as any)?.pbr);
        const liveEpsPriceRaw = toNumber((priceOutput as any)?.eps);
        const liveBpsPriceRaw = toNumber((priceOutput as any)?.bps);
        const liveIndAreaPerRaw = toNumber((priceOutput as any)?.ind_area_per);
        const liveIndAreaPerFromValuationRaw =
          toNumber((valuationOutput as any)?.bstp_drct_eps_rate) ??
          toNumber((valuationOutput as any)?.ind_area_per);
        const liveBetaRaw = toNumber((priceOutput as any)?.beta);
        const liveCurrentPrice = toNumber((priceOutput as any)?.stck_prpr);
        const livePriceChangeRate = toNumber((priceOutput as any)?.prdy_ctrt);
        const livePriceHigh = toNumber((priceOutput as any)?.stck_hgpr);
        const livePriceLow = toNumber((priceOutput as any)?.stck_lwpr);
        const livePer = livePerRaw !== null && livePerRaw > 0 ? livePerRaw : null;
        const livePbr = livePbrRaw !== null && livePbrRaw > 0 ? livePbrRaw : null;
        const liveIndAreaPer = [liveIndAreaPerFromValuationRaw, liveIndAreaPerRaw]
          .find((v) => v !== null && v > 0) ?? null;
        const liveBeta = liveBetaRaw !== null && liveBetaRaw > 0 ? liveBetaRaw : null;
        const liveSupply5d = investorData.ok && Array.isArray(investorOutput)
          ? investorOutput.slice(0, 5).reduce((acc: number, day: any) =>
              acc + Number(day?.frgn_ntby_qty || 0) + Number(day?.orgn_ntby_qty || 0), 0)
          : null;
        const liveOpMargin = toNumber((ratioOutput as any)?.bsop_prfi_inrt) ??
          toNumber((ratioOutput as any)?.op_prfi_rate) ??
          toNumber((ratioOutput as any)?.oprtr_prfit_rate);
        const liveRoe = toNumber((ratioOutput as any)?.roe_val);
        const liveDebtRatio = toNumber((ratioOutput as any)?.lblt_rate) ?? toNumber((ratioOutput as any)?.debt_rate);
        const liveEps = toNumber((ratioOutput as any)?.eps) ?? liveEpsPriceRaw;
        const liveBps = toNumber((ratioOutput as any)?.bps) ?? liveBpsPriceRaw;

        const mergedPayload = {
          symbol,
          per: livePer ?? cachePer,
          pbr: livePbr ?? cachePbr,
          ind_area_per: liveIndAreaPer ?? cacheIndAreaPer,
          beta: liveBeta ?? cacheBeta,
          supply_5d: liveSupply5d ?? cacheSupply5d,
          op_margin: liveOpMargin ?? cacheOpMargin,
          debt_ratio: liveDebtRatio ?? cacheDebtRatio,
          roe: liveRoe ?? cacheRoe,
          eps: liveEps ?? cacheEps,
          bps: liveBps ?? cacheBps,
          currentPrice: liveCurrentPrice ?? cacheCurrentPrice,
          priceChangeRate: livePriceChangeRate ?? cachePriceChangeRate,
          priceHigh: livePriceHigh ?? cachePriceHigh,
          priceLow: livePriceLow ?? cachePriceLow,
        };

        const hasLiveSource = Boolean(priceData.ok || investorData.ok || ratioData.ok || valuationData.ok);
        const hasMeaningfulLiveCore = [livePer, livePbr, liveRoe, liveDebtRatio]
          .some((value) => value !== null && value !== 0);
        const hasMeaningfulLivePrice = [liveCurrentPrice, livePriceChangeRate, livePriceHigh, livePriceLow]
          .some((value) => value !== null && value !== 0);
        const hasMeaningfulLiveData = hasMeaningfulLiveCore || hasMeaningfulLivePrice || (liveSupply5d !== null && Math.abs(liveSupply5d) > 0);
        const errorCode = [priceData.errorCode, investorData.errorCode, ratioData.errorCode, valuationData.errorCode]
          .filter((code) => Boolean(code))
          .join(",");
        const nowIso = new Date().toISOString();

        if (hasLiveSource && hasMeaningfulLiveData) {
          await supabase
            .from("market_reality_cache")
            .upsert({
              symbol,
              per: mergedPayload.per,
              pbr: mergedPayload.pbr,
              ind_area_per: mergedPayload.ind_area_per,
              beta: mergedPayload.beta,
              supply_5d: mergedPayload.supply_5d,
              op_margin: mergedPayload.op_margin,
              debt_ratio: mergedPayload.debt_ratio,
              roe: mergedPayload.roe,
              eps: mergedPayload.eps,
              bps: mergedPayload.bps,
              current_price: mergedPayload.currentPrice,
              price_change_rate: mergedPayload.priceChangeRate,
              price_high: mergedPayload.priceHigh,
              price_low: mergedPayload.priceLow,
              status: "live",
              source: "kis",
              error_code: null,
              updated_at: nowIso,
            }, { onConflict: "symbol" });

          resultData = {
            ...mergedPayload,
            status: "live",
            source: "kis",
            updatedAt: nowIso,
            isStale: false,
            errorCode: null,
          };
        } else if (cachedReality && hasMeaningfulCacheData) {
          resultData = {
            ...mergedPayload,
            status: "cached",
            source: "reality_cache",
            updatedAt: (cachedReality as any).updated_at || null,
            isStale: true,
            errorCode: errorCode || (hasLiveSource ? "REALITY_EMPTY" : null) || (cachedReality as any).error_code || "REALITY_SYNC_FAILED",
          };
        } else {
          resultData = {
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
            source: "reality_unavailable",
            updatedAt: null,
            isStale: true,
            errorCode: errorCode || "REALITY_EMPTY",
          };
        }
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

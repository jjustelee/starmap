import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import JSZip from "https://esm.sh/jszip@3.10.1";

/**
 * [한국투자증권 마스터 데이터베이스(DB) 구축 가이드 반영]
 * - 파일 다운로드: .mst.zip (KOSPI/KOSDAQ)
 * - 파싱: 고정 길이(Fixed-length) 레코드 규격 및 cp949 인코딩
 * - 적재: stock_master 테이블 (market_type, group_code, std_price 포함)
 */

const KIS_URLS = {
  KOSPI: "https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip",
  KOSDAQ: "https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip",
};

// 한글 초성 추출 로직
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
function getChosung(str: string) {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      result += CHO[Math.floor((code - 0xAC00) / 588)];
    }
  }
  return result;
}

const decoder = new TextDecoder("euc-kr");

// [데이터 정제] 종목명 표준화 (기술적 노이즈 제거)
function cleanStockName(name: string) {
  let cleaned = name.trim();
  const original = cleaned;
  
  // 1. 기술적 접미사 제거 (예: EF 000000000000N 등)
  cleaned = cleaned.replace(/EF[0-9A-Z\s]+$/g, '').trim();
  
  // 2. 비정상적인 공백 및 특수 제어문자 제거
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

async function fetchAndParseMaster(url: string, market: string) {
  console.log(`[Sync] Downloading ${market} Master from ${url}...`);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${market} master: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  console.log(`[Sync] Downloaded ${arrayBuffer.byteLength} bytes.`);
  
  const zip = new JSZip();
  const unzipped = await zip.loadAsync(new Uint8Array(arrayBuffer));
  
  const fileNames = Object.keys(unzipped.files);
  const fileName = fileNames.find(f => f.toLowerCase().includes('.mst'));
  
  if (!fileName) {
    throw new Error(`MST file not found in ZIP from ${url}`);
  }
  
  const contentBytes = await unzipped.files[fileName].async("uint8array");
  const results = [];
  
  // 바이트 배열을 개행(\n = 10) 기준으로 레코드 분리
  let start = 0;
  for (let i = 0; i < contentBytes.length; i++) {
    if (contentBytes[i] === 10) { // Newline found
      const record = contentBytes.slice(start, i);
      start = i + 1;
      
      if (record.length < 150) continue;

      /**
       * KIS 마스터 정밀 레이아웃 (바이트 기준)
       * 1. 헤더부 (가변: 단축코드 9 + 표준코드 12 + 한글명 X)
       * 2. 상세정보부 (고정: KOSPI 228, KOSDAQ 222)
       * 
       * 한글명 위치: 21번 바이트 ~ 상세정보부 시작점 전까지
       */
      const detailSize = (market === 'KOSPI') ? 228 : 222;
      const nameEnd = record.length - detailSize;
      
      const codeBytes = record.slice(0, 9);
      const nameBytes = record.slice(21, nameEnd);
      const detailBytes = record.slice(nameEnd);
      
      const code = decoder.decode(codeBytes).trim();
      const name = cleanStockName(decoder.decode(nameBytes));
      
      // 상세 섹션 내 오프셋 (KOSPI 41, KOSDAQ 36)
      const groupBytes = detailBytes.slice(0, 2);
      const priceOffset = (market === 'KOSPI') ? 41 : 36;
      const priceBytes = detailBytes.slice(priceOffset, priceOffset + 9);
      
      const groupCode = decoder.decode(groupBytes).trim();
      const stdPrice = parseInt(decoder.decode(priceBytes).trim(), 10) || 0;

      if (code && name) {
        results.push({
          code,
          name,
          chosung: getChosung(name),
          market_type: market,
          group_code: groupCode,
          std_price: stdPrice,
          last_updated: new Date().toISOString()
        });
      }
    }
  }
  
  return results;
}

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const kospiResults = await fetchAndParseMaster(KIS_URLS.KOSPI, 'KOSPI');
    const kosdaqResults = await fetchAndParseMaster(KIS_URLS.KOSDAQ, 'KOSDAQ');
    
    const allResults = [...kospiResults, ...kosdaqResults];
    console.log(`[Sync] Found ${allResults.length} stocks total.`);

    // Bulk Upsert (500개씩 단위 처리)
    const chunkSize = 500;
    for (let i = 0; i < allResults.length; i += chunkSize) {
      const chunk = allResults.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('stock_master')
        .upsert(chunk, { onConflict: 'code' });
      
      if (error) {
        console.error(`[Sync] Chunk Update Error (${i}):`, error);
        throw error;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      count: allResults.length,
      timestamp: new Date().toISOString()
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error(`[Sync Task Failed]`, err?.message || err);
    return new Response(JSON.stringify({ 
      error: err?.message || 'Unknown error',
      details: JSON.stringify(err, Object.getOwnPropertyNames(err))
    }), { status: 500 });
  }
});

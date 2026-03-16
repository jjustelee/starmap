import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";

const urls = [
  "https://new.real.download.dws.korinvest.com/common/master/kospi_code.mst.zip",
  "https://new.real.download.dws.korinvest.com/common/master/kosdaq_code.mst.zip"
];

const decoder = new TextDecoder("euc-kr");

async function test() {
  for (const url of urls) {
    try {
      console.log(`Testing ${url}...`);
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const arrayBuffer = await response.arrayBuffer();
      console.log(`Success! Length: ${arrayBuffer.byteLength}`);
      
      const zip = new JSZip();
      const unzipped = await zip.loadAsync(arrayBuffer);
      const fileName = Object.keys(unzipped.files).find(f => f.endsWith('.mst'));
      console.log(`File in zip: ${fileName}`);
      
      const contentBuffer = await unzipped.files[fileName].async("uint8array");
      const content = decoder.decode(contentBuffer);
      console.log(`Content sample (first 100 chars): ${content.substring(0, 100)}`);
    } catch (err) {
      console.error(`Failed ${url}: ${err.message}`);
    }
  }
}

test();

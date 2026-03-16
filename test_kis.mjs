import axios from 'axios';
import JSZip from 'jszip';
import iconv from 'iconv-lite';

const urls = [
  "https://new.real.download.dws.korinvest.com/common/master/kospi_code.mst.zip",
  "https://new.real.download.dws.korinvest.com/common/master/kosdaq_code.mst.zip"
];

async function test() {
  for (const url of urls) {
    try {
      console.log(`Testing ${url}...`);
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 });
      console.log(`Success! Length: ${response.data.byteLength}`);
      
      const zip = await JSZip.loadAsync(response.data);
      const fileName = Object.keys(zip.files).find(f => f.endsWith('.mst'));
      console.log(`File in zip: ${fileName}`);
      
      const contentBuffer = await zip.files[fileName].async("nodebuffer");
      const content = iconv.decode(contentBuffer, 'euc-kr');
      console.log(`Content sample (first 100 chars): ${content.substring(0, 100)}`);
    } catch (err) {
      console.error(`Failed ${url}: ${err.message}`);
    }
  }
}

test();

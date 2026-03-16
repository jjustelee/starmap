import requests
import zipfile
import io

urls = [
    "https://new.real.download.dws.korinvest.com/common/master/kospi_code.mst.zip",
    "https://new.real.download.dws.korinvest.com/common/master/kosdaq_code.mst.zip"
]

for url in urls:
    try:
        print(f"Testing {url}...")
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        print(f"Status: {r.status_code}, Length: {len(r.content)}")
        if r.status_code == 200:
            with zipfile.ZipFile(io.BytesIO(r.content)) as z:
                print(f"Files: {z.namelist()}")
                first_file = [f for f in z.namelist() if f.endswith('.mst')][0]
                with z.open(first_file) as f:
                    content = f.read(100).decode('cp949', errors='ignore')
                    print(f"Sample: {content}")
    except Exception as e:
        print(f"Error: {e}")

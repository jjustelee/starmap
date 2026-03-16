import urllib.request
import zipfile
import io

urls = [
    "https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip",
    "https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip"
]

for url in urls:
    try:
        print(f"Testing {url}...")
        headers = {"User-Agent": "Mozilla/5.0"}
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            data = response.read()
            print(f"Status: {response.status}, Length: {len(data)}")
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                print(f"Files: {z.namelist()}")
                first_file = [f for f in z.namelist() if f.endswith('.mst')][0]
                with z.open(first_file) as f:
                    content = f.read(100).decode('cp949', errors='ignore')
                    print(f"Sample: {content}")
    except Exception as e:
        print(f"Error: {e}")

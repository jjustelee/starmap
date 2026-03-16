/**
 * [프론트엔드] 로컬 종목 검색 엔진
 * - 종목코드(숫자) / 초성(ㅎㄱ) / 종목명(한글) 3단 자동 분기
 * - 가중치 정렬: 정확일치 > 접두어 > 부분일치
 * - 디바운싱은 호출부(App.jsx)에서 처리
 * 
 * [백엔드 참고] stock_master 테이블 스키마:
 *   code TEXT PK, name TEXT, chosung TEXT, market TEXT
 */

// 한글 초성 추출 함수
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

export function getChosung(str) {
    let result = '';
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code >= 0xAC00 && code <= 0xD7A3) {
            result += CHO[Math.floor((code - 0xAC00) / 588)];
        }
    }
    return result;
}

// 입력이 초성만으로 구성되어 있는지 판별
function isChosungOnly(str) {
    return /^[ㄱ-ㅎ]+$/.test(str);
}

// 입력이 숫자만인지 판별
function isNumericOnly(str) {
    return /^\d+$/.test(str);
}

/**
 * 로컬 종목 검색 (메모리 내 필터링, < 5ms)
 * @param {Array} allStocks - stock_master 전체 데이터 [{code, name, chosung, market}]
 * @param {string} query - 사용자 입력 검색어
 * @returns {Array} 검색 결과 [{code, name, chosung, market, matchScore}]
 */
export function searchStocksLocal(allStocks, query) {
    if (!query || !query.trim()) return [];
    
    const qRaw = query.trim();
    const qLower = qRaw.toLowerCase();
    const qNoSpace = qLower.replace(/\s+/g, ''); // 공백 제거 정규화
    
    if (qNoSpace.length < 1) return [];
    
    let results = [];
    
    if (isNumericOnly(qNoSpace)) {
        // [모드 1] 숫자 입력 → 종목코드 매칭
        results = allStocks
            .filter(s => s && s.code && s.code.includes(qNoSpace))
            .map(s => ({
                ...s,
                matchScore: s.code === qNoSpace ? 100 : (s.code.startsWith(qNoSpace) ? 80 : 50)
            }));
    } else if (isChosungOnly(qNoSpace)) {
        // [모드 2] 초성 입력 → chosung 필드 매칭
        results = allStocks
            .filter(s => s && s.chosung && s.chosung.includes(qNoSpace))
            .map(s => ({
                ...s,
                matchScore: s.chosung === qNoSpace ? 100 : (s.chosung.startsWith(qNoSpace) ? 80 : 50)
            }));
    } else {
        // [모드 3] 일반 문자 → 종목명 부분 일치 + 초성 보조 매칭
        const inputChosung = getChosung(qNoSpace);
        
        results = allStocks
            .filter(s => {
                if (!s || !s.name) return false;
                const nameNoSpace = s.name.toLowerCase().replace(/\s+/g, '');
                
                // 1. 종목명(정규화)에 검색어가 포함되거나
                if (nameNoSpace.includes(qNoSpace)) return true;
                // 2. 검색어에 종목명(정규화)이 포함되거나 ('SK하이닉스' 검색 시 '하이닉스' 찾기)
                if (qNoSpace.includes(nameNoSpace) && nameNoSpace.length >= 2) return true;
                // 3. 입력의 초성이 종목 초성에 포함
                if (inputChosung && s.chosung && s.chosung.includes(inputChosung)) return true;
                
                return false;
            })
            .map(s => {
                const nameLower = s.name.toLowerCase();
                const nameNoSpace = nameLower.replace(/\s+/g, '');
                let score = 0;
                
                // 1. 기본 매칭 점수 (티어별 가중치)
                if (nameNoSpace === qNoSpace) {
                    score = 1000; // 완전 일치
                } else if (nameNoSpace.startsWith(qNoSpace)) {
                    score = 800;  // 접두어 일치
                } else if (nameNoSpace.includes(qNoSpace)) {
                    score = 600;  // 부분 일치
                } else if (qNoSpace.includes(nameNoSpace)) {
                    score = 400;  // 역방향 포함
                } else if (inputChosung && s.chosung && s.chosung.includes(inputChosung)) {
                    score = 200;  // 초성 일치
                }

                if (score === 0) return { ...s, matchScore: 0 };

                // 2. 보조 가중치 (Tie-breakers)
                
                // [시장 점수] KOSPI, KOSDAQ 본주들에 가중치 부여 (ETF 등과 구별)
                if (s.market_type === 'KOSPI' || s.market_type === 'KOSDAQ') {
                    score += 50; 
                }

                // [우선순위 보정] 우선주('우')는 해당 티어 내에서 하단 배치
                if (s.name && (s.name.endsWith('우') || s.name.endsWith('우B') || s.name.includes('우(') || s.name.includes('우 '))) {
                    score -= 10; 
                }
                
                return { ...s, matchScore: score };
            })
            .filter(s => s.matchScore > 0);
    }
    
    // 1차: 가중치 내림차순, 2차: 이름 오름차순 (ㄱㄴㄷ > ABC > 123)
    return results.sort((a, b) => {
        if (b.matchScore !== a.matchScore) {
            return b.matchScore - a.matchScore;
        }
        return a.name.localeCompare(b.name, 'ko');
    });
}

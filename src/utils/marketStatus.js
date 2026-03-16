/**
 * 한국 주식 시장 운영 상태를 확인하는 유틸리티
 * 운영 시간: 평일 09:00 ~ 15:30 (KST)
 */
export const getMarketStatus = () => {
    // 1. 현재 한국 시간(KST) 구하기
    const now = new Date();
    const kstOffset = 9 * 60; // KST는 UTC+9
    const localOffset = now.getTimezoneOffset(); // 분 단위
    const kstTime = new Date(now.getTime() + (kstOffset + localOffset) * 60000);
    
    const day = kstTime.getDay(); // 0(일) ~ 6(토)
    const hours = kstTime.getHours();
    const minutes = kstTime.getMinutes();
    const currentTimeInMinutes = hours * 60 + minutes;

    // 2026년 한국 주식시장 휴장일 (임시/공휴일 포함)
    const holidays2026 = [
        '2026-01-01', // 신정
        '2026-02-16', '2026-02-17', '2026-02-18', // 설날 연휴
        '2026-03-01', // 삼일절
        '2026-03-02', // 삼일절 대체공휴일
        '2026-05-01', // 근로자의 날
        '2026-05-05', // 어린이날
        '2026-05-24', // 부처님 오신 날
        '2026-05-25', // 부처님 오신 날 대체공휴일
        '2026-06-06', // 현충일
        '2026-08-15', // 광복절
        '2026-08-17', // 광복절 대체공휴일
        '2026-09-24', '2026-09-25', '2026-09-26', // 추석 연휴
        '2026-10-03', // 개천절
        '2026-10-05', // 개천절 대체공휴일
        '2026-10-09', // 한글날
        '2026-12-25', // 성탄절
        '2026-12-31', // 연말 휴장일
    ];

    const y = kstTime.getFullYear();
    const m = String(kstTime.getMonth() + 1).padStart(2, '0');
    const d = String(kstTime.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // 장 시작: 09:00 (540분), 장 종료: 15:30 (930분)
    const marketOpen = 9 * 60;
    const marketClose = 15 * 60 + 30;

    // 주말(토, 일) 제외, 공휴일 제외, 운영 시간 확인
    const isWeekend = day === 0 || day === 6;
    const isHoliday = holidays2026.includes(dateStr);
    const isWithinHours = currentTimeInMinutes >= marketOpen && currentTimeInMinutes < marketClose;

    const isOpen = !isWeekend && !isHoliday && isWithinHours;

    return {
        isOpen,
        text: isOpen ? '실시간' : '장종료'
    };
};

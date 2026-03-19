/**
 * [UI] 공용 공유 유틸
 * 우선순위:
 * 1) Web Share API
 * 2) Clipboard 복사
 * 3) 미지원 상태 반환
 *
 * @param {{ title?: string, text?: string, url?: string }} payload
 * @returns {Promise<"shared" | "copied" | "unsupported" | "failed">}
 */
export const shareContent = async ({ title = '', text = '', url = '' } = {}) => {
    const normalizedTitle = String(title || '').trim();
    const normalizedText = String(text || '').trim();
    const normalizedUrl = String(url || '').trim();

    if (!normalizedTitle && !normalizedText && !normalizedUrl) {
        return 'unsupported';
    }

    const sharePayload = {};
    if (normalizedTitle) sharePayload.title = normalizedTitle;
    if (normalizedText) sharePayload.text = normalizedText;
    if (normalizedUrl) sharePayload.url = normalizedUrl;

    try {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            await navigator.share(sharePayload);
            return 'shared';
        }
    } catch (error) {
        // 사용자가 공유창을 닫은 경우를 포함해, 다음 fallback으로 이어집니다.
    }

    const clipboardText = [normalizedTitle, normalizedText, normalizedUrl]
        .filter(Boolean)
        .join('\n');

    try {
        if (
            clipboardText &&
            typeof navigator !== 'undefined' &&
            navigator.clipboard &&
            typeof navigator.clipboard.writeText === 'function'
        ) {
            await navigator.clipboard.writeText(clipboardText);
            return 'copied';
        }
    } catch (error) {
        return 'failed';
    }

    return 'unsupported';
};

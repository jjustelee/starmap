import { supabase } from '../utils/supabaseClient';

export const DAILY_MARKET_POLL_CHOICES = ['up', 'flat', 'down'];

export async function loadDailyMarketPoll(stockId, currentUserId = null, pollDate = getLocalPollDateKey()) {
    if (!stockId) {
        return buildEmptyDailyMarketPoll(pollDate);
    }

    const { data, error } = await supabase
        .from('daily_market_polls')
        .select('choice, user_id, poll_date, created_at')
        .eq('stock_id', stockId)
        .eq('poll_date', pollDate)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error loading daily market poll:', error);
        return buildEmptyDailyMarketPoll(pollDate);
    }

    return buildDailyMarketPollFromRows(data || [], currentUserId, pollDate);
}

export async function submitDailyMarketPollVote({ stockId, currentUserId, choice, pollDate = getLocalPollDateKey() }) {
    const normalizedChoice = normalizeDailyMarketChoice(choice);
    if (!stockId) {
        throw new Error('종목 정보를 찾지 못했어요.');
    }
    if (!currentUserId) {
        throw new Error('로그인 후 투표할 수 있어요.');
    }
    if (!normalizedChoice) {
        throw new Error('투표 항목을 다시 선택해 주세요.');
    }

    const { error } = await supabase.from('daily_market_polls').upsert({
        stock_id: stockId,
        user_id: currentUserId,
        poll_date: pollDate,
        choice: normalizedChoice
    }, {
        onConflict: 'stock_id,poll_date,user_id'
    });

    if (error) {
        console.error('Error submitting daily market poll vote:', error);
        throw new Error('투표를 저장하지 못했어요.');
    }

    return { ok: true, pollDate, choice: normalizedChoice };
}

export function getLocalPollDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function normalizeDailyMarketChoice(choice) {
    const normalized = String(choice || '').trim().toLowerCase();
    if (DAILY_MARKET_POLL_CHOICES.includes(normalized)) {
        return normalized;
    }
    return '';
}

function buildDailyMarketPollFromRows(rows, currentUserId, pollDate) {
    const counts = {
        up: 0,
        flat: 0,
        down: 0
    };
    let mineChoice = '';

    for (const row of rows) {
        const choice = normalizeDailyMarketChoice(row?.choice);
        if (!choice) continue;
        counts[choice] += 1;
        if (currentUserId && String(row?.user_id || '') === String(currentUserId)) {
            mineChoice = choice;
        }
    }

    const totalVotes = counts.up + counts.flat + counts.down;

    return {
        pollDate,
        totalVotes,
        counts,
        mineChoice,
        updatedAt: new Date().toISOString()
    };
}

function buildEmptyDailyMarketPoll(pollDate) {
    return {
        pollDate,
        totalVotes: 0,
        counts: {
            up: 0,
            flat: 0,
            down: 0
        },
        mineChoice: '',
        updatedAt: new Date().toISOString()
    };
}

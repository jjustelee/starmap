import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    getLocalPollDateKey,
    loadDailyMarketPoll,
    normalizeDailyMarketChoice,
    submitDailyMarketPollVote
} from '../services/dailyMarketPollService';

const POLL_OPTIONS = [
    { key: 'up', label: '상승', tone: 'pink', description: '위' },
    { key: 'flat', label: '보합', tone: 'neutral', description: '유지' },
    { key: 'down', label: '하락', tone: 'teal', description: '아래' }
];

const DailyMarketPoll = ({ stockId, symbol, currentPrice, isLoggedIn = false, userId = null, onLogin }) => {
    const [pollState, setPollState] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const pendingSubmitRef = useRef('');
    const pollDate = useMemo(() => getLocalPollDateKey(), []);
    const pendingStorageKey = useMemo(() => `kokok.daily-poll.pending:${String(stockId || symbol || 'unknown')}:${pollDate}`, [pollDate, stockId, symbol]);

    const reloadPoll = useCallback(async () => {
        if (!stockId) return;
        setIsLoading(true);
        try {
            const next = await loadDailyMarketPoll(stockId, userId, pollDate);
            setPollState(next);
        } finally {
            setIsLoading(false);
        }
    }, [pollDate, stockId, userId]);

    useEffect(() => {
        void reloadPoll();
    }, [reloadPoll]);

    const clearPendingVote = useCallback(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.removeItem(pendingStorageKey);
        } catch {
            // best-effort
        }
    }, [pendingStorageKey]);

    const readPendingVote = useCallback(() => {
        if (typeof window === 'undefined') return null;
        try {
            const raw = window.localStorage.getItem(pendingStorageKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const choice = normalizeDailyMarketChoice(parsed?.choice);
            if (!choice) return null;
            return {
                choice,
                pollDate: String(parsed?.pollDate || ''),
                stockId: String(parsed?.stockId || '')
            };
        } catch {
            return null;
        }
    }, [pendingStorageKey]);

    const handleVote = useCallback(async (choice) => {
        const normalizedChoice = normalizeDailyMarketChoice(choice);
        if (!normalizedChoice || !stockId) return;

        setErrorMessage('');
        if (!isLoggedIn) {
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(pendingStorageKey, JSON.stringify({
                    choice: normalizedChoice,
                    pollDate,
                    stockId,
                    savedAt: Date.now()
                }));
            }
            onLogin?.();
            return;
        }

        setIsSubmitting(true);
        try {
            await submitDailyMarketPollVote({
                stockId,
                currentUserId: userId,
                choice: normalizedChoice,
                pollDate
            });
            clearPendingVote();
            await reloadPoll();
        } catch (error) {
            setErrorMessage(error?.message || '투표를 저장하지 못했어요.');
        } finally {
            setIsSubmitting(false);
        }
    }, [clearPendingVote, isLoggedIn, onLogin, pendingStorageKey, pollDate, reloadPoll, stockId, userId]);

    useEffect(() => {
        if (!isLoggedIn || !userId || !stockId) return;
        if (isLoading) return;
        if (pollState?.mineChoice) {
            clearPendingVote();
            pendingSubmitRef.current = '';
            return;
        }

        const pending = readPendingVote();
        if (!pending) return;
        if (pending.choice === pendingSubmitRef.current) return;
        if (pending.stockId && pending.stockId !== String(stockId)) return;
        if (pending.pollDate && pending.pollDate !== pollDate) {
            clearPendingVote();
            return;
        }

        pendingSubmitRef.current = pending.choice;
        void handleVote(pending.choice);
    }, [
        clearPendingVote,
        handleVote,
        isLoading,
        isLoggedIn,
        pollDate,
        pollState?.mineChoice,
        readPendingVote,
        stockId,
        userId
    ]);

    const totalVotes = Number(pollState?.totalVotes || 0);
    if (isLoading) {
        return (
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)] animate-pulse">
                <div className="h-4 w-20 rounded bg-white/10" />
                <div className="mt-2 h-5 w-44 rounded bg-white/10" />
                <div className="mt-4 space-y-3">
                    <div className="h-[84px] rounded-[22px] bg-white/10" />
                    <div className="h-[84px] rounded-[22px] bg-white/10" />
                    <div className="h-[84px] rounded-[22px] bg-white/10" />
                </div>
            </section>
        );
    }

    return (
            <section className="rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl px-4 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center text-neon-teal text-[22px]">↗</span>
                    <p className="text-[20px] font-black leading-none tracking-tight text-[#F3F4F6]">내일장 예측</p>
                </div>
                <span className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-[12px] font-bold text-[#D1D5DB]">
                    D-1
                </span>
            </div>

            <div className="mt-4 space-y-3">
                {POLL_OPTIONS.map((option) => {
                    const count = Number(pollState?.counts?.[option.key] || 0);
                    const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    const selected = pollState?.mineChoice === option.key;
                    const isDisabled = isSubmitting && !selected;
                    const tone = option.tone === 'pink'
                        ? 'bg-neon-pink'
                        : option.tone === 'teal'
                            ? 'bg-neon-teal'
                            : 'bg-[#9CA3AF]';

                    return (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => void handleVote(option.key)}
                            disabled={isDisabled}
                            className={`w-full rounded-[22px] border px-3 py-3 text-left transition ${
                                selected
                                    ? 'border-neon-pink/30 bg-neon-pink/8'
                                    : 'border-white/10 bg-[#121212]/20'
                            } ${isDisabled ? 'opacity-70' : ''}`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[15px] font-bold text-[#F3F4F6]">{option.label}</p>
                                    <p className="mt-1 text-[12px] font-bold text-[#9CA3AF]">{option.description}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-[18px] font-extrabold leading-none text-[#F3F4F6]">{percent}%</p>
                                    <p className="mt-1 text-[11px] font-bold text-[#9CA3AF]">{count}표</p>
                                </div>
                            </div>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                                <div
                                    className={`h-full rounded-full transition-[width] duration-500 ${tone}`}
                                    style={{ width: `${Math.max(4, percent)}%` }}
                                />
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2 text-[12px] font-bold">
                                <span className="text-[#9CA3AF]">
                                    {selected ? '내 투표' : (isLoggedIn ? '선택하기' : '로그인 후 투표')}
                                </span>
                                {selected ? <span className="text-neon-pink">반영됨</span> : <span className="text-[#D1D5DB]">투표</span>}
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-bold text-[#D1D5DB]">
                        {isLoggedIn ? '결과 확인' : '로그인 후 저장'}
                    </p>
                    <p className="text-[12px] font-bold text-[#9CA3AF]">
                        {currentPrice > 0 ? `${Math.round(currentPrice).toLocaleString()}원` : '기준'}
                    </p>
                </div>
            </div>

            {errorMessage ? (
                <p className="mt-3 text-[13px] font-bold text-[#FCA5A5]">{errorMessage}</p>
            ) : null}
        </section>
    );
};

export default DailyMarketPoll;

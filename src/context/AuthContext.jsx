import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

/**
 * [백엔드] 인증 상태 관리 Context
 * Supabase Auth + 카카오 OAuth를 통해 세션을 관리합니다.
 * 앱 어디서든 useAuth()를 호출하여 로그인 상태를 확인할 수 있습니다.
 */
const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProfileLoading, setIsProfileLoading] = useState(false);
    const [hasProfileRecord, setHasProfileRecord] = useState(false);
    const postLoginAction = React.useRef(null);

    const fetchProfile = async (userId) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching profile:', error.message);
            return null;
        }
        return data;
    };

    useEffect(() => {
        let isMounted = true;

        const refreshProfile = async (userId) => {
            try {
                const userProfile = await fetchProfile(userId);
                if (!isMounted) return;
                setProfile(userProfile || null);
                setHasProfileRecord(Boolean(userProfile));
                setIsProfileLoading(false);

                // 로그인 성공 시 지연 실행할 액션이 있다면 실행
                if (userProfile && postLoginAction.current) {
                    console.log('AuthContext: Executing post-login action');
                    const action = postLoginAction.current;
                    postLoginAction.current = null;
                    action(userId);
                }
            } catch (err) {
                if (!isMounted) return;
                console.error('AuthContext: Profile refresh failed:', err);
                setProfile(null);
                setHasProfileRecord(false);
                setIsProfileLoading(false);
            }
        };

        const applySession = (currentUser) => {
            if (!isMounted) return;
            setUser(currentUser);
            // 로딩 해제는 프로필 조회와 분리해서 항상 빠르게 보장
            setIsLoading(false);

            if (currentUser) {
                // 이전 프로필이 남아있지 않도록 초기화 후 비동기 갱신
                setProfile(null);
                setHasProfileRecord(false);
                setIsProfileLoading(true);
                void refreshProfile(currentUser.id);
            } else {
                setProfile(null);
                setHasProfileRecord(false);
                setIsProfileLoading(false);
            }
        };

        const getSession = async () => {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();
                applySession(session?.user ?? null);
            } catch (err) {
                console.error('AuthContext: Error in getSession:', err);
                if (isMounted) setIsLoading(false);
            }
        };

        getSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            applySession(session?.user ?? null);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const signInWithKakao = async (onSuccessAction = null) => {
        if (onSuccessAction) {
            postLoginAction.current = onSuccessAction;
        }
        
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'kakao',
            options: {
                redirectTo: window.location.href, // 현재 페이지로 돌아오도록 수정
                queryParams: {
                    scope: 'profile_nickname,profile_image',
                },
            },
        });
        if (error) {
            console.error('Kakao login error:', error.message);
        }
    };

    const signInWithEmail = async (email, password, onSuccessAction = null) => {
        if (onSuccessAction) {
            postLoginAction.current = onSuccessAction;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('Email login error:', error.message);
            throw error;
        }
        return data;
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Sign out error:', error.message);
        }
    };

    const updateProfile = async (updates) => {
        if (!user) return;

        const payload = {
            id: user.id,
            ...updates,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('profiles')
            .upsert(payload, { onConflict: 'id' })
            .select('*')
            .single();

        if (error) {
            console.error('Error updating profile:', error.message);
            throw error;
        }

        setProfile(data || payload);
        setHasProfileRecord(true);
    };

    const value = {
        user,
        userId: user?.id || null,
        profile: {
            nickname: profile?.nickname || (user ? '별지기' : null),
            avatar: profile?.avatar_url || null,
            isOnboarded: profile?.is_onboarded || false,
            email: user?.email || null,
        },
        isLoggedIn: !!user,
        isLoading,
        isProfileLoading,
        hasProfileRecord,
        signInWithKakao,
        signInWithEmail,
        signOut,
        updateProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

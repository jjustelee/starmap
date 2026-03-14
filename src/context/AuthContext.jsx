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
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // [백엔드] 현재 세션 복원 (리프레시 후에도 로그인 유지)
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
            setIsLoading(false);
        };
        getSession();

        // [백엔드] Auth 상태 변경 리스너 (로그인/로그아웃 시 자동 갱신)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null);
                setIsLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    /**
     * 카카오 OAuth 로그인
     * Supabase가 카카오 인증 페이지로 리다이렉트합니다.
     * 로그인 완료 후 앱으로 돌아오면 onAuthStateChange가 자동 발동합니다.
     */
    const signInWithKakao = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'kakao',
            options: {
                redirectTo: window.location.origin,
                // [백엔드] account_email 권한이 없는 경우를 대비해 닉네임과 프로필만 요청
                queryParams: {
                    scope: 'profile_nickname,profile_image'
                }
            },
        });
        if (error) {
            console.error('Kakao login error:', error.message);
        }
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Sign out error:', error.message);
        }
    };

    const value = {
        user,
        isLoggedIn: !!user,
        isLoading,
        signInWithKakao,
        signOut,
        // 카카오 프로필 정보 (user_metadata에서 추출)
        profile: user ? {
            nickname: user.user_metadata?.name 
                    || user.user_metadata?.full_name 
                    || user.user_metadata?.preferred_username
                    || '별지기',
            avatar: user.user_metadata?.avatar_url 
                    || user.user_metadata?.picture 
                    || null,
            email: user.email || null,
        } : null,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

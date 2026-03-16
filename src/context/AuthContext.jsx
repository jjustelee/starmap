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
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            
            if (currentUser) {
                const userProfile = await fetchProfile(currentUser.id);
                setProfile(userProfile);
            }
            setIsLoading(false);
        };
        getSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                const currentUser = session?.user ?? null;
                setUser(currentUser);
                
                if (currentUser) {
                    const userProfile = await fetchProfile(currentUser.id);
                    setProfile(userProfile);
                } else {
                    setProfile(null);
                }
                setIsLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signInWithKakao = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'kakao',
            options: {
                redirectTo: window.location.origin,
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

    const updateProfile = async (updates) => {
        if (!user) return;
        
        const { error } = await supabase
            .from('profiles')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        if (error) {
            console.error('Error updating profile:', error.message);
            throw error;
        }

        // 로컬 상태 갱신
        setProfile(prev => ({ ...prev, ...updates }));
    };

    const value = {
        user,
        profile: profile ? {
            nickname: profile.nickname,
            avatar: profile.avatar_url,
            isOnboarded: profile.is_onboarded,
            email: user?.email || null,
        } : null,
        isLoggedIn: !!user,
        isLoading,
        signInWithKakao,
        signOut,
        updateProfile,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

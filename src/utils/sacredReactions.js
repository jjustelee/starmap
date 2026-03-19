import { supabase } from './supabaseClient';

export const fetchUserSacredReactions = async (predictionIds, userId) => {
    if (!userId || !Array.isArray(predictionIds) || predictionIds.length === 0) {
        return {};
    }

    const { data, error } = await supabase
        .from('sacred_reactions')
        .select('prediction_id, reaction_key')
        .eq('user_id', userId)
        .in('prediction_id', predictionIds);

    if (error) {
        console.error('Error fetching sacred reactions:', error);
        return {};
    }

    return (data || []).reduce((acc, row) => {
        const predictionId = String(row.prediction_id || '');
        const reactionKey = String(row.reaction_key || '');
        if (!predictionId || !reactionKey) return acc;
        acc[predictionId] = reactionKey;
        return acc;
    }, {});
};

export const toggleSacredReaction = async ({ predictionId, userId, reactionKey, currentReactionKey }) => {
    if (!predictionId || !userId || !reactionKey) {
        return false;
    }

    if (currentReactionKey === reactionKey) {
        const { error } = await supabase
            .from('sacred_reactions')
            .delete()
            .eq('prediction_id', predictionId)
            .eq('user_id', userId);

        if (error) {
            console.error('Error deleting sacred reaction:', error);
            return false;
        }
        return true;
    }

    const { error } = await supabase
        .from('sacred_reactions')
        .upsert([{
            prediction_id: predictionId,
            user_id: userId,
            reaction_key: reactionKey
        }], {
            onConflict: 'prediction_id,user_id'
        });

    if (error) {
        console.error('Error upserting sacred reaction:', error);
        return false;
    }

    return true;
};

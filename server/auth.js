const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const supabase = require('./supabase');

module.exports = function(passport) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback",
        proxy: true // Trust the X-Forwarded-Proto header from ngrok
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            // Upsert User into Supabase
            const { data, error } = await supabase
                .from('users')
                .upsert({ 
                    google_id: profile.id,
                    email: (profile.emails && profile.emails.length > 0) ? profile.emails[0].value : `${profile.id}@no-email.com`,
                    display_name: profile.displayName || 'Unknown User',
                    avatar_url: (profile.photos && profile.photos.length > 0) ? profile.photos[0].value : '',
                    access_token: accessToken,
                    refresh_token: refreshToken
                    // balance: defaults to 0 on insert, preserved on update (actually upsert replaces unless we specify ignoreIgnoring, 
                    // but simple upsert replaces fields provided. Using onConflict we might need to be careful not to reset balance.
                    // Default upsert behaviour in Supabase JS: updates existing row. If we don't supply 'balance', it should keep old value?
                    // NO: upsert requires all columns or it assumes null? 
                    // Actually, if we just provide these fields, Supabase updates ONLY these fields for the matching row.
                }, { onConflict: 'google_id' })
                .select()
                .single();

            if (error) {
                console.error("Supabase Login Error:", error);
                return done(error, null);
            }
            
            return done(null, data);
        } catch (err) {
            console.error(err);
            return done(err, null);
        }
    }));

    passport.serializeUser((user, done) => {
        done(null, user.id); // Serialize UUID
    });

    passport.deserializeUser(async (id, done) => {
        const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
        done(error, data);
    });
};

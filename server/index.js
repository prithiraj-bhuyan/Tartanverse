const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const cors = require("cors");
const passport = require("passport");
const session = require("express-session");
const { google } = require("googleapis");
const supabase = require("./supabase");
require("dotenv").config();

// Passport Config
require("./auth")(passport);

const app = express();

app.use(cors({
  origin: (origin, callback) => callback(null, true), // Allow any origin for dev
  credentials: true
}));
app.use(express.json());

// Express Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: true,
  saveUninitialized: true
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, true), // Allow any origin
    methods: ["GET", "POST"],
    credentials: true
  }
});

let wallets = {};
let players = {};

// --- SUPABASE ROUTES ---

// Helper to get User from DB by Socket ID (we use socket.id as temp ID in frontend, 
// but in reality we need to link socket.id to user database ID.
// For this hackathon, we'll assume the client sends their Database UUID or Google ID if logged in.)
// Actually, `cards` / `wallets` logic seems to use `userId` which in `App.js` is `socket.id`.
// We need to fix this.
//
// [FIX]: App.js should send the Authenticated User ID if logged in, otherwise fall back to socket.id.
// But Passport session `req.user` gives us the Auth ID.
//
// New Strategy:
// 1. `req.user` contains the DB user (deserialized).
// 2. We use `req.user.id` for wallet/quests.

app.get('/api/wallet', async (req, res) => {
  if (!req.user) {
    return res.json({ balance: 0, linked: false });
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('balance')
    .eq('id', req.user.id)
    .single();

  if (error) {
    console.error('Error fetching wallet:', error);
    return res.json({ balance: 0, linked: true });
  }

  res.json({ balance: user.balance, linked: true });
});

app.post('/api/quest-complete', async (req, res) => {
  const { zoneId, reward } = req.body;

  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 1. Record visit
    const { error: visitError } = await supabase
      .from('visited_zones')
      .insert({
        user_id: req.user.id,
        zone_id: zoneId
      });

    if (visitError) throw visitError;

    // 2. Increment balance (RPC or manual update)
    // We'll read, then update for simplicity if no RPC set up
    const { data: user } = await supabase
      .from('users')
      .select('balance')
      .eq('id', req.user.id)
      .single();

    const newBalance = (user.balance || 0) + reward;

    await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', req.user.id);

    res.json({ success: true, newBalance });

  } catch (err) {
    console.error("Transaction failed", err);
    res.status(500).json({ error: 'Failed to complete quest' });
  }
});

// [NEW] Get visited zones for current user
app.get('/api/visited-zones', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { data, error } = await supabase
      .from('visited_zones')
      .select('zone_id')
      .eq('user_id', req.user.id);

    if (error) throw error;

    // Return array of zone IDs
    const zoneIds = data.map(v => v.zone_id);
    res.json(zoneIds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch visited zones' });
  }
});

// --- FRIEND ROUTES ---

// Add Friend by Email
// [NEW] Search Users by Name
app.get('/api/users/search', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { query } = req.query;
  if (!query || query.length < 2) return res.json([]);

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, email')
      .ilike('display_name', `%${query}%`)
      .limit(5);

    if (error) throw error;

    // Filter out self
    const results = data.filter(u => u.id !== req.user.id);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.post('/api/friends/add', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { email, friendId } = req.body;

  try {
    let friend;

    if (friendId) {
      // Direct ID provided (from search)
      friend = { id: friendId };
    } else if (email) {
      // Email provided (from manual add)
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
      if (error || !data) return res.status(404).json({ error: 'User not found' });
      friend = data;
    } else {
      return res.status(400).json({ error: "Email or Friend ID required" });
    }

    // Check self
    if (friend.id === req.user.id) {
      return res.status(400).json({ error: "Cannot add yourself" });
    }

    // Create Friendship (Pending Request)
    const { error: insertError } = await supabase
      .from('friendships')
      .insert({
        user_id: req.user.id,
        friend_id: friend.id,
        status: 'pending', // [CHANGED] Now pending
        is_best_friend: false
      });

    if (insertError) {
      // Check for duplicate
      if (insertError.code === '23505') return res.status(400).json({ error: 'Already friends' });
      throw insertError;
    }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add friend' });
  }
});

// List Friends
app.get('/api/friends', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select(`
        friend_id,
        is_best_friend,
        users!friendships_friend_id_fkey (
          id,
          display_name,
          email,
          avatar_url
        )
      `)
      .eq('user_id', req.user.id)
      .eq('status', 'accepted'); // [CHANGED] Only accepted friends

    if (error) throw error;

    const friendList = friendships.map(f => ({
      ...f.users,
      is_best_friend: f.is_best_friend
    }));

    res.json(friendList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list friends' });
  }
});

// [NEW] Get Incoming Friend Requests
app.get('/api/friends/requests', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    // Find rows where I am the friend_id and status is pending
    const { data: requests, error } = await supabase
      .from('friendships')
      .select(`
        user_id,
        status,
        users!friendships_user_id_fkey (
          id,
          display_name,
          email,
          avatar_url
        )
      `)
      .eq('friend_id', req.user.id)
      .eq('status', 'pending');

    if (error) throw error;

    // Flatten structure
    const requestList = requests.map(r => ({
      ...r.users,
      status: r.status
    }));

    res.json(requestList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// [NEW] Accept Friend Request
app.post('/api/friends/accept', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { requesterId } = req.body;

  try {
    // Update the request to accepted
    const { error: updateError } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .match({ user_id: requesterId, friend_id: req.user.id });

    if (updateError) throw updateError;

    // Create the reverse friendship (so it's mutual)
    // Friendship in this DB seems valid as 1-way row? 
    // Usually systems have 2 rows for mutual.
    // For simplicity, let's just insert the reverse row as accepted too.

    const { error: reverseError } = await supabase
      .from('friendships')
      .upsert({
        user_id: req.user.id,
        friend_id: requesterId,
        status: 'accepted',
        is_best_friend: false
      }, { onConflict: 'user_id, friend_id' }); // Avoid duplicates

    if (reverseError) throw reverseError;

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to accept' });
  }
});

// [NEW] Reject Friend Request
app.post('/api/friends/reject', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { requesterId } = req.body;

  try {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .match({ user_id: requesterId, friend_id: req.user.id });

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reject' });
  }
});

// Toggle Best Friend
app.post('/api/friends/toggle-best', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { friendId } = req.body;

  try {
    // Get current status
    const { data: current } = await supabase
      .from('friendships')
      .select('is_best_friend')
      .match({ user_id: req.user.id, friend_id: friendId })
      .single();

    if (!current) return res.status(404).json({ error: 'Friendship not found' });

    // Toggle
    await supabase
      .from('friendships')
      .update({ is_best_friend: !current.is_best_friend })
      .match({ user_id: req.user.id, friend_id: friendId });

    // Also toggle the reverse? (Usually best friends is mutual, but for now let's just do one-way or assume mutual logic elsewhere)
    // Let's do 1-way for simplicity of data model right now.

    res.json({ success: true, is_best_friend: !current.is_best_friend });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// --- GOOGLE OAUTH ROUTES ---

app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/calendar.readonly'],
  accessType: 'offline',
  prompt: 'consent'
}));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication, redirect to game
    // If serving from same port, redirect to /
    // If serving from 3000 (dev), redirecting to 3000 is needed, 
    // but in prod we want relative redirect.
    // Let's use relative for now.
    res.redirect('/');
  }
);

app.get('/api/user', (req, res) => {
  res.json(req.user || null);
});

// [NEW] Update User Avatar
app.post('/api/user/avatar', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { avatarUrl } = req.body;
  if (!avatarUrl) return res.status(400).json({ error: 'Avatar URL required' });

  try {
    const { error } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', req.user.id);

    if (error) throw error;

    // Update local session/cache if needed? 
    // Passport session usually persists, so we might need to manually update req.user if we relying on it
    // But req.user comes from session store.

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating avatar:', err);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

app.get('/api/logout', (req, res) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect('http://localhost:3000');
  });
});

app.get('/api/quests', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: req.user.access_token });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;

    // 4. [NEW] Fetch Custom Quests (Created by me or Invited)
    const { data: myCustomQuests, error: cqError } = await supabase
      .from('custom_quests')
      .select('*')
      .eq('creator_id', req.user.id);

    const { data: participatedQuests, error: pqError } = await supabase
      .from('quest_participants')
      .select(`
        status,
        custom_quests (
          id, name, description, latitude, longitude, points, start_time, creator_id
        )
      `)
      .eq('user_id', req.user.id);

    let customQuests = [];
    if (myCustomQuests) {
      // For each custom quest I created, fetch the participants
      for (const q of myCustomQuests) {
        const { data: participants } = await supabase
          .from('quest_participants')
          .select('user_id, status')
          .eq('quest_id', q.id);

        customQuests.push({
          id: q.id,
          name: q.name,
          description: q.description, // [NEW] Include description
          latitude: q.latitude,
          longitude: q.longitude,
          radius: 0.05,
          reward: q.points,
          source: 'custom_created',
          time: q.start_time,
          category: q.category || 'Other',
          invitedFriends: participants ? participants.map(p => p.user_id) : [] // [NEW] Include invited user IDs
        });
      }
    }

    if (participatedQuests) {
      // Include both accepted and pending
      customQuests = [...customQuests, ...participatedQuests.map(pq => ({
        id: pq.custom_quests.id,
        name: pq.custom_quests.name,
        latitude: pq.custom_quests.latitude,
        longitude: pq.custom_quests.longitude,
        radius: 0.05,
        reward: pq.custom_quests.points,
        source: 'custom_invited',
        inviteStatus: pq.status,
        time: pq.custom_quests.start_time,
        category: pq.custom_quests.category || 'Other' // [NEW] Include category
      }))];
    }

    // Calibrate CMU Buildings
    const CMU_BUILDINGS = {
      'HBH': { lat: 40.4455, lng: -79.9479, name: 'Hamburg Hall' },
      'HAMBURG': { lat: 40.4455, lng: -79.9479, name: 'Hamburg Hall' },
      'GHC': { lat: 40.4435, lng: -79.9444, name: 'Gates Hillman Center' },
      'GATES': { lat: 40.4435, lng: -79.9444, name: 'Gates Hillman Center' },
      'POS': { lat: 40.4409, lng: -79.9424, name: 'Posner Hall' },
      'POSNER': { lat: 40.4409, lng: -79.9424, name: 'Posner Hall' },
      'TEP': { lat: 40.4454, lng: -79.9427, name: 'Tepper Quad' },
      'TEPPER': { lat: 40.4454, lng: -79.9427, name: 'Tepper Quad' },
      'UC': { lat: 40.4433, lng: -79.9421, name: 'Cohon University Center' },
      'CUC': { lat: 40.4433, lng: -79.9421, name: 'Cohon University Center' },
      'DH': { lat: 40.4423, lng: -79.9443, name: 'Doherty Hall' },
      'DOHERTY': { lat: 40.4423, lng: -79.9443, name: 'Doherty Hall' },
      'WEH': { lat: 40.4426, lng: -79.9458, name: 'Wean Hall' },
      'WEAN': { lat: 40.4426, lng: -79.9458, name: 'Wean Hall' },
      'CFA': { lat: 40.4418, lng: -79.9431, name: 'College of Fine Arts' },
      'MM': { lat: 40.4415, lng: -79.9436, name: 'Margaret Morrison' },
      'BH': { lat: 40.4414, lng: -79.9446, name: 'Baker Hall' },
      'BAKER': { lat: 40.4414, lng: -79.9446, name: 'Baker Hall' },
      'PH': { lat: 40.4416, lng: -79.9463, name: 'Porter Hall' },
      'PORTER': { lat: 40.4416, lng: -79.9463, name: 'Porter Hall' },
      'NSH': { lat: 40.4440, lng: -79.9450, name: 'Newell-Simon Hall' },
    };

    // Map Calendar Events to Quests
    const calendarQuests = events
      .filter(event => {
        if (!event.location) return false;
        const loc = event.location.toLowerCase();
        // Filter out virtual meetings
        return !loc.includes('zoom') &&
          !loc.includes('meet.google') &&
          !loc.includes('online') &&
          !loc.includes('virtual') &&
          !loc.includes('teams') &&
          !loc.includes('discord') &&
          !loc.includes('webex');
      }) // Only non-virtual events with location
      .map(event => {
        // Geocode using CMU_BUILDINGS
        // Extract the first word or known key?
        // "HBH- 1202" -> "HBH"
        let lat = null;
        let lng = null;
        const locUpper = event.location.toUpperCase();

        // Allow loose matching
        for (const [key, coords] of Object.entries(CMU_BUILDINGS)) {
          if (locUpper.includes(key)) {
            lat = coords.lat;
            lng = coords.lng;
            break;
          }
        }

        // Allow events that have explicit lat,long strings if user manually added them
        // Not handled now, but good to know.

        if (!lat) return null; // [FILTER] If not a known CMU building, don't map it.

        // Add a tiny jitter so multiple events in same building don't perfectly overlap
        // Deterministic jitter based on ID
        const hash = event.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const latOffset = (hash % 10) * 0.00005; // very small offset (~5 meters)
        const lonOffset = (hash % 10) * 0.00005;

        return {
          id: event.id,
          name: event.summary,
          description: event.location, // e.g. "HBH- 1202"
          latitude: lat + latOffset,
          longitude: lng + lonOffset,
          reward: 50,
          radius: 0.05, // Small radius for buildings
          source: 'calendar',
          time: event.start.dateTime || event.start.date
        };
      })
      .filter(quest => quest !== null); // Remove unmapped events

    res.json([...customQuests, ...calendarQuests]);

  } catch (error) {
    console.error('Error fetching calendar:', error);
    // Don't fail entire app if calendar fails, return empty or partial
    res.json([]);
  }
});

// [NEW] Create Custom Quest
app.post('/api/quests/create', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { name, description, latitude, longitude, points, time, inviteFriendIds } = req.body;

  try {
    // 1. Create Quest
    const { data: quest, error: createError } = await supabase
      .from('custom_quests')
      .insert({
        creator_id: req.user.id,
        name,
        description,
        latitude,
        longitude,
        points: points || 100,
        start_time: time,
        category: req.body.category || 'Other' // [NEW] Save category
      })
      .select()
      .single();

    if (createError) throw createError;

    // 2. Invite Friends (Create Participants)
    if (inviteFriendIds && inviteFriendIds.length > 0) {
      const participants = inviteFriendIds.map(fid => ({
        quest_id: quest.id,
        user_id: fid,
        status: 'pending' // [CHANGED] Start as pending, requires acceptance
      }));

      const { error: inviteError } = await supabase
        .from('quest_participants')
        .insert(participants);

      if (inviteError) console.error("Error inviting friends", inviteError);
    }

    res.json({ success: true, quest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create quest' });
  }
});

// [NEW] Respond to Quest Invite
app.post('/api/quests/respond', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { questId, status } = req.body; // status: 'accepted' or 'rejected'

  try {
    if (status === 'rejected') {
      await supabase
        .from('quest_participants')
        .delete()
        .match({ quest_id: questId, user_id: req.user.id });
    } else {
      await supabase
        .from('quest_participants')
        .update({ status: 'accepted' })
        .match({ quest_id: questId, user_id: req.user.id });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to respond' });
  }
});

// [NEW] Check Friend Availability
app.post('/api/friends/availability', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { time, duration } = req.body;

  if (!time) return res.status(400).json({ error: 'Time required' });

  const startTime = new Date(time);
  const endTime = new Date(startTime.getTime() + (duration || 60) * 60 * 1000); // Default 1 hour

  try {
    // 1. Get all friends
    const { data: friends } = await supabase
      .from('friendships')
      .select(`
            id,
            friend_id,
            users:friend_id ( id, display_name, avatar_url, access_token )
        `)
      .or(`user_id.eq.${req.user.id},friend_id.eq.${req.user.id}`);

    if (!friends) return res.json([]);

    const distinctFriends = [];
    const seen = new Set();
    friends.forEach(f => {
      // Resolve friend user object
      let friendUser = f.users; // If embedded correctly
      // Supabase embedding might return array or object depending on relationship.
      // Actually, let's trust the /api/friends implementation which handles this.
      // Simpler: Just fetch list of friends we already have from another call?
      // No, let's just query users directly who are friends.
    });

    // Let's reuse the logic from /api/friends but simplified for just checking availability
    // Actually, let's just query participant records for overlapping times

    // A. Check Custom Quests (Game Conflicts)
    const { data: busyInGame } = await supabase
      .from('quest_participants')
      .select('user_id, status, custom_quests(start_time)')
      .eq('status', 'accepted') // Only care if they accepted
    // Time overlap logic is hard in SQL without ranges.
    // Let's just fetch all quests around this time?
    // Simpler: Fetch all participants for quests starting within +/- 2 hours?

    // For Hackathon speed: Let's assume Game ID checks are too complex for SQL right now.
    // Let's check Google Calendar availability if token exists.

    // We need the list of Friend IDs to check.
    // Let's expect the client to pass the list of friends? No, server should know.
    // Let's query friends again.

    const { data: myFriends } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${req.user.id},friend_id.eq.${req.user.id}`);

    const friendIds = myFriends.map(f => f.user_id === req.user.id ? f.friend_id : f.user_id);

    const { data: friendUsers } = await supabase
      .from('users')
      .select('id, access_token')
      .in('id', friendIds);

    const availabilityMap = {}; // id -> 'available' | 'busy'

    // Check Calendar for each friend
    await Promise.all(friendUsers.map(async (u) => {
      availabilityMap[u.id] = 'available'; // Default

      if (u.access_token) {
        try {
          const oauth2Client = new google.auth.OAuth2();
          oauth2Client.setCredentials({ access_token: u.access_token });
          const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

          const freeBusy = await calendar.freebusy.query({
            resource: {
              timeMin: startTime.toISOString(),
              timeMax: endTime.toISOString(),
              items: [{ id: 'primary' }]
            }
          });

          const busySlots = freeBusy.data.calendars['primary'].busy;
          if (busySlots && busySlots.length > 0) {
            availabilityMap[u.id] = 'busy';
          }
        } catch (e) {
          // Token expired or error, assume available or unknown
          // console.error(`Failed to check cal for ${u.id}`, e.message);
        }
      }
    }));

    res.json(availabilityMap);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// [NEW] Update Custom Quest
app.put('/api/quests/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { id } = req.params;
  const { name, description, latitude, longitude, points, time, inviteFriendIds } = req.body;

  try {
    // Check ownership
    const { data: quest, error: findError } = await supabase
      .from('custom_quests')
      .select('creator_id')
      .eq('id', id)
      .single();

    if (findError || !quest) return res.status(404).json({ error: 'Quest not found' });
    if (quest.creator_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    // Update quest details
    const { error: updateError } = await supabase
      .from('custom_quests')
      .update({
        name,
        description,
        latitude,
        longitude,
        points,
        start_time: time,
        category: req.body.category || 'Other'
      })
      .match({ id: id });

    if (updateError) throw updateError;

    // [NEW] Update invited friends if provided
    if (inviteFriendIds !== undefined) {
      // Delete existing participants
      await supabase
        .from('quest_participants')
        .delete()
        .eq('quest_id', id);

      // Insert new participants
      if (inviteFriendIds.length > 0) {
        const participants = inviteFriendIds.map(fid => ({
          quest_id: id,
          user_id: fid,
          status: 'pending'
        }));

        const { error: inviteError } = await supabase
          .from('quest_participants')
          .insert(participants);

        if (inviteError) console.error("Error updating invited friends", inviteError);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update quest' });
  }
});

// [NEW] Delete Custom Quest
app.delete('/api/quests/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { id } = req.params;

  try {
    // Check ownership
    const { data: quest, error: findError } = await supabase
      .from('custom_quests')
      .select('creator_id')
      .eq('id', id)
      .single();

    if (findError || !quest) return res.status(404).json({ error: 'Quest not found' });
    if (quest.creator_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    // Delete participants first (though cascade might handle it, let's be safe)
    await supabase.from('quest_participants').delete().match({ quest_id: id });

    // Delete quest
    const { error: deleteError } = await supabase
      .from('custom_quests')
      .delete()
      .match({ id: id });

    if (deleteError) throw deleteError;

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete quest' });
  }
});


// [NEW] Block User
app.post('/api/blocks/add', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { blockedUserId } = req.body;

  if (!blockedUserId) return res.status(400).json({ error: 'User ID required' });
  if (blockedUserId === req.user.id) return res.status(400).json({ error: 'Cannot block yourself' });

  try {
    const { error } = await supabase
      .from('blocks')
      .insert({
        user_id: req.user.id,
        blocked_user_id: blockedUserId
      });

    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'Already blocked' });
      throw error;
    }

    // Remove existing friendship if any (both directions)
    await supabase.from('friendships').delete().match({ user_id: req.user.id, friend_id: blockedUserId });
    await supabase.from('friendships').delete().match({ user_id: blockedUserId, friend_id: req.user.id });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// [NEW] Get Blocked Users
app.get('/api/blocks', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data, error } = await supabase
      .from('blocks')
      .select('blocked_user_id')
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json(data.map(b => b.blocked_user_id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch blocks' });
  }
});

// --- COUPON REDEMPTION & TRANSACTION HISTORY ---

// Redeem a coupon (deduct points, generate code, record transaction)
app.post('/api/redeem', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { couponId, couponName, cost, store } = req.body;

  if (!couponId || !cost || cost <= 0) {
    return res.status(400).json({ error: 'Invalid coupon data' });
  }

  try {
    // 1. Get current balance
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', req.user.id)
      .single();

    if (fetchError) throw fetchError;
    if (!user || (user.balance || 0) < cost) {
      return res.status(400).json({ error: 'Insufficient Tartan Points' });
    }

    const newBalance = user.balance - cost;

    // 2. Generate a coupon code
    const couponCode = `CMU-${couponId.toUpperCase()}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    // 3. Deduct balance
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', req.user.id);

    if (updateError) throw updateError;

    // 4. Record transaction in transactions table
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: req.user.id,
        type: 'redemption',
        amount: cost,
        description: couponName,
        coupon_id: couponId,
        coupon_code: couponCode,
        store: store || null
      })
      .select()
      .single();

    if (txError) {
      console.error('Failed to record transaction:', txError);
      // Don't fail the whole thing, the points were already deducted
    } else {
      console.log('Transaction recorded:', txData);
    }

    res.json({ success: true, couponCode, newBalance });

  } catch (err) {
    console.error('Redemption failed:', err);
    res.status(500).json({ error: 'Failed to redeem coupon' });
  }
});

// --- MOSAIC LIBRARY ROUTES ---

// Collect a completed mosaic
app.post('/api/mosaics/collect', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { type, metadata } = req.body;

  try {
    const { data, error } = await supabase
      .from('user_mosaics')
      .insert({
        user_id: req.user.id,
        type: type || 'daily',
        metadata: metadata || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, mosaic: data });
  } catch (err) {
    console.error('Failed to collect mosaic:', err);
    res.status(500).json({ error: 'Failed to collect mosaic' });
  }
});

// Get user's mosaic collection
app.get('/api/mosaics', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data, error } = await supabase
      .from('user_mosaics')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Failed to fetch mosaics:', err);
    res.status(500).json({ error: 'Failed to fetch mosaics' });
  }
});

// Get transaction history for the logged-in user
app.get('/api/transactions', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Failed to fetch transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// --- SOCKET.IO ---

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Send existing players to the new client
  socket.emit('currentPlayers', players);

  // Initialize new player
  players[socket.id] = {
    id: socket.id,
    latitude: 40.4433, // Default start
    longitude: -79.9442
  };

  // Broadcast new player to others
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].latitude = data.latitude;
      players[socket.id].longitude = data.longitude;
      // Broadcast movement to everyone else
      // Broadcast movement to everyone else
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  // [NEW] Allow client to identify themselves with DB ID & Details
  socket.on('identify', (userInfo) => {
    console.log('[SOCKET] User Identified:', userInfo.userId, userInfo.displayName, socket.id);
    if (players[socket.id]) {
      players[socket.id].userId = userInfo.userId;
      players[socket.id].avatarUrl = userInfo.avatarUrl; // [NEW] Store avatar
      players[socket.id].displayName = userInfo.displayName; // [NEW] Store name
      // Broadcast this update
      io.emit('playerMoved', players[socket.id]);
    }
  });

  // --- CHAT MESSAGING ---
  socket.on('chatMessage', (data) => {
    console.log('[CHAT] Message received from', socket.id, ':', data);
    // data: { text, to, toUserId, toDisplayName }
    // to: 'everyone' or a specific recipientSocketId (we use toUserId to find socket)
    const senderPlayer = players[socket.id];
    const senderName = (senderPlayer && senderPlayer.displayName) || 'Anonymous';
    const senderAvatar = (senderPlayer && senderPlayer.avatarUrl) || '';
    const senderUserId = (senderPlayer && senderPlayer.userId) || socket.id;

    const msg = {
      id: Date.now() + '-' + socket.id,
      text: data.text,
      senderName,
      senderAvatar,
      senderUserId,
      channel: data.to, // 'everyone' or recipientUserId
      timestamp: new Date().toISOString()
    };

    if (data.to === 'everyone') {
      // Broadcast to all connected clients
      io.emit('chatMessageReceived', msg);
    } else {
      // DM: find the socket(s) for the target userId
      const recipientUserId = data.toUserId;
      let sent = false;
      for (const [sid, player] of Object.entries(players)) {
        if (player.userId === recipientUserId) {
          io.to(sid).emit('chatMessageReceived', msg);
          sent = true;
        }
      }
      // Also send back to sender so they see their own DM
      socket.emit('chatMessageReceived', msg);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

// Serve Static Assets (Production)
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV !== 'test') {
  // Treat as prod/hybrid for hackathon convenience
  app.use(express.static(path.join(__dirname, '../client/build')));

  // Catch-all to serve React's index.html
  app.get(/(.*)/, (req, res) => {
    // Did we hit an API route? API routes should be matched above. 
    // If we got here, it's not an API route.
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}



const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`SERVER RUNNING ON PORT ${PORT}`);
});

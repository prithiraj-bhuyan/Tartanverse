import React, { useState, useEffect, useRef, useCallback } from 'react';
import Map, { GeolocateControl, Marker } from 'react-map-gl';
import io from 'socket.io-client';
import { AvatarCreator } from '@readyplayerme/react-avatar-creator';
import axios from 'axios';
import 'mapbox-gl/dist/mapbox-gl.css';
import Wallet from './Wallet';
import QuestList from './QuestList';
import CreateQuestModal from './CreateQuestModal'; // [NEW] Lifted up
import MosaicOverlay from './MosaicOverlay';
import MosaicLibrary from './MosaicLibrary'; // [NEW] // [NEW] Mosaic Progression
import FriendsList from './FriendsList';
import ChatBox from './ChatBox';
import { zones } from './zones';
import { colleges } from './colleges';
import { getDistanceFromLatLonInKm } from './utils';
import { Users, Shirt, LogOut, Grid } from 'lucide-react'; // [FIXED] Added Grid
import EventMarkers from './EventMarkers';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || (window.location.port === '3000' ? `http://${window.location.hostname}:3001` : '');
const socket = io(SERVER_URL);

// ... (existing code) ...

// Mapbox Standard Style handles 3D buildings automatically

// [NEW] Mapbox Token
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

function App() {
  // [NEW] Immersive Login State
  const [loginStep, setLoginStep] = useState('landing'); // 'landing' | 'traveling' | 'arrived'
  const [carouselIndex, setCarouselIndex] = useState(2); // [NEW] Start at index 2 (CMU in middle)
  const [showTartanVerse, setShowTartanVerse] = useState(false); // [NEW] For TartanVerse animation

  // [NEW] Lifted Quest Modal State
  const [showCreateQuest, setShowCreateQuest] = useState(false);
  const [editingQuest, setEditingQuest] = useState(null);
  const [showMosaic, setShowMosaic] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false); // [NEW]

  // [NEW] Collect Mosaic Handler
  const handleCollectMosaic = async () => {
    try {
      await axios.post(`${SERVER_URL}/api/mosaics/collect`, {
        type: 'daily',
        metadata: {
          completedAt: new Date().toISOString()
        }
      }, { withCredentials: true });

      // Success!
      // We do NOT close the overlay immediately; let the user see the "Saved!" message.
      // The user will close it manually when they are done celebrating.
    } catch (err) {
      console.error("Failed to collect mosaic", err);
      throw err; // Propagate to overlay to show error state
    }
  }; // [NEW] Mosaic Overlay Logic

  // Initial Globe View
  const [viewState, setViewState] = useState({
    latitude: 20, // Global view
    longitude: 0,
    zoom: 1.5,
    pitch: 0,
    bearing: 0
  });

  const handleCampusSelect = (campus) => {
    // [NEW] Show TartanVerse animation for CMU
    if (campus === 'CMU') {
      setShowTartanVerse(true);

      // Hide TartanVerse and start traveling after 3 seconds
      setTimeout(() => {
        setShowTartanVerse(false);
        setLoginStep('traveling');

        // [FIXED] Save to localStorage so we don't repeat animation on refresh
        localStorage.setItem('campusSelected', 'true');

        // Fly to CMU
        mapRef.current?.flyTo({
          center: [-79.9442, 40.4433],
          zoom: 16.5,
          pitch: 45,
          bearing: 0,
          duration: 8000, // 8 seconds flight
          essential: true
        });

        // Wait for arrival
        setTimeout(() => {
          setLoginStep('arrived');
        }, 8000);
      }, 3000); // Show TartanVerse for 3 seconds
    }
  };

  // [NEW] Logout Handler
  const handleLogout = async () => {
    try {
      // Call backend logout endpoint
      await axios.get(`${SERVER_URL}/api/logout`, { withCredentials: true });

      // Clear localStorage
      localStorage.removeItem('campusSelected');

      // Disconnect socket
      if (socket.connected) {
        socket.disconnect();
      }

      // Reset all state
      setCurrentUser(null);
      setLoginStep('landing');
      setCarouselIndex(2);
      setShowTartanVerse(false);
      setVisitedZones([]);
      setFriends([]);
      setBlockedUsers([]);
      setCalendarQuests([]);

      // Reload page to reset everything
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed', err);
      // Force reload anyway
      window.location.href = '/';
    }
  };

  const [isCustomizingAvatar, setIsCustomizingAvatar] = useState(false); // [NEW] Avatar Mode

  const handleAvatarExported = async (event) => {
    const url = event.data.url;
    console.log('[Avatar] Exported:', url);
    setIsCustomizingAvatar(false);

    // Optimistically update current user
    const updatedUser = { ...currentUser, avatar_url: url };
    setCurrentUser(updatedUser);

    // Identify to socket with new avatar
    if (socket.connected) {
      socket.emit('identify', {
        userId: updatedUser.id,
        avatarUrl: url,
        displayName: updatedUser.display_name
      });
    }

    // Persist to Backend
    try {
      await axios.post(`${SERVER_URL}/api/user/avatar`, { avatarUrl: url }, { withCredentials: true });
    } catch (e) {
      console.error('Failed to save avatar', e);
    }
  };

  const [userPosition, setUserPosition] = useState(null);
  // const [quests, setQuests] = useState([]); // Deprecated for categories
  const [calendarQuests, setCalendarQuests] = useState([]); // [NEW] Calendar Quests
  const [customQuests, setCustomQuests] = useState([]); // [NEW] Custom Quests
  // const [allQuests, setAllQuests] = useState([]); // [REMOVED] Redundant

  const [visitedZones, setVisitedZones] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [showWallet, setShowWallet] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showFriends, setShowFriends] = useState(false); // [NEW] Toggle friends list
  const [currentUser, setCurrentUser] = useState(null); // [NEW] Store current DB user
  const [friends, setFriends] = useState([]); // [NEW] Store friends list for map coloring
  const [blockedUsers, setBlockedUsers] = useState([]); // [NEW] Blocked User IDs
  const [threatAlert, setThreatAlert] = useState(null); // [NEW] Threat Message
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // [NEW] Loading state for auth check

  // [NEW] Refs and Styles
  const mapRef = useRef();
  const geolocateControlRef = useRef();
  const walletRef = useRef(); // [NEW] Ref to Wallet for refreshing balance
  const [mapStyle, setMapStyle] = useState("mapbox://styles/mapbox/standard");
  // const [gender, setGender] = useState('male'); // [REMOVED]
  const [players, setPlayers] = useState({}); // Other players
  const [isConnected, setIsConnected] = useState(socket.connected);

  // [NEW] Map Click Handler (Placeholder)
  const handleMapClick = (event) => {
    console.log("Map Click:", event.lngLat);
  };

  const fetchFriends = useCallback(async () => {
    try {
      const friendsRes = await axios.get(`${SERVER_URL}/api/friends`, { withCredentials: true });
      setFriends(friendsRes.data);
    } catch (e) {
      console.error("Error fetching friends maps", e);
    }
  }, []);

  const fetchBlocks = useCallback(async () => {
    try {
      const res = await axios.get(`${SERVER_URL}/api/blocks`, { withCredentials: true });
      setBlockedUsers(res.data);
    } catch (e) {
      console.error("Error fetching blocks", e);
    }
  }, []);

  useEffect(() => {
    // Global 401 Interceptor
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 401) {
          console.warn("Session expired. Logging out.");
          setCurrentUser(null);
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);
  const chatRef = useRef(); // Ref to ChatBox for opening DMs from FriendsList

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Get User
        const userRes = await axios.get(`${SERVER_URL}/api/user`, { withCredentials: true });
        if (userRes.data) {
          setCurrentUser(userRes.data);

          // [FIXED] Check if campus has been selected before
          const hasSelectedCampus = localStorage.getItem('campusSelected');
          if (hasSelectedCampus) {
            // Skip animation, go straight to arrived state AND set map to CMU
            setLoginStep('arrived');

            // [NEW] Set map to CMU position immediately without animation
            setViewState({
              longitude: -79.9442,
              latitude: 40.4433,
              zoom: 16.5,
              pitch: 45,
              bearing: 0
            });
          } else {
            // First time - keep on landing to show campus selection
            setLoginStep('landing');
          }

          // [NEW] Auto-launch avatar creator if they don't have a custom one
          const hasCustomAvatar = userRes.data.avatar_url && userRes.data.avatar_url.includes('readyplayer.me');
          if (!hasCustomAvatar) {
            console.log("Login detected. No custom avatar. Launching creator...");
            setIsCustomizingAvatar(true);
          }

          if (socket.connected) {
            socket.emit('identify', {
              userId: userRes.data.id,
              avatarUrl: userRes.data.avatar_url,
              displayName: userRes.data.display_name
            });
          }
        }

        // 2. Get Friends & Blocks
        fetchFriends();
        fetchBlocks();

        // 3. [NEW] Fetch visited zones to prevent re-completion on refresh
        try {
          const visitedRes = await axios.get(`${SERVER_URL}/api/visited-zones`, { withCredentials: true });
          if (visitedRes.data && Array.isArray(visitedRes.data)) {
            setVisitedZones(visitedRes.data);
          }
        } catch (e) {
          console.error("Failed to fetch visited zones", e);
        }

      } catch (err) {
        console.log("Not logged in");
      } finally {
        setIsCheckingAuth(false);
      }
    };
    init();
  }, [fetchFriends, fetchBlocks]);

  // Threat Detection Logic
  useEffect(() => {
    if (!userPosition || blockedUsers.length === 0) return;

    let detected = null;
    Object.values(players).forEach(player => {
      if (player.userId && blockedUsers.includes(player.userId)) {
        const dist = getDistanceFromLatLonInKm(
          userPosition.latitude, userPosition.longitude,
          player.latitude, player.longitude
        );
        if (dist < 0.1) { // 100 meters
          detected = player.displayName || 'Blocked User';
        }
      }
    });

    if (detected) {
      setThreatAlert(`Detected Threat from ${detected}, flee!!!`);
    } else {
      setThreatAlert(null);
    }
  }, [players, userPosition, blockedUsers]);

  useEffect(() => {
    if (currentUser && isConnected) {
      socket.emit('identify', {
        userId: currentUser.id,
        avatarUrl: currentUser.avatar_url,
        displayName: currentUser.display_name
      });
    }
  }, [currentUser, isConnected]);

  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    socket.on('currentPlayers', (serverPlayers) => {
      setPlayers(serverPlayers);
    });

    socket.on('newPlayer', (playerInfo) => {
      setPlayers(prev => ({ ...prev, [playerInfo.id]: playerInfo }));
    });

    socket.on('playerMoved', (playerInfo) => {
      setPlayers(prev => ({
        ...prev,
        [playerInfo.id]: { ...(prev[playerInfo.id] || {}), ...playerInfo }
      }));
    });

    socket.on('playerDisconnected', (playerId) => {
      setPlayers(prev => {
        const newPlayers = { ...prev };
        delete newPlayers[playerId];
        return newPlayers;
      });
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('currentPlayers');
      socket.off('newPlayer');
      socket.off('playerMoved');
      socket.off('playerDisconnected');
    };
  }, []);

  // [NEW] Fetch calendar quests
  // [NEW] Fetch calendar quests - Memoized for use in callbacks
  const fetchQuests = useCallback(async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/api/quests`, { withCredentials: true });
      setCalendarQuests(response.data);
    } catch (err) {
      console.error("Failed to fetch calendar quests", err);
    }
  }, []);

  useEffect(() => {
    fetchQuests();
  }, [fetchQuests]);

  // Combine static zones and calendar quests
  const allQuests = [...zones, ...calendarQuests];

  const handleGeolocate = (evt) => {
    // When we track the user's location, send it to server
    const { longitude, latitude } = evt.coords;

    // Update local state for custom avatar
    setUserPosition({ longitude, latitude });

    socket.emit('move', { longitude, latitude });

    // Check for side quests
    allQuests.forEach(zone => {
      const distance = getDistanceFromLatLonInKm(latitude, longitude, zone.latitude, zone.longitude);
      if (distance < zone.radius && !visitedZones.includes(zone.id)) {
        // Quest Complete!
        completeQuest(zone);
      }
    });
  };

  const completeQuest = async (zone) => {
    // [NEW] Time-based validation for quests with scheduled times
    if (zone.time) {
      const questTime = new Date(zone.time);
      const now = new Date();

      // Define time window: 15 minutes before to 2 hours after quest start
      const windowStart = new Date(questTime.getTime() - 15 * 60 * 1000); // 15 min before
      const windowEnd = new Date(questTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours after

      if (now < windowStart || now > windowEnd) {
        const formattedTime = questTime.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        alert(`⏰ Quest "${zone.name}" can only be completed during its scheduled time!\n\nScheduled: ${formattedTime}\nWindow: 15 min before to 2 hours after`);
        return; // Don't complete quest
      }
    }

    setVisitedZones(prev => [...prev, zone.id]);
    // alert(`QUEST COMPLETE: Visited ${zone.name}! +${zone.reward} Coins`); // [REPLACED] with Mosaic Overlay

    // [NEW] Optimistic Wallet Update & Show Mosaic
    const reward = zone.reward;
    setWalletBalance(prev => {
      const newBalance = prev + reward;
      return newBalance;
    });
    setShowMosaic(true);

    if (currentUser && currentUser.id) {
      try {
        await axios.post(`${SERVER_URL}/api/quest-complete`, {
          userId: currentUser.id, // [FIXED] Use currentUser.id instead of socket.id
          zoneId: zone.id,
          reward: zone.reward
        }, { withCredentials: true });
        // Refresh wallet balance after successful quest completion
        if (walletRef.current) walletRef.current.refreshBalance();
        fetchQuests();
      } catch (err) {
        console.error("Failed to complete quest", err);
      }
    }
  };

  if (isCheckingAuth) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#f0f0f0',
        color: '#333',
        fontWeight: 'bold'
      }}>
        Loading World...
      </div>
    );
  }

  const showLanding = !currentUser && loginStep === 'landing';
  const showLogin = !currentUser && loginStep === 'arrived';

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>

      {/* Avatar Creator Overlay */}
      {isCustomizingAvatar && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          zIndex: 3000,
          backgroundColor: 'black'
        }}>
          <AvatarCreator
            subdomain="demo"
            config={{
              clearCache: true,
              bodyType: 'fullbody',
              quickStart: false,
              rateLimit: 3
            }}
            style={{ width: '100%', height: '100%', border: 'none' }}
            onAvatarExported={handleAvatarExported}
          />
          <button
            onClick={() => setIsCustomizingAvatar(false)}
            style={{
              position: 'absolute',
              bottom: '30px', // [FIXED] Moved to bottom to avoid overlap
              left: '30px',   // [FIXED] Moved to left
              padding: '12px 24px',
              backgroundColor: '#FF6B6B',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '16px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              zIndex: 10000 // [FIXED] Ensure it's above everything
            }}
          >
            ⏭️ Skip & Start Game
          </button>
        </div>
      )}

      {/* TartanVerse Animation Overlay */}
      {showTartanVerse && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.95)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 4000,
          backdropFilter: 'blur(20px)'
        }}>
          <h1 className="tartanverse-title">
            TartanVerse
          </h1>
        </div>
      )}

      {/* 1. Landing Page (Select Campus) - College Carousel */}
      {showLanding && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 3000,
          backdropFilter: 'blur(10px)',
          fontFamily: "'Inter', system-ui, sans-serif"
        }}>
          {/* Removed MOSAIC title as requested */}
          <p style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: '28px',
            marginBottom: '80px',
            fontWeight: '400',
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}>
            Select Your University
          </p>

          {/* College Carousel */}
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '1400px',
            height: '450px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible'
          }}>
            {/* Left Arrow */}
            <button
              onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 1))}
              disabled={carouselIndex === 0}
              style={{
                position: 'absolute',
                left: '20px',
                zIndex: 10,
                background: 'rgba(255,255,255,0.1)',
                border: '2px solid rgba(255,255,255,0.3)',
                borderRadius: '50%',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: carouselIndex === 0 ? 'not-allowed' : 'pointer',
                fontSize: '24px',
                color: 'white',
                opacity: carouselIndex === 0 ? 0.3 : 1,
                transition: 'all 0.3s',
                backdropFilter: 'blur(10px)'
              }}
            >
              ◀
            </button>

            {/* Carousel Container */}
            <div style={{
              display: 'flex',
              gap: '30px',
              transform: `translateX(calc(50% - ${carouselIndex * 330 + 150}px))`, // Center the active card
              transition: 'transform 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)'
            }}>
              {colleges.map((college, index) => (
                <div
                  key={college.id}
                  onClick={() => college.enabled && handleCampusSelect(college.name)}
                  style={{
                    minWidth: '300px',
                    height: '400px',
                    backgroundColor: college.enabled ? college.color : 'rgba(30, 30, 30, 0.6)',
                    borderRadius: '24px',
                    padding: '30px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: college.enabled ? 'pointer' : 'not-allowed',
                    transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                    boxShadow: college.enabled ? `0 15px 35px ${college.color.replace('0.9', '0.4')}` : '0 10px 20px rgba(0,0,0,0.3)',
                    border: `1px solid rgba(255,255,255,${college.enabled ? '0.2' : '0.1'})`,
                    position: 'relative',
                    overflow: 'hidden',
                    opacity: index === carouselIndex ? 1 : 0.5,
                    transform: index === carouselIndex ? 'scale(1.1)' : 'scale(0.9)'
                  }}
                  onMouseOver={e => {
                    if (college.enabled) {
                      e.currentTarget.style.transform = 'translateY(-10px) scale(1.15)';
                      e.currentTarget.style.boxShadow = `0 25px 50px ${college.color.replace('0.9', '0.6')}`;
                    }
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.transform = index === carouselIndex ? 'scale(1.1)' : 'scale(0.9)';
                    e.currentTarget.style.boxShadow = college.enabled ? `0 15px 35px ${college.color.replace('0.9', '0.4')}` : '0 10px 20px rgba(0,0,0,0.3)';
                  }}
                >
                  <div style={{
                    width: '120px', height: '120px',
                    background: college.enabled ? 'white' : 'rgba(255,255,255,0.1)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '60px',
                    boxShadow: college.enabled ? '0 10px 20px rgba(0,0,0,0.2)' : 'inset 0 0 20px rgba(0,0,0,0.2)',
                    filter: college.enabled ? 'none' : 'grayscale(100%)'
                  }}>
                    {college.emoji}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <h2 style={{ color: 'white', fontSize: '32px', margin: '0 0 10px 0', fontWeight: '800' }}>{college.name}</h2>
                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', margin: 0 }}>{college.location}</p>
                  </div>
                  <div style={{
                    padding: '10px 20px',
                    background: college.enabled ? 'rgba(0,0,0,0.2)' : 'transparent',
                    border: college.enabled ? 'none' : '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '50px',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {college.enabled ? (
                      <>
                        <span style={{ width: '8px', height: '8px', background: '#4CAF50', borderRadius: '50%', display: 'inline-block' }}></span>
                        {college.status}
                      </>
                    ) : (
                      <>🔒 {college.status}</>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Right Arrow */}
            <button
              onClick={() => setCarouselIndex(Math.min(colleges.length - 1, carouselIndex + 1))}
              disabled={carouselIndex === colleges.length - 1}
              style={{
                position: 'absolute',
                right: '20px',
                zIndex: 10,
                background: 'rgba(255,255,255,0.1)',
                border: '2px solid rgba(255,255,255,0.3)',
                borderRadius: '50%',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: carouselIndex === colleges.length - 1 ? 'not-allowed' : 'pointer',
                fontSize: '24px',
                color: 'white',
                opacity: carouselIndex === colleges.length - 1 ? 0.3 : 1,
                transition: 'all 0.3s',
                backdropFilter: 'blur(10px)'
              }}
            >
              ▶
            </button>
          </div>

          {/* Carousel Indicators */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '40px' }}>
            {colleges.map((_, index) => (
              <div
                key={index}
                onClick={() => setCarouselIndex(index)}
                style={{
                  width: index === carouselIndex ? '40px' : '12px',
                  height: '12px',
                  borderRadius: '6px',
                  background: index === carouselIndex ? 'white' : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 3. Login Overlay (Arrived) */}
      {showLogin && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '300px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '40px',
          borderRadius: '20px',
          zIndex: 2000,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <h1 style={{
            fontSize: '48px',
            marginBottom: '10px',
            background: 'linear-gradient(45deg, #C41230, #FFD700)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: '0 0 20px 0'
          }}>
            Welcome
          </h1>
          <p style={{ marginBottom: '30px', fontSize: '16px', color: '#666' }}>
            Login with your CMU ID
          </p>

          <button
            onClick={() => window.location.href = `${SERVER_URL}/auth/google`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '15px',
              backgroundColor: '#C41230', // CMU Red
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              fontWeight: 'bold',
              fontSize: '18px',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 15px rgba(196, 18, 48, 0.4)'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(196, 18, 48, 0.6)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(196, 18, 48, 0.4)';
            }}
          >
            <span style={{ marginRight: '10px', fontSize: '24px' }}>🎓</span>
            Login
          </button>
        </div>
      )}

      {/* THREAT ALERT */}
      {threatAlert && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#FF0000',
          color: 'white',
          padding: '30px',
          borderRadius: '20px',
          zIndex: 9999,
          textAlign: 'center',
          boxShadow: '0 0 50px rgba(255, 0, 0, 0.8)',
          animation: 'pulse 1s infinite'
        }}>
          <style>
            {`@keyframes pulse { 0% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.1); } 100% { transform: translate(-50%, -50%) scale(1); } }`}
          </style>
          <div style={{ fontSize: '60px', marginBottom: '10px' }}>⚠️</div>
          <h1 style={{ margin: 0, textTransform: 'uppercase', fontSize: '24px' }}>{threatAlert}</h1>
        </div>
      )}

      <Map
        ref={mapRef}
        {...viewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        mapboxAccessToken={MAPBOX_TOKEN}
        projection="globe" // [NEW] Enable Globe View
        onMove={evt => setViewState(evt.viewState)}
        onClick={handleMapClick}
        terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }}
        onStyleData={evt => {
          if (evt.target.isStyleLoaded() && evt.target.getStyle().name === 'Mapbox Standard') {
            try {
              evt.target.setConfig('basemap', { lightPreset: 'dusk' });
            } catch (e) {
              console.log("Config not ready yet");
            }
          }
        }}
      >
        <GeolocateControl
          ref={geolocateControlRef}
          position="top-left"
          trackUserLocation={true}
          showUserLocation={true}
          auto={false} // [CHANGED] Disable auto-zoom on load/update to prevent double zoom
          onGeolocate={handleGeolocate}
          fitBoundsOptions={{ maxZoom: 16.5 }} // [CHANGED] Limit zoom if it does happen
        />
        {/* <NavigationControl position="top-left" /> [REMOVED] Per user request */}

        {/* Pass socket.id since we use it as userId on server */}
        {socket.id && (
          <Wallet
            ref={walletRef}
            userId={socket.id}
            balance={walletBalance}
            onBalanceChange={setWalletBalance}
          />
        )}

        {/* [REMOVED] Link Calendar Button - Calendar syncs automatically on Google login */}






        {/* Right Side Action Buttons */}
        <div style={{
          position: 'absolute',
          top: '120px',
          right: '25px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px', // Spacing between buttons
          zIndex: 1000,
          perspective: '1000px'
        }}>
          {/* Friends Button */}
          <button
            onClick={() => setShowFriends(true)}
            style={{
              padding: '12px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              color: '#333',
              border: '1px solid rgba(255, 255, 255, 1)',
              borderRadius: '24px',
              fontWeight: '700',
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: "'Inter', sans-serif",
              minWidth: '160px'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 15px 40px rgba(156, 39, 176, 0.2)';
              e.currentTarget.style.color = '#9C27B0';
              // e.currentTarget.style.backgroundColor = 'white';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
              e.currentTarget.style.color = '#333';
              // e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#F3E5F5', borderRadius: '50%', width: '32px', height: '32px',
              color: '#9C27B0'
            }}>
              <Users size={18} strokeWidth={2.5} />
            </div>
            <span>Friends</span>
          </button>

          {/* Customize Button */}
          <button
            onClick={() => setIsCustomizingAvatar(true)}
            style={{
              padding: '12px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              color: '#333',
              border: '1px solid rgba(255, 255, 255, 1)',
              borderRadius: '24px',
              fontWeight: '700',
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: "'Inter', sans-serif",
              minWidth: '160px'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 15px 40px rgba(255, 152, 0, 0.2)';
              e.currentTarget.style.color = '#FF9800';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
              e.currentTarget.style.color = '#333';
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#FFF3E0', borderRadius: '50%', width: '32px', height: '32px',
              color: '#FF9800'
            }}>
              <Shirt size={18} strokeWidth={2.5} />
            </div>
            <span>Customize</span>
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            style={{
              padding: '12px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              color: '#D32F2F',
              border: '1px solid rgba(255, 255, 255, 1)',
              borderRadius: '24px',
              fontWeight: '700',
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: "'Inter', sans-serif",
              minWidth: '160px'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 15px 40px rgba(244, 67, 54, 0.2)';
              e.currentTarget.style.backgroundColor = '#FFEBEE';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#FFEBEE', borderRadius: '50%', width: '32px', height: '32px',
              color: '#D32F2F'
            }}>
              <LogOut size={18} strokeWidth={2.5} />
            </div>
            <span>Logout</span>
          </button>

          {/* [NEW] Memory Wall / Library Button */}
          <button
            onClick={() => setShowLibrary(true)}
            style={{
              marginTop: '10px',
              padding: '12px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              color: '#333',
              border: '1px solid rgba(255, 255, 255, 1)',
              borderRadius: '24px',
              fontWeight: '700',
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: "'Inter', sans-serif",
              minWidth: '160px'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 15px 40px rgba(103, 58, 183, 0.2)';
              e.currentTarget.style.color = '#673AB7';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
              e.currentTarget.style.color = '#333';
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#EDE7F6', borderRadius: '50%', width: '32px', height: '32px',
              color: '#673AB7'
            }}>
              <Grid size={18} strokeWidth={2.5} />
            </div>
            <span>Memory Wall</span>
          </button>
        </div>

        {/* Quest Journal (Top Left) */}
        {!isCustomizingAvatar && (
          <QuestList
            visitedZones={visitedZones}
            userPosition={userPosition}
            quests={allQuests} // Pass actively fetched quests
            onQuestCreated={fetchQuests} // Refresh quests on create/edit
            onPlanQuest={() => {
              setEditingQuest(null);
              setShowCreateQuest(true);
            }}
            onEditQuest={(quest) => {
              setEditingQuest(quest);
              setShowCreateQuest(true);
            }}
          />
        )}

        {/* [NEW] Create Quest Modal (Lifted to Root) */}
        {showCreateQuest && (
          <CreateQuestModal
            onClose={() => {
              setShowCreateQuest(false);
              setEditingQuest(null);
            }}
            onCreated={() => {
              fetchQuests();
              // setShowCreateQuest(false); // handled by onClose usually, but can double check
            }}
            userPosition={userPosition}
            editingQuest={editingQuest}
          />
        )}
        {/* Friends Modal */}
        {showFriends && <FriendsList
          onClose={() => setShowFriends(false)}
          onUpdate={fetchFriends}
          onOpenChat={(friendId) => {
            setShowFriends(false);
            if (chatRef.current) chatRef.current.openToFriend(friendId);
          }}
          chatRef={chatRef}
        />}





        {/* Custom Avatar for User */}
        {userPosition && (
          <Marker
            longitude={userPosition.longitude}
            latitude={userPosition.latitude}
            anchor="bottom"
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer'
            }}>
              {/* Profile Photo Avatar */}
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                border: '3px solid white',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                overflow: 'hidden',
                backgroundColor: 'white',
                position: 'relative',
                animation: 'bounce 2s infinite ease-in-out'
              }}>
                <img
                  src={(currentUser?.avatar_url && !currentUser.avatar_url.includes('dicebear'))
                    ? (currentUser.avatar_url.includes('.glb') ? currentUser.avatar_url.replace('.glb', '.png') : currentUser.avatar_url)
                    : 'https://cdn-icons-png.flaticon.com/512/847/847969.png'}
                  alt="Me"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://cdn-icons-png.flaticon.com/512/847/847969.png'; }}
                />
              </div>

              {/* Name Tag */}
              <div style={{
                marginTop: '5px',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {currentUser?.display_name || 'Me'}
              </div>

              <style>
                {`@keyframes bounce { 
                      0%, 100% { transform: translateY(0); } 
                      50% { transform: translateY(-5px); } 
                  }`}
              </style>
            </div>
          </Marker>
        )}

        {/* Campus Events */}
        <EventMarkers />
        {allQuests.map(zone => (
          <Marker
            key={zone.id}
            longitude={zone.longitude}
            latitude={zone.latitude}
            anchor="bottom" // Changed to bottom so it floats above the point
          >
            {/* Logic for styling based on type */}
            {(() => {
              const isVisited = visitedZones.includes(zone.id);
              const isCalendar = zone.source === 'calendar';

              // Colors
              const color = isVisited ? '#4CAF50' : (isCalendar ? '#4285F4' : '#FFD700');
              const pulseColor = isVisited ? 'transparent' : (isCalendar ? 'rgba(66, 133, 244, 0.6)' : 'rgba(255, 215, 0, 0.6)');

              // Icon
              const icon = isVisited ? '✅' : (isCalendar ? '📘' : '⭐');

              return (
                <div className="marker-container" style={{ width: 'auto', height: 'auto' }}>
                  {/* Pulse Ring - Only for active quests */}
                  {!isVisited && (
                    <div className="marker-pulse" style={{ backgroundColor: pulseColor }} />
                  )}

                  {/* Main Icon Circle */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: '3px solid white',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    zIndex: 2,
                    position: 'relative'
                  }}>
                    {icon}
                  </div>

                  {/* Label (Floating below) */}
                  <div style={{
                    position: 'absolute',
                    top: '48px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                    color: '#333',
                    zIndex: 1,
                    pointerEvents: 'none' // Click through to marker
                  }}>
                    {zone.name}
                  </div>
                </div>
              );
            })()}
          </Marker>
        ))}

        {Object.keys(players).map((playerId) => {
          const player = players[playerId];
          // Filter out our own player if we are rendering it via custom avatar (although socket logic might duplicate it)
          // Also check against currentUser.id if we identified
          if (playerId === socket.id) return null;
          if (currentUser && player.userId === currentUser.id) return null;

          const isFriend = friends.some(f => f.id === player.userId);
          const isBestFriend = friends.some(f => f.id === player.userId && f.is_best_friend);

          return (
            <Marker
              key={playerId}
              longitude={player.longitude}
              latitude={player.latitude}
              anchor="bottom"
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (isFriend && chatRef.current) {
                    chatRef.current.openToFriend(player.userId);
                  } else {
                    // Optional: Show profile or add friend modal?
                    // For now, let's just log or maybe select them?
                    console.log("Clicked player:", player);
                  }
                }}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
              >
                {/* Avatar Image */}
                {player.avatarUrl ? (
                  <img
                    src={player.avatarUrl.includes('.glb')
                      ? player.avatarUrl.replace('.glb', '.png')
                      : player.avatarUrl}
                    alt={player.displayName}
                    style={{
                      width: isBestFriend ? '40px' : '30px',
                      height: isBestFriend ? '40px' : '30px',
                      borderRadius: '50%',
                      border: isBestFriend ? '3px solid #FF4081' : (isFriend ? '3px solid #4CAF50' : '2px solid white'),
                      boxShadow: isBestFriend ? '0 0 15px #FF4081' : '0 2px 5px rgba(0,0,0,0.3)',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <div style={{
                    backgroundColor: isBestFriend ? '#FF4081' : (isFriend ? '#4CAF50' : 'red'),
                    width: isBestFriend ? '20px' : '15px',
                    height: isBestFriend ? '20px' : '15px',
                    borderRadius: '50%',
                    border: '2px solid white',
                    boxShadow: isBestFriend ? '0 0 10px #FF4081' : 'none'
                  }}></div>
                )}
                {/* Optional Name Tag for Friends */}
                {isFriend && (
                  <div style={{
                    position: 'absolute',
                    top: '-25px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>{player.displayName?.split(' ')[0] || 'Friend'}</span>
                    <span style={{ fontSize: '10px' }}>💬</span>
                  </div>
                )}
              </div>
            </Marker>
          );
        })}
      </Map>

      {/* Chat Box - outside Map so events aren't captured */}
      <ChatBox ref={chatRef} socket={socket} currentUser={currentUser} friends={friends} />

      {/* Connection Status Indicator - below chat icon */}
      <div style={{
        position: 'absolute',
        bottom: '18px',
        right: '52px',
        padding: '4px 10px',
        background: 'rgba(255, 255, 255, 0.85)',
        borderRadius: '12px',
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        fontWeight: 'bold',
        color: '#333',
        zIndex: 2000
      }}>
        <div style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: isConnected ? '#4CAF50' : '#F44336',
          marginRight: '5px'
        }}></div>
        {isConnected ? 'LIVE' : 'OFFLINE'}
      </div>

      {/* Pitch (Z-Axis) Slider */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '20px',
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <label style={{
          fontSize: '12px',
          fontWeight: 'bold',
          marginBottom: '5px',
          color: '#333'
        }}>
          Camera Tilt (Z-Axis)
        </label>
        <input
          type="range"
          min="0"
          max="85"
          value={viewState.pitch}
          onChange={(e) => setViewState(prev => ({ ...prev, pitch: Number(e.target.value) }))}
          style={{ width: '150px' }}
        />
      </div>

      {/* Custom Quest Modal (Lifted to Root) */}
      {showCreateQuest && (
        <CreateQuestModal
          userPosition={userPosition} // Will default to current location if null
          onClose={() => {
            setShowCreateQuest(false);
            setEditingQuest(null);
          }}
          onCreated={() => {
            fetchQuests(); // Refresh list
            // Optionally auto-open journal or show success
          }}
          editingQuest={editingQuest}
        />
      )}

      {/* Mosaic/Quest Completion Overlay */}
      <MosaicOverlay
        visible={showMosaic}
        points={walletBalance}
        onClose={() => setShowMosaic(false)}
        onCollect={handleCollectMosaic}
      />

      {/* [NEW] Mosaic Library / Memory Wall */}
      <MosaicLibrary
        visible={showLibrary}
        onClose={() => setShowLibrary(false)}
      />
    </div>
  );
}

export default App;

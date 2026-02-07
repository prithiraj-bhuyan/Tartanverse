import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || (window.location.port === '3000' ? `http://${window.location.hostname}:3001` : '');

function FriendsList({ onClose, onUpdate, onOpenChat, chatRef }) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]); // [NEW] Incoming requests
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchFriends();
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${SERVER_URL}/api/friends/requests`, { withCredentials: true });
      setRequests(res.data);
    } catch (e) {
      console.error("Failed to fetch requests", e);
    }
  };

  const fetchFriends = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/api/friends`, { withCredentials: true });
      setFriends(response.data);
    } catch (err) {
      console.error("Failed to fetch friends", err);
    }
  };

  // Search users when query changes
  useEffect(() => {
    if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
    }
    const timer = setTimeout(async () => {
        try {
            const res = await axios.get(`${SERVER_URL}/api/users/search?query=${searchQuery}`, { withCredentials: true });
            setSearchResults(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error(e);
        }
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddFriend = async (friendId) => {
    try {
      await axios.post(`${SERVER_URL}/api/friends/add`, { friendId }, { withCredentials: true });
      setMessage('Request Sent!'); 
      setSearchQuery('');
      setSearchResults([]);
      fetchFriends(); 
      if (onUpdate) onUpdate();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to add friend');
    }
  };

  const handleBlock = async (userId) => {
    if (!window.confirm("Are you sure you want to block this user? Needs restart to apply fully.")) return;
    try {
        await axios.post(`${SERVER_URL}/api/blocks/add`, { blockedUserId: userId }, { withCredentials: true });
        setMessage('User Blocked!');
        setSearchQuery('');
        setSearchResults([]);
        fetchFriends(); // They will be removed from friends list if there
        if (onUpdate) onUpdate();
    } catch (err) {
        setMessage(err.response?.data?.error || 'Failed to block');
    }
  };

  const handleAccept = async (requesterId) => {
    try {
      await axios.post(`${SERVER_URL}/api/friends/accept`, { requesterId }, { withCredentials: true });
      fetchRequests(); // Remove from list
      fetchFriends(); // Add to friends
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (requesterId) => {
    try {
      await axios.post(`${SERVER_URL}/api/friends/reject`, { requesterId }, { withCredentials: true });
      fetchRequests();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleBestFriend = async (friendId) => {
    try {
      await axios.post(`${SERVER_URL}/api/friends/toggle-best`, { friendId }, { withCredentials: true });
      fetchFriends();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '300px',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      padding: '20px',
      zIndex: 2000
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>Friends</h3>
        <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
      </div>



      {/* Incoming Requests Section */ }
      {requests.length > 0 && (
        <div style={{ marginBottom: '15px', padding: '10px', background: '#e3f2fd', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#1976D2' }}>Friend Requests ({requests.length})</h4>
          {requests.map(req => (
            <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
               <div style={{ display: 'flex', alignItems: 'center' }}>
                  <img src={req.avatar_url || 'https://via.placeholder.com/32'} style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '8px' }} alt="" />
                  <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{req.display_name}</span>
               </div>
               <div>
                 <button onClick={() => handleAccept(req.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', marginRight: '5px' }}>✅</button>
                 <button onClick={() => handleReject(req.id)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>❌</button>
               </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: '15px' }}>
        <input 
          type="text" 
          placeholder="Search by Name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
        />
        
        {/* Search Results */}
        {searchResults.length > 0 && (
            <div style={{ 
                marginTop: '5px', 
                border: '1px solid #eee', 
                borderRadius: '4px', 
                maxHeight: '150px', 
                overflowY: 'auto',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
            }}>
                {searchResults.map(user => (
                    <div key={user.id} style={{ 
                        padding: '8px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #f0f0f0',
                        background: '#fff'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <img src={user.avatar_url} style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '8px' }} alt="" />
                            <span style={{ fontSize: '14px' }}>{user.display_name}</span>
                        </div>
                        <button 
                            onClick={() => handleAddFriend(user.id)}
                            style={{ 
                                padding: '4px 8px', 
                                background: '#2196F3', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '4px', 
                                fontSize: '12px',
                                cursor: 'pointer',
                                marginRight: '5px'
                            }}
                        >
                            Add
                        </button>
                        <button 
                            onClick={() => handleBlock(user.id)}
                            style={{ 
                                padding: '4px 8px', 
                                background: '#F44336', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '4px', 
                                fontSize: '12px',
                                cursor: 'pointer' 
                            }}
                        >
                            Block
                        </button>
                    </div>
                ))}
            </div>
        )}
      </div>

      {message && <div style={{ color: message.includes('Failed') || message.includes('Cannot') ? 'red' : 'green', fontSize: '12px', marginBottom: '10px' }}>{message}</div>}

      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {friends.length === 0 ? <p style={{ color: '#888', fontStyle: 'italic' }}>No friends yet.</p> : (
          friends.map(friend => (
            <div key={friend.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <img 
                src={friend.avatar_url || 'https://via.placeholder.com/40'} 
                alt={friend.display_name}
                style={{ width: '32px', height: '32px', borderRadius: '50%', marginRight: '10px' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{friend.display_name}</div>
                <div style={{ fontSize: '10px', color: '#666' }}>{friend.email}</div>
              </div>
              {/* Chat icon with unread badge */}
              <button 
                onClick={() => { if (onOpenChat) onOpenChat(friend.id); }}
                title="Open chat"
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontSize: '16px',
                  position: 'relative',
                  padding: '4px',
                  marginRight: '4px'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {chatRef?.current?.unreadPerChannel?.[friend.id] > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    background: '#FF4081',
                    color: 'white',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    border: '1.5px solid white'
                  }}>
                    {chatRef.current.unreadPerChannel[friend.id] > 9 ? '9+' : chatRef.current.unreadPerChannel[friend.id]}
                  </span>
                )}
              </button>
              {/* Best friend heart icon */}
              <button 
                onClick={() => toggleBestFriend(friend.id)}
                title="Toggle Best Friend (Share Quests)"
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontSize: '18px',
                  opacity: friend.is_best_friend ? 1 : 0.3,
                  filter: friend.is_best_friend ? 'none' : 'grayscale(100%)',
                  padding: '4px'
                }}
              >
                ❤️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default React.memo(FriendsList);

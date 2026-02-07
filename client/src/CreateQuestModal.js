import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, MapPin, Calendar, Clock, Search, Users, Trophy, Tag, Trash2 } from 'lucide-react';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || (window.location.port === '3000' ? `http://${window.location.hostname}:3001` : '');

function CreateQuestModal({ onClose, onCreated, userPosition, editingQuest }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    // Points removed from state, defaulted to 100 in submit
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [category, setCategory] = useState('Other');

    // Location Search
    const [locationQuery, setLocationQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(null); // { lat, lon, name }

    const [friends, setFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [friendSearch, setFriendSearch] = useState('');
    const [availability, setAvailability] = useState({});
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // If editing, pre-fill
        if (editingQuest) {
            setName(editingQuest.name);
            setDescription(editingQuest.description || '');
            // Points ignored for edit UI, but preserved in backend if we don't send it? 
            // Actually, we'll just send 100 or keep existing.
            setCategory(editingQuest.category || 'Other');
            if (editingQuest.time) {
                const d = new Date(editingQuest.time);
                setDate(d.toISOString().split('T')[0]);
                setTime(d.toTimeString().split(' ')[0].substring(0, 5));
            }
            // Set initial selected location for UI feedback
            setSelectedLocation({
                latitude: editingQuest.latitude,
                longitude: editingQuest.longitude,
                place_name: 'Existing Location'
            });

            // Pre-fill invited friends
            if (editingQuest.invitedFriends && editingQuest.invitedFriends.length > 0) {
                setSelectedFriends(editingQuest.invitedFriends);
            }
        } else if (userPosition && !selectedLocation) {
            // Default to current location
            setSelectedLocation({
                latitude: userPosition.latitude,
                longitude: userPosition.longitude,
                place_name: 'Current Location'
            });
        }

        // Fetch friends for the invite list
        const fetchFriends = async () => {
            try {
                const res = await axios.get(`${SERVER_URL}/api/friends`, { withCredentials: true });
                setFriends(res.data);
            } catch (e) {
                console.error(e);
            }
        };
        fetchFriends();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingQuest, userPosition]);

    // Check Availability when Date/Time changes
    useEffect(() => {
        if (date && time) {
            const check = async () => {
                setCheckingAvailability(true);
                try {
                    const startTime = new Date(`${date}T${time}`).toISOString();
                    const res = await axios.post(`${SERVER_URL}/api/friends/availability`, {
                        time: startTime,
                        duration: 1 // Default 1 hour
                    }, { withCredentials: true });
                    setAvailability(res.data || {});
                } catch (e) {
                    console.error("Failed to check availability", e);
                } finally {
                    setCheckingAvailability(false);
                }
            };
            const timeoutId = setTimeout(check, 500); // Debounce
            return () => clearTimeout(timeoutId);
        }
    }, [date, time]);

    const toggleFriend = (id) => {
        if (selectedFriends.includes(id)) {
            setSelectedFriends(selectedFriends.filter(fid => fid !== id));
        } else {
            setSelectedFriends([...selectedFriends, id]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name) return setError("Name is required");

        // Combine Date & Time
        let startTime = null;
        if (date && time) {
            startTime = new Date(`${date}T${time}`).toISOString();
        }

        // Use selected location or fallback (though selectedLocation should always be set by now)
        const lat = selectedLocation ? selectedLocation.latitude : (userPosition ? userPosition.latitude : null);
        const lon = selectedLocation ? selectedLocation.longitude : (userPosition ? userPosition.longitude : null);

        if (!lat || !lon) return setError("Location required");

        const payload = {
            name,
            description,
            points: 100, // Fixed default
            time: startTime,
            latitude: lat,
            longitude: lon,
            category,
            inviteFriendIds: selectedFriends
        };

        try {
            if (editingQuest) {
                await axios.put(`${SERVER_URL}/api/quests/${editingQuest.id}`, payload, { withCredentials: true });
            } else {
                await axios.post(`${SERVER_URL}/api/quests/create`, payload, { withCredentials: true });
            }
            if (onCreated) onCreated();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || "Failed to save quest");
        }
    };


    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this quest?")) return;
        try {
            await axios.delete(`${SERVER_URL}/api/quests/${editingQuest.id}`, { withCredentials: true });
            if (onCreated) onCreated();
            onClose();
        } catch (err) {
            setError("Failed to delete quest");
        }
    };

    const glassInputStyle = {
        width: '100%',
        padding: '14px',
        borderRadius: '16px',
        border: '1px solid rgba(0,0,0,0.05)',
        fontSize: '15px',
        outline: 'none',
        transition: 'all 0.2s',
        backgroundColor: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(5px)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
    };

    const glassFocus = (e) => {
        e.target.style.backgroundColor = 'white';
        e.target.style.borderColor = '#AB47BC';
        e.target.style.boxShadow = '0 0 0 3px rgba(171, 71, 188, 0.15)';
    };

    const glassBlur = (e) => {
        e.target.style.backgroundColor = 'rgba(255,255,255,0.6)';
        e.target.style.borderColor = 'rgba(0,0,0,0.05)';
        e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)';
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(30, 10, 40, 0.4)', // Darker purple hint in dimmer
            backdropFilter: 'blur(8px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 3000,
            padding: '20px',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <style>
                {`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}
                {`@keyframes slideUp { from { transform: translateY(30px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }`}
            </style>

            <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.85)', // Glass container
                backdropFilter: 'blur(20px)',
                borderRadius: '32px',
                border: '1px solid rgba(255, 255, 255, 0.8)',
                width: '100%', maxWidth: '700px', // [CHANGED] Wider
                maxHeight: '90vh', // [CHANGED] Slightly taller
                overflowY: 'auto',
                boxShadow: '0 40px 80px -20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255,255,255,0.5) inset',
                animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                fontFamily: "'Inter', sans-serif"
            }}>

                {/* Header */}
                <div style={{
                    padding: '40px 40px 0 40px', // [CHANGED] More padding
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: '28px'
                }}>
                    <div>
                        <h2 style={{
                            margin: 0,
                            fontSize: '28px',
                            fontWeight: '800',
                            background: 'linear-gradient(135deg, #8E24AA 0%, #4A148C 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: '-0.5px'
                        }}>
                            {editingQuest ? 'Edit Quest' : 'Plan New Quest'}
                        </h2>
                        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#666', fontWeight: '500' }}>
                            Create a memory with your friends
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '50%',
                            width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#555', transition: 'all 0.2s', backdropFilter: 'blur(5px)'
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
                        onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.5)'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {error && (
                    <div style={{
                        margin: '0 32px 20px 32px', padding: '14px',
                        backgroundColor: 'rgba(255, 235, 238, 0.8)', color: '#D32F2F', borderRadius: '16px',
                        border: '1px solid rgba(255, 205, 210, 0.5)',
                        fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600'
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ padding: '0 40px 40px 40px' }}>

                    {/* Quest Name Input */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontWeight: '700', marginBottom: '10px', fontSize: '13px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quest Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Study Session at Butler"
                            style={glassInputStyle}
                            onFocus={glassFocus}
                            onBlur={glassBlur}
                            required
                        />
                    </div>

                    {/* Location Search - Enhanced */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontWeight: '700', marginBottom: '10px', fontSize: '13px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '16px', top: '16px', color: '#9C27B0' }}>
                                <Search size={18} />
                            </div>
                            <input
                                type="text"
                                placeholder="Search places..."
                                value={locationQuery}
                                onChange={async (e) => {
                                    const val = e.target.value;
                                    setLocationQuery(val);
                                    if (val.length > 2) {
                                        const token = process.env.REACT_APP_MAPBOX_TOKEN;
                                        try {
                                            let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(val)}.json?access_token=${token}&limit=5`;
                                            if (userPosition && userPosition.longitude && userPosition.latitude) {
                                                url += `&proximity=${userPosition.longitude},${userPosition.latitude}`;
                                            }
                                            const res = await fetch(url).then(r => r.json());
                                            setSearchResults(res.features || []);
                                        } catch (e) { console.error(e); }
                                    } else {
                                        setSearchResults([]);
                                    }
                                }}
                                style={{ ...glassInputStyle, paddingLeft: '48px' }}
                                onFocus={glassFocus}
                                onBlur={glassBlur}
                            />

                            {/* Search Results Dropdown */}
                            {searchResults.length > 0 && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                                    marginTop: '8px', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '16px',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)', overflow: 'hidden',
                                    backdropFilter: 'blur(10px)'
                                }}>
                                    {searchResults.map(result => (
                                        <div key={result.id}
                                            onClick={() => {
                                                setSelectedLocation({
                                                    latitude: result.center[1],
                                                    longitude: result.center[0],
                                                    place_name: result.place_name
                                                });
                                                setSearchResults([]);
                                                setLocationQuery('');
                                            }}
                                            style={{
                                                padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.03)', cursor: 'pointer', fontSize: '14px',
                                                display: 'flex', alignItems: 'center', gap: '10px', color: '#333'
                                            }}
                                            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(156, 39, 176, 0.05)'}
                                            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <MapPin size={16} color="#9C27B0" />
                                            <span>{result.place_name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#666', background: 'rgba(255,255,255,0.5)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
                            <MapPin size={14} color="#9C27B0" />
                            Selected: <strong style={{ color: '#9C27B0' }}>{selectedLocation ? selectedLocation.place_name : (userPosition ? 'Current Location' : 'None')}</strong>
                        </div>
                    </div>

                    {/* Category (Points Removed) */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontWeight: '700', marginBottom: '10px', fontSize: '13px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category</label>
                        <div style={{ position: 'relative' }}>
                            <Tag size={16} style={{ position: 'absolute', left: '16px', top: '16px', color: '#9C27B0' }} />
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                style={{ ...glassInputStyle, paddingLeft: '44px', appearance: 'none', cursor: 'pointer' }}
                                onFocus={glassFocus}
                                onBlur={glassBlur}
                            >
                                <option value="Other">Select...</option>
                                <option value="Classes">Classes</option>
                                <option value="Sports">Sports</option>
                                <option value="Food">Food</option>
                                <option value="Coffee">Coffee</option>
                                <option value="Social">Social</option>
                                <option value="Study">Study</option>
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontWeight: '700', marginBottom: '10px', fontSize: '13px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            placeholder="What's the plan?"
                            style={{ ...glassInputStyle, resize: 'none' }}
                            onFocus={glassFocus}
                            onBlur={glassBlur}
                        />
                    </div>

                    {/* Date Row */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontWeight: '700', marginBottom: '10px', fontSize: '13px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</label>
                        <div style={{ position: 'relative' }}>
                            <Calendar size={16} style={{ position: 'absolute', left: '16px', top: '16px', color: '#9C27B0' }} />
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                style={{ ...glassInputStyle, paddingLeft: '44px' }}
                                onFocus={glassFocus}
                                onBlur={glassBlur}
                            />
                        </div>
                    </div>

                    {/* Time Row */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontWeight: '700', marginBottom: '10px', fontSize: '13px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Time</label>
                        <div style={{ position: 'relative' }}>
                            <Clock size={16} style={{ position: 'absolute', left: '16px', top: '16px', color: '#9C27B0' }} />
                            <input
                                type="time"
                                value={time}
                                onChange={e => setTime(e.target.value)}
                                style={{ ...glassInputStyle, paddingLeft: '44px' }}
                                onFocus={glassFocus}
                                onBlur={glassBlur}
                            />
                        </div>
                    </div>

                    {/* Invite Friends Section */}
                    <div style={{ marginBottom: '32px' }}>
                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '700', marginBottom: '12px', fontSize: '13px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <span>Invite Friends</span>
                            <span style={{ color: '#9C27B0', backgroundColor: 'rgba(156, 39, 176, 0.1)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>{selectedFriends.length} Selected</span>
                        </label>

                        <div style={{
                            borderRadius: '20px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.4)',
                            border: '1px solid rgba(0,0,0,0.05)'
                        }}>
                            {checkingAvailability && <div style={{ fontSize: '12px', color: '#9C27B0', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}> <Clock size={14} className="spin" /> Checking schedules...</div>}
                            <style>{`@keyframes spin { 100% { -webkit-transform: rotate(360deg); transform:rotate(360deg); } } .spin { animation:spin 1s linear infinite; }`}</style>

                            <input
                                type="text"
                                placeholder="Filter friends..."
                                value={friendSearch}
                                onChange={e => setFriendSearch(e.target.value)}
                                style={{ ...glassInputStyle, marginBottom: '16px', padding: '10px 14px', fontSize: '13px', height: 'auto' }}
                                onFocus={glassFocus}
                                onBlur={glassBlur}
                            />

                            <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                                {friends
                                    .filter(f => f.display_name.toLowerCase().includes(friendSearch.toLowerCase()))
                                    .sort((a, b) => {
                                        const statusA = availability[a.id] || 'unknown';
                                        const statusB = availability[b.id] || 'unknown';
                                        if (friendSearch) return 0;
                                        if (statusA === 'available' && statusB !== 'available') return -1;
                                        if (statusA !== 'available' && statusB === 'available') return 1;
                                        return 0;
                                    })
                                    .map(f => {
                                        const status = availability[f.id];
                                        let statusColor = '#999';
                                        if (status === 'available') { statusColor = 'green'; }
                                        if (status === 'busy') { statusColor = 'red'; }

                                        const isSelected = selectedFriends.includes(f.id);

                                        return (
                                            <div key={f.id} onClick={() => toggleFriend(f.id)}
                                                style={{
                                                    padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                    background: isSelected ? 'white' : 'transparent',
                                                    border: isSelected ? '1px solid rgba(156, 39, 176, 0.2)' : '1px solid transparent',
                                                    borderRadius: '16px',
                                                    marginBottom: '6px',
                                                    transition: 'all 0.2s',
                                                    opacity: (status === 'busy' && !friendSearch) ? 0.6 : 1,
                                                    boxShadow: isSelected ? '0 4px 12px rgba(156, 39, 176, 0.05)' : 'none'
                                                }}
                                                onMouseOver={e => !isSelected && (e.currentTarget.style.background = 'rgba(255,255,255,0.5)')}
                                                onMouseOut={e => !isSelected && (e.currentTarget.style.background = 'transparent')}
                                            >
                                                <img src={f.avatar_url || 'https://via.placeholder.com/30'} style={{ width: '36px', height: '36px', borderRadius: '50%', marginRight: '12px', objectFit: 'cover', border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }} alt="" />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#444' }}>{f.display_name}</div>
                                                    {status && <div style={{ fontSize: '12px', color: status === 'available' ? '#4CAF50' : '#F44336', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontWeight: '600' }}>
                                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'available' ? '#4CAF50' : '#F44336' }} />
                                                        {status === 'available' ? 'Available' : 'Busy'}
                                                    </div>}
                                                </div>
                                                {isSelected && <div style={{ width: '24px', height: '24px', background: '#9C27B0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(156, 39, 176, 0.3)' }}>
                                                    <Users size={12} color="white" />
                                                </div>}
                                            </div>
                                        );
                                    })}
                                {friends.length === 0 && <div style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '30px', fontSize: '14px' }}>No friends yet. Add some first!</div>}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', marginTop: '40px' }}>
                        {editingQuest && (
                            <button type="button" onClick={handleDelete} style={{
                                marginRight: 'auto', padding: '16px 20px', borderRadius: '16px', border: 'none',
                                background: '#FFEBEE', color: '#D32F2F', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px',
                                fontSize: '14px', transition: 'all 0.2s'
                            }}
                                onMouseOver={e => e.currentTarget.style.background = '#FFCDD2'}
                                onMouseOut={e => e.currentTarget.style.background = '#FFEBEE'}
                            >
                                <Trash2 size={18} /> Delete
                            </button>
                        )}

                        <button type="button" onClick={onClose} style={{
                            padding: '16px 32px', borderRadius: '16px', border: 'none',
                            background: 'rgba(255,255,255,0.5)', color: '#555', cursor: 'pointer', fontWeight: '700',
                            fontSize: '15px', transition: 'all 0.2s'
                        }}
                            onMouseOver={e => e.currentTarget.style.background = 'white'}
                            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.5)'}
                        >
                            Cancel
                        </button>

                        <button type="submit" style={{
                            padding: '16px 40px', borderRadius: '16px', border: 'none',
                            background: 'linear-gradient(135deg, #AB47BC 0%, #7B1FA2 100%)',
                            color: 'white', fontWeight: '700', cursor: 'pointer', boxShadow: '0 8px 20px rgba(123, 31, 162, 0.25)',
                            fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', flex: editingQuest ? 'initial' : 1, justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 25px rgba(123, 31, 162, 0.35)'; }}
                            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(123, 31, 162, 0.25)'; }}
                        >
                            {editingQuest ? 'Update Quest' : <span>Create Quest <span style={{ marginLeft: '4px' }}>✨</span></span>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateQuestModal;

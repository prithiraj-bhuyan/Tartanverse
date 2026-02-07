import React, { useState } from 'react';
import axios from 'axios';
import { getDistanceFromLatLonInKm } from './utils';
import { zones as staticZones } from './zones';
import {
  Scroll, X, ChevronDown, ChevronRight, Plus,
  Clock, MapPin, Trophy, Mail, Check, XCircle,
  BookOpen, Coffee, Utensils, Users, Dumbbell, Map as MapIcon, Calendar
} from 'lucide-react';

function QuestList({ visitedZones, userPosition, quests, onQuestCreated, onPlanQuest, onEditQuest }) {
  const [isOpen, setIsOpen] = useState(false);
  // [REMOVED] Local modal state
  const [invitesExpanded, setInvitesExpanded] = useState(true);

  // Use passed quests or fallback to static zones
  const allQuests = quests || staticZones;

  // Filter Invites vs Active
  const invites = allQuests.filter(q => q.inviteStatus === 'pending');
  // Active = Calendar, Static, Created by me, or Accepted Invites
  const activeQuests = allQuests.filter(q => q.inviteStatus !== 'pending');

  const handleRespond = async (questId, status) => {
    try {
      const SERVER_URL = process.env.REACT_APP_SERVER_URL || (window.location.port === '3000' ? `http://${window.location.hostname}:3001` : '');
      await axios.post(`${SERVER_URL}/api/quests/respond`, { questId, status }, { withCredentials: true });
      if (onQuestCreated) onQuestCreated(); // Refresh list
    } catch (e) {
      console.error(e);
    }
  };

  // Calculate distances and sort Active only
  const sortedQuests = activeQuests.map(zone => {
    let distance = null;
    if (userPosition) {
      distance = getDistanceFromLatLonInKm(
        userPosition.latitude,
        userPosition.longitude,
        zone.latitude,
        zone.longitude
      );
    }
    return { ...zone, distance };
  }).sort((a, b) => {
    // completed first, then by distance
    const aVisited = visitedZones.includes(a.id);
    const bVisited = visitedZones.includes(b.id);

    if (aVisited && !bVisited) return 1; // Completed goes to bottom
    if (!aVisited && bVisited) return -1;

    if (a.distance !== null && b.distance !== null) {
      return a.distance - b.distance;
    }
    return 0;
  });

  // Group by Category
  const categories = ['Classes', 'Sports', 'Food', 'Coffee', 'Social', 'Study', 'Other'];

  // Refined Grouping:
  const getCategory = (q) => {
    if (q.category) return q.category;
    if (q.source === 'calendar') return 'Classes'; // Default calendar to classes
    return 'Other';
  };

  const grouped = {};
  categories.forEach(c => grouped[c] = []);

  sortedQuests.forEach(q => {
    const cat = getCategory(q);
    if (grouped[cat]) grouped[cat].push(q);
    else grouped['Other'].push(q);
  });

  const [expandedCats, setExpandedCats] = useState(
    categories.reduce((acc, cat) => ({ ...acc, [cat]: true }), {})
  );

  const toggleCat = (cat) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'Classes': return <BookOpen size={16} color="#4285F4" />;
      case 'Sports': return <Dumbbell size={16} color="#FF5722" />;
      case 'Food': return <Utensils size={16} color="#FFC107" />;
      case 'Coffee': return <Coffee size={16} color="#795548" />;
      case 'Social': return <Users size={16} color="#E91E63" />;
      case 'Study': return <BookOpen size={16} color="#9C27B0" />; // Reusing BookOpen for now
      default: return <MapIcon size={16} color="#607D8B" />;
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: '80px',
      left: '20px',
      zIndex: 1000,
      width: isOpen ? '360px' : '56px', // Slightly wider for better readability
      height: isOpen ? 'auto' : '56px',
      maxHeight: isOpen ? '85vh' : '56px',

      backgroundColor: isOpen ? 'rgba(255, 255, 255, 0.95)' : '#6A1B9A', // White glass when open, Purple when closed
      backdropFilter: isOpen ? 'blur(12px)' : 'none',
      borderRadius: isOpen ? '24px' : '50%',
      boxShadow: isOpen ? '0 15px 40px rgba(0,0,0,0.15)' : '0 8px 20px rgba(106, 27, 154, 0.4)',
      border: isOpen ? '1px solid rgba(255,255,255,0.8)' : 'none',

      padding: isOpen ? '0' : '0', // Padding handled inside content for scroll
      overflow: 'hidden', // Hide scrollbar for container

      transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', sans-serif"
    }}>

      {/* HEADER / TOGGLE BUTTON */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isOpen ? 'space-between' : 'center',
          width: '100%',
          height: isOpen ? '70px' : '100%',
          cursor: 'pointer',
          padding: isOpen ? '0 24px' : '0',
          borderBottom: isOpen ? '1px solid rgba(0,0,0,0.05)' : 'none',
          background: isOpen ? 'rgba(255,255,255,0.5)' : 'transparent',
          flexShrink: 0
        }}
      >
        {isOpen ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                backgroundColor: '#F3E5F5', borderRadius: '12px', padding: '8px', color: '#7B1FA2'
              }}>
                <Scroll size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#1a1a1a', fontSize: '18px', fontWeight: '800' }}>
                  Quest Journal
                </h3>
                <div style={{ fontSize: '12px', color: '#666', fontWeight: '500' }}>
                  {activeQuests.length} Active Quests
                </div>
              </div>
            </div>
            <button
              style={{
                background: '#f5f5f5', border: 'none', borderRadius: '50%',
                width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#666', transition: 'background 0.2s'
              }}
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              onMouseOver={e => e.currentTarget.style.background = '#e0e0e0'}
              onMouseOut={e => e.currentTarget.style.background = '#f5f5f5'}
            >
              <X size={18} />
            </button>
          </>
        ) : (
          <Scroll style={{ color: 'white' }} size={24} />
        )}
      </div>

      {isOpen && (
        <div style={{
          overflowY: 'auto',
          padding: '20px',
          flex: 1,
          // Custom Scrollbar Style
          scrollbarWidth: 'thin',
          scrollbarColor: '#e0e0e0 transparent'
        }}>

          {/* Pending Invites Section */}
          {invites.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div
                onClick={() => setInvitesExpanded(!invitesExpanded)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', backgroundColor: '#FFEBEE', borderRadius: '16px', marginBottom: '10px',
                  cursor: 'pointer', color: '#C62828', border: '1px solid #FFCDD2'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700', fontSize: '14px' }}>
                  <Mail size={18} />
                  <span>Invites ({invites.length})</span>
                </div>
                {invitesExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </div>

              {invitesExpanded && invites.map(quest => (
                <div key={quest.id} style={{
                  marginBottom: '10px', background: 'white', padding: '16px', borderRadius: '16px',
                  border: '1px solid #FFCDD2', boxShadow: '0 2px 8px rgba(244, 67, 54, 0.05)', marginLeft: '10px'
                }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px', color: '#333' }}>{quest.name}</div>
                  <div style={{ fontSize: '13px', color: '#777', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                    <Trophy size={14} color="#FFC107" /> {quest.reward} Points
                    <span style={{ width: 4, height: 4, background: '#ccc', borderRadius: '50%' }} />
                    {quest.category}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleRespond(quest.id, 'accepted')} style={{
                      flex: 1, cursor: 'pointer', background: '#4CAF50', color: 'white', border: 'none',
                      borderRadius: '8px', fontSize: '13px', fontWeight: '600', padding: '8px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px'
                    }}>
                      <Check size={14} /> Accept
                    </button>
                    <button onClick={() => handleRespond(quest.id, 'rejected')} style={{
                      flex: 1, cursor: 'pointer', background: '#ffebee', color: '#D32F2F', border: 'none',
                      borderRadius: '8px', fontSize: '13px', fontWeight: '600', padding: '8px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px'
                    }}>
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Plan New Quest Button */}
          <button
            onClick={() => {
              if (onPlanQuest) onPlanQuest();
            }}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #AB47BC 0%, #7B1FA2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '24px',
              boxShadow: '0 8px 16px rgba(123, 31, 162, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(123, 31, 162, 0.4)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(123, 31, 162, 0.3)';
            }}
          >
            <Plus size={20} strokeWidth={3} />
            Plan New Quest
          </button>

          {/* Category List */}
          <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', textTransform: 'uppercase', color: '#999', letterSpacing: '1px' }}>Your Quests</h4>

          {categories.map(cat => {
            const questsInCat = grouped[cat];
            if (questsInCat.length === 0) return null;

            const isExpanded = expandedCats[cat];

            return (
              <div key={cat} style={{ marginBottom: '16px' }}>
                <div
                  onClick={() => toggleCat(cat)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 4px',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#444', fontWeight: '700', fontSize: '15px' }}>
                    {getCategoryIcon(cat)}
                    {cat}
                    <span style={{ fontSize: '12px', color: '#999', fontWeight: '500', marginLeft: '4px' }}>{questsInCat.length}</span>
                  </div>
                  <div style={{ color: '#ccc' }}>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                    {questsInCat.map(quest => {
                      const isCompleted = visitedZones.includes(quest.id);
                      const isMyCustom = quest.source === 'custom_created';

                      return (
                        <div key={quest.id}
                          onClick={() => {
                            if (isMyCustom && onEditQuest) {
                              onEditQuest(quest);
                            }
                          }}
                          style={{
                            padding: '16px',
                            borderRadius: '16px',
                            backgroundColor: isCompleted ? '#F1F8E9' : 'white',
                            border: isCompleted ? '1px solid #C8E6C9' : '1px solid rgba(0,0,0,0.05)',
                            boxShadow: isCompleted ? 'none' : '0 4px 12px rgba(0,0,0,0.03)',
                            opacity: isCompleted ? 0.7 : 1,
                            cursor: isMyCustom ? 'pointer' : 'default',
                            position: 'relative',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                          }}
                          onMouseOver={e => !isCompleted && !isMyCustom && (e.currentTarget.style.transform = 'translateY(-1px)')}
                          onMouseOut={e => !isCompleted && !isMyCustom && (e.currentTarget.style.transform = 'translateY(0)')}
                        >

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div style={{ fontWeight: '700', fontSize: '15px', color: isCompleted ? '#2E7D32' : '#333', maxWidth: '85%' }}>
                              {quest.name}
                            </div>
                            {isCompleted && <div style={{ backgroundColor: '#4CAF50', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color='white' /></div>}
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#666' }}>
                            {quest.distance !== null && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <MapPin size={12} />
                                {(quest.distance * 1000).toFixed(0)}m
                              </div>
                            )}
                            {quest.reward && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#F57F17' }}>
                                <Trophy size={12} />
                                {quest.reward} Pts
                              </div>
                            )}
                            {quest.time && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#1976D2' }}>
                                <Clock size={12} />
                                {new Date(quest.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>

                          {/* Tags */}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                            {quest.source === 'calendar' && (
                              <div style={{ fontSize: '10px', color: '#1565C0', backgroundColor: '#E3F2FD', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                                Calendar
                              </div>
                            )}
                            {quest.source === 'custom_created' && (
                              <div style={{ fontSize: '10px', color: '#6A1B9A', backgroundColor: '#F3E5F5', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                                Your Quest
                              </div>
                            )}
                            {quest.source === 'custom_invited' && (
                              <div style={{ fontSize: '10px', color: '#C62828', backgroundColor: '#FFEBEE', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                                Invited
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default QuestList;

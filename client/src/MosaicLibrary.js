import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Calendar, Grid, Clock } from 'lucide-react';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || (window.location.port === '3000' ? `http://${window.location.hostname}:3001` : '');

const MosaicLibrary = ({ visible, onClose }) => {
    const [mosaics, setMosaics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMosaic, setSelectedMosaic] = useState(null);

    useEffect(() => {
        if (visible) {
            fetchMosaics();
        }
    }, [visible]);

    const fetchMosaics = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${SERVER_URL}/api/mosaics`, { withCredentials: true });
            setMosaics(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!visible) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(5, 5, 10, 0.95)',
            backdropFilter: 'blur(20px)',
            zIndex: 4500,
            display: 'flex', flexDirection: 'column',
            fontFamily: "'Inter', sans-serif",
            color: 'white',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            {/* Header */}
            <div style={{
                padding: '24px 40px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.02)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 20px rgba(255, 215, 0, 0.3)'
                    }}>
                        <Grid size={24} color="white" />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>Memory Wall</h1>
                        <p style={{ margin: '4px 0 0', opacity: 0.6, fontSize: '14px' }}>Your Collection of Masterpieces</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                        width: '40px', height: '40px', color: 'white', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >
                    <X size={20} />
                </button>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px', opacity: 0.5 }}>
                        Loading your collection...
                    </div>
                ) : mosaics.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: '100px', opacity: 0.6 }}>
                        <div style={{ fontSize: '64px', marginBottom: '20px' }}>🖼️</div>
                        <h3 style={{ fontSize: '24px', marginBottom: '10px' }}>Your Wall is Empty</h3>
                        <p>Complete quests to build your first mosaic masterpiece!</p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '30px'
                    }}>
                        {mosaics.map((mosaic, index) => (
                            <div
                                key={mosaic.id}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: '24px',
                                    padding: '20px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    animation: `slideUp 0.5s ease-out ${index * 0.05}s backwards`
                                }}
                                onMouseOver={e => {
                                    e.currentTarget.style.transform = 'translateY(-5px)';
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.4)';
                                }}
                                onMouseOut={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                {/* Dates */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', opacity: 0.7, fontSize: '13px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Calendar size={14} />
                                        {new Date(mosaic.created_at).toLocaleDateString()}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Clock size={14} />
                                        {new Date(mosaic.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>

                                {/* Mini Mosaic Visual */}
                                <div style={{
                                    height: '240px',
                                    background: 'rgba(0,0,0,0.3)',
                                    borderRadius: '16px',
                                    marginBottom: '20px',
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(2, 1fr)',
                                    gridTemplateRows: 'repeat(2, 1fr)',
                                    gap: '4px',
                                    padding: '8px',
                                    overflow: 'hidden'
                                }}>
                                    {/* Abstract representation of the mosaic */}
                                    <div style={{ background: 'linear-gradient(135deg, #FF6B6B, #EE5253)', borderRadius: '8px' }} />
                                    <div style={{ background: 'linear-gradient(135deg, #4834D4, #686DE0)', borderRadius: '8px' }} />
                                    <div style={{ background: 'linear-gradient(135deg, #6AB04C, #BADC58)', borderRadius: '8px' }} />
                                    <div style={{ background: 'linear-gradient(135deg, #F0932B, #FFBE76)', borderRadius: '8px' }} />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{
                                        background: 'rgba(255, 215, 0, 0.1)', color: '#FFD700',
                                        padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'
                                    }}>
                                        {mosaic.type.toUpperCase() || 'DAILY'} MASTERPIECE
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>
                {`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                `}
            </style>
        </div>
    );
};

export default MosaicLibrary;

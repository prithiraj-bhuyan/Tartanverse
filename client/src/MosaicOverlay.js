import React, { useEffect, useState } from 'react';
import { X, CheckCircle, Trophy } from 'lucide-react';

const MosaicOverlay = ({ visible, points, onClose, onCollect }) => {
    const [animateIn, setAnimateIn] = useState(false);
    const [showCompletion, setShowCompletion] = useState(false);

    // Calculate progress (0-5)
    // 500 points = 1 full cycle

    // LOGIC UPDATE:
    // If points = 500, cycleProgress = 0. We want activeTiles = 5.
    // If points = 550, cycleProgress = 50. We want activeTiles = 5 (keep showing full from previous cycle).
    // If points = 600, cycleProgress = 100. activeTiles = 1. (Start showing next cycle).

    let cycleProgress = points % 500;
    let activeTiles = Math.floor(cycleProgress / 100);

    // If we have passed the first cycle (500+) AND we are in the first 100 points of the NEW cycle,
    // we assume the user is still "celebrating" the previous completion visually.
    // So we show 5 tiles instead of 0.
    if (points >= 500 && cycleProgress < 100) {
        activeTiles = 5;
    }

    // Auto-Collect Logic
    const [collectionStatus, setCollectionStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'

    useEffect(() => {
        if (visible) {
            setAnimateIn(true);
            if (activeTiles === 5) {
                setTimeout(() => setShowCompletion(true), 600);
            }
        } else {
            setAnimateIn(false);
            setShowCompletion(false);
            setCollectionStatus('idle'); // Reset status on close
        }
    }, [visible, activeTiles]);

    // Trigger Auto-Collect when completion is shown
    useEffect(() => {
        if (showCompletion && activeTiles === 5 && collectionStatus === 'idle') {
            const performCollection = async () => {
                setCollectionStatus('saving');
                try {
                    if (onCollect) await onCollect();
                    setCollectionStatus('saved');
                } catch (e) {
                    console.error("Auto-collect failed", e);
                    setCollectionStatus('error');
                }
            };
            // Small delay to let the user appreciate the "Mosaic Completed" text first
            setTimeout(performCollection, 2000);
        }
    }, [showCompletion, activeTiles, collectionStatus, onCollect]);

    if (!visible) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(10, 5, 20, 0.9)',
            backdropFilter: 'blur(16px)',
            zIndex: 4000,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            opacity: animateIn ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
            fontFamily: "'Inter', sans-serif"
        }}>

            {/* Close Button - Always visible so user can exit the celebration */}
            <button
                onClick={onClose}
                style={{
                    position: 'absolute', top: '40px', right: '40px',
                    background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                    width: '48px', height: '48px', color: 'white', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                    zIndex: 5000 // Ensure valid click
                }}
            >
                <X size={24} />
            </button>

            {/* Header Content */}
            <div style={{ textAlign: 'center', marginBottom: '50px', transform: animateIn ? 'translateY(0)' : 'translateY(-20px)', transition: 'transform 0.5s', opacity: animateIn ? 1 : 0 }}>
                <h2 style={{
                    color: 'white', fontSize: showCompletion ? '48px' : '32px', fontWeight: '800', margin: '0 0 12px 0',
                    // background: showCompletion ? 'linear-gradient(to right, #FFD700, #FFEA00, #FFD700)' : 'linear-gradient(to right, #FFD700, #FFA500)',
                    backgroundSize: '200% auto',
                    animation: showCompletion ? 'shine 3s linear infinite' : 'none',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    transition: 'all 0.5s'
                }}>
                    {activeTiles === 5 ? 'MOSAIC COMPLETE!' : 'Quest Complete!'}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '18px', margin: 0 }}>
                    {activeTiles === 5 ? 'Masterpiece Unlocked!' : `You collected a mosaic piece! ${5 - activeTiles} more to go.`}
                </p>
            </div>

            {/* Mosaic Container - Larger and Irregular */}
            <div style={{
                width: '500px', height: '500px',
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 1.2fr',
                gridTemplateRows: '1fr 1.5fr 1fr',
                gap: '12px',
                padding: '16px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: '32px',
                boxShadow: showCompletion ? '0 0 120px rgba(255, 215, 0, 0.5)' : '0 20px 60px rgba(0,0,0,0.6)',
                position: 'relative',
                transform: showCompletion ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                animation: showCompletion ? 'float 6s ease-in-out infinite' : 'none'
            }}>
                {/*
                   Irregular Grid Layout
                */}

                <div style={getTileStyle(0, activeTiles, showCompletion, '1 / 3', '1 / 2')} />
                <div style={getTileStyle(1, activeTiles, showCompletion, '1 / 2', '2 / 4')} />
                <div style={getTileStyle(2, activeTiles, showCompletion, '2 / 3', '2 / 3')} />
                <div style={getTileStyle(3, activeTiles, showCompletion, '2 / 3', '3 / 4')} />
                <div style={getTileStyle(4, activeTiles, showCompletion, '3 / 4', '1 / 4')} />

                {/* Visual Glint/Shine Effect Overlay */}
                {showCompletion && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.8) 50%, transparent 60%)',
                        backgroundSize: '200% 200%',
                        animation: 'glint 2.5s infinite',
                        pointerEvents: 'none',
                        borderRadius: '32px'
                    }} />
                )}
            </div>

            {/* Auto-Collect Status Indicator */}
            {showCompletion && activeTiles === 5 && (
                <div style={{
                    marginTop: '40px',
                    height: '60px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.5s ease'
                }}>
                    {collectionStatus === 'saving' && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            color: 'rgba(255,255,255,0.8)', fontSize: '16px', fontWeight: '500',
                            animation: 'fadeIn 0.5s'
                        }}>
                            <div className="spinner" style={{
                                width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)',
                                borderTop: '3px solid white', borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                            Adding to Memory Wall...
                        </div>
                    )}

                    {collectionStatus === 'saved' && (
                        <div style={{
                            background: 'rgba(76, 175, 80, 0.2)', border: '1px solid #4CAF50',
                            padding: '12px 24px', borderRadius: '30px',
                            color: '#4CAF50', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px',
                            animation: 'bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}>
                            <CheckCircle size={20} />
                            Saved to Memory Wall!
                        </div>
                    )}

                    {collectionStatus === 'error' && (
                        <div style={{
                            color: '#FF5252', fontSize: '14px'
                        }}>
                            Could not auto-save.
                        </div>
                    )}
                </div>
            )}

            <style>
                {`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes pulse-glow {
                    0% { box-shadow: 0 0 10px rgba(255,255,255,0.1); }
                    50% { box-shadow: 0 0 25px rgba(255,255,255,0.4); }
                    100% { box-shadow: 0 0 10px rgba(255,255,255,0.1); }
                }
                @keyframes shine {
                    to { background-position: 200% center; }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0) scale(1.05); }
                    50% { transform: translateY(-10px) scale(1.05); }
                }
                @keyframes glint {
                    0% { background-position: 0% 0%; opacity: 0; }
                    20% { opacity: 1; }
                    50% { background-position: 100% 100%; opacity: 0; }
                    100% { opacity: 0; }
                }
                @keyframes bounceIn {
                    0% { transform: scale(0); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                `}
            </style>
        </div>
    );
};

// Helper for tile styling
const getTileStyle = (index, activeTiles, isComplete, gridRow, gridColumn) => {
    const isActive = index < activeTiles;
    // Delay animations based on index for a "staggered" fill effect if loading
    const delay = index * 0.15;

    // Unique colors for each tile to make it look like a mosaic art piece
    const colors = [
        'linear-gradient(135deg, #FF6B6B, #EE5253)', // Red/Pink
        'linear-gradient(135deg, #4834D4, #686DE0)', // Deep Blue
        'linear-gradient(135deg, #6AB04C, #BADC58)', // Green
        'linear-gradient(135deg, #F0932B, #FFBE76)', // Orange
        'linear-gradient(135deg, #BE2EDD, #E056FD)'  // Purple
    ];

    const finalColor = isComplete
        ? 'linear-gradient(135deg, #FFD700, #FDB931)' // Gold Texture
        : colors[index];

    return {
        gridRow,
        gridColumn,
        background: isActive ? finalColor : 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '20px',
        boxShadow: isActive ? `0 4px 15px ${isComplete ? 'rgba(255,215,0,0.4)' : 'rgba(0,0,0,0.2)'}` : 'none',
        transition: `all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s`,
        transform: isActive ? 'scale(1)' : 'scale(0.92)',
        opacity: isActive ? 1 : 0.2,
        zIndex: isActive ? 2 : 1,
        // When it JUST activates (highest index), add a special highlight
        filter: (isActive && index === activeTiles - 1 && !isComplete) ? 'brightness(1.3) contrast(1.1)' : 'none'
    };
};

export default MosaicOverlay;

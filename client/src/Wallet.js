import React, { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import RedeemStore from './RedeemStore';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || (window.location.port === '3000' ? `http://${window.location.hostname}:3001` : '');

const Wallet = forwardRef(({ userId, balance, onBalanceChange }, ref) => {
  const [showStore, setShowStore] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await axios.get(`${SERVER_URL}/api/wallet`, { withCredentials: true });
      if (res.data.linked) {
        onBalanceChange(res.data.balance);
      }
    } catch (e) {
      console.error("Failed to fetch balance", e);
    }
  }, [onBalanceChange]);

  // Expose refreshBalance to parent via ref
  useImperativeHandle(ref, () => ({
    refreshBalance: fetchBalance
  }), [fetchBalance]);

  useEffect(() => {
    fetchBalance();
  }, [userId, fetchBalance]);

  // Poll balance every 15 seconds so it stays up-to-date
  useEffect(() => {
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  return (
    <>
      {/* Clickable Balance Badge */}
      <div
        onClick={() => setShowStore(true)}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '4px 12px',
          borderRadius: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          border: '2px solid #C41230',
          height: '36px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          gap: '6px'
        }}
        onMouseOver={e => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(196, 18, 48, 0.3)';
        }}
        onMouseOut={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        }}
      >
        {/* Scotty Dog Logo */}
        <img
          src={process.env.PUBLIC_URL + '/ScottyDog.jpeg'}
          alt="Scotty"
          style={{
            width: '24px',
            height: '24px',
            objectFit: 'cover',
            borderRadius: '50%',
            border: '1px solid #ddd'
          }}
          onError={(e) => { e.target.onerror = null; e.target.src = 'https://upload.wikimedia.org/wikipedia/en/thumb/b/b3/Carnegie_Mellon_Tartans_logo.svg/1920px-Carnegie_Mellon_Tartans_logo.svg.png'; }}
        />

        <span style={{ fontSize: '16px', fontWeight: '900', color: '#C41230', lineHeight: '1' }}>
          {balance}
        </span>

        {/* Small gift icon hint */}
        <span style={{ fontSize: '12px', opacity: 0.7 }}>🎁</span>
      </div>

      {/* Redeem Store Modal */}
      {showStore && (
        <RedeemStore
          onClose={() => setShowStore(false)}
          balance={balance}
          onBalanceChange={onBalanceChange}
        />
      )}
    </>
  );
});

Wallet.displayName = 'Wallet';

export default Wallet;

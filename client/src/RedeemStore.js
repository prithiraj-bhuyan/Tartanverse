import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || (window.location.port === '3000' ? `http://${window.location.hostname}:3001` : '');

// CMU Store Coupons Catalog
const COUPONS = [
  // Food Joints
  { id: 'stackd-5', name: '$5 Off at Stack\'d', description: 'Valid on any order over $10', cost: 15, store: 'Stack\'d', category: 'Food', icon: '🍔', color: '#FF6B35' },
  { id: 'stackd-10', name: '$10 Off at Stack\'d', description: 'Valid on any order over $20', cost: 25, store: 'Stack\'d', category: 'Food', icon: '🍔', color: '#FF6B35' },
  { id: 'toi-5', name: '$5 Off at Taste of India', description: 'Valid on dine-in or takeout', cost: 15, store: 'Taste of India', category: 'Food', icon: '🍛', color: '#E65100' },
  { id: 'toi-10', name: '$10 Off at Taste of India', description: 'Valid on orders over $15', cost: 25, store: 'Taste of India', category: 'Food', icon: '🍛', color: '#E65100' },
  { id: 'scotty-3', name: '$3 Off at Scotty\'s Market', description: 'Any purchase', cost: 8, store: 'Scotty\'s Market', category: 'Food', icon: '🛒', color: '#2E7D32' },
  { id: 'scotty-7', name: '$7 Off at Scotty\'s Market', description: 'Orders over $12', cost: 18, store: 'Scotty\'s Market', category: 'Food', icon: '🛒', color: '#2E7D32' },
  { id: 'exchg-5', name: '$5 Off at The Exchange', description: 'Valid on any food item', cost: 15, store: 'The Exchange', category: 'Food', icon: '🥗', color: '#558B2F' },

  // Coffee
  { id: 'deangelos-free', name: 'Free Coffee at De Angelo\'s', description: 'Any small hot or iced coffee', cost: 8, store: 'De Angelo\'s', category: 'Coffee', icon: '☕', color: '#6D4C41' },
  { id: 'deangelos-5', name: '$5 Off at De Angelo\'s', description: 'Any order', cost: 12, store: 'De Angelo\'s', category: 'Coffee', icon: '☕', color: '#6D4C41' },
  { id: 'tazza-free', name: 'Free Drink at Tazza D\'Oro', description: 'Any regular drink', cost: 10, store: 'Tazza D\'Oro', category: 'Coffee', icon: '☕', color: '#4E342E' },

  // University Merch
  { id: 'merch-10', name: '$10 Off CMU Merch', description: 'At the University Store on orders over $25', cost: 20, store: 'CMU University Store', category: 'Merch', icon: '🎓', color: '#C41230' },
  { id: 'merch-25', name: '$25 Off CMU Merch', description: 'At the University Store on orders over $50', cost: 40, store: 'CMU University Store', category: 'Merch', icon: '🎓', color: '#C41230' },
  { id: 'merch-hoodie', name: 'Free CMU Hoodie', description: 'Any standard CMU hoodie from the University Store', cost: 30, store: 'CMU University Store', category: 'Merch', icon: '🧥', color: '#C41230' },

  // Entertainment / Campus
  { id: 'print-5', name: '$5 Printing Credit', description: 'Added to your TartanCard for printing', cost: 10, store: 'CMU Printing', category: 'Campus', icon: '🖨️', color: '#37474F' },
  { id: 'gym-pass', name: 'Guest Gym Pass', description: 'One free guest pass to the UC Fitness Center', cost: 20, store: 'UC Fitness Center', category: 'Campus', icon: '🏋️', color: '#1565C0' },
];

const CATEGORIES = ['All', 'Food', 'Coffee', 'Merch', 'Campus'];

function RedeemStore({ onClose, balance, onBalanceChange }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [transactions, setTransactions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [redeeming, setRedeeming] = useState(null); // coupon id being redeemed
  const [redeemSuccess, setRedeemSuccess] = useState(null); // { couponName, code }
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await axios.get(`${SERVER_URL}/api/transactions`, { withCredentials: true });
      setTransactions(res.data);
    } catch (e) {
      console.error('Failed to fetch transactions', e);
    }
  };

  const handleRedeem = async (coupon) => {
    if (balance < coupon.cost) {
      setError(`Not enough Tartan Points! You need ${coupon.cost - balance} more.`);
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!window.confirm(`Redeem "${coupon.name}" for ${coupon.cost} Tartan Points?`)) return;

    setRedeeming(coupon.id);
    setError('');

    try {
      const res = await axios.post(`${SERVER_URL}/api/redeem`, {
        couponId: coupon.id,
        couponName: coupon.name,
        cost: coupon.cost,
        store: coupon.store
      }, { withCredentials: true });

      if (res.data.success) {
        setRedeemSuccess({ couponName: coupon.name, code: res.data.couponCode, store: coupon.store });
        if (onBalanceChange) onBalanceChange(res.data.newBalance);
        // [FIXED] Add small delay to ensure DB write is committed before fetch
        setTimeout(() => {
          fetchTransactions();
        }, 500);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to redeem coupon');
    } finally {
      setRedeeming(null);
    }
  };

  const filteredCoupons = selectedCategory === 'All'
    ? COUPONS
    : COUPONS.filter(c => c.category === selectedCategory);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 5000,
      backdropFilter: 'blur(4px)',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '480px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #C41230 0%, #8B0000 100%)',
          color: 'white',
          padding: '20px',
          position: 'relative'
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: '12px', right: '12px',
            background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
            width: '32px', height: '32px', borderRadius: '50%', fontSize: '18px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>×</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px', height: '48px', background: 'rgba(255,255,255,0.2)',
              borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px'
            }}>🎁</div>
            <div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>Redeem Store</h2>
              <p style={{ margin: '2px 0 0', fontSize: '14px', opacity: 0.9 }}>Spend your Tartan Points</p>
            </div>
          </div>

          {/* Balance Badge */}
          <div style={{
            marginTop: '15px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '12px',
            padding: '12px 16px'
          }}>
            <div>
              <div style={{ fontSize: '12px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px' }}>Your Balance</div>
              <div style={{ fontSize: '28px', fontWeight: '900' }}>{balance} <span style={{ fontSize: '14px', fontWeight: '400' }}>pts</span></div>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                padding: '8px 14px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
                color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600'
              }}
            >
              {showHistory ? '🎁 Store' : '📋 History'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '10px 16px', backgroundColor: '#FFEBEE', color: '#C62828',
            fontSize: '13px', fontWeight: '600', textAlign: 'center',
            borderBottom: '1px solid #FFCDD2'
          }}>
            {error}
          </div>
        )}

        {/* Redeem Success Modal */}
        {redeemSuccess && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10
          }}>
            <div style={{
              background: 'white', borderRadius: '16px', padding: '30px', textAlign: 'center',
              width: '80%', maxWidth: '320px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
            }}>
              <div style={{ fontSize: '60px', marginBottom: '10px' }}>🎉</div>
              <h3 style={{ margin: '0 0 5px', fontSize: '20px', color: '#333' }}>Coupon Redeemed!</h3>
              <p style={{ color: '#666', fontSize: '14px', margin: '0 0 15px' }}>{redeemSuccess.couponName}</p>

              <div style={{
                background: '#f5f5f5', borderRadius: '8px', padding: '15px', marginBottom: '15px',
                border: '2px dashed #C41230'
              }}>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>Your Coupon Code</div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#C41230', letterSpacing: '3px', fontFamily: 'monospace' }}>
                  {redeemSuccess.code}
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Show this at {redeemSuccess.store}</div>
              </div>

              <button onClick={() => setRedeemSuccess(null)} style={{
                width: '100%', padding: '12px', background: '#C41230', color: 'white',
                border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer'
              }}>
                Got it!
              </button>
            </div>
          </div>
        )}

        {showHistory ? (
          /* Transaction History */
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', color: '#333' }}>Transaction History</h3>
            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div>
                <p>No transactions yet.<br />Redeem your first coupon!</p>
              </div>
            ) : (
              transactions.map((tx, i) => (
                <div key={tx.id || i} style={{
                  display: 'flex', alignItems: 'center', padding: '12px',
                  borderBottom: '1px solid #f0f0f0', gap: '12px'
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px',
                    background: '#FFEBEE'
                  }}>
                    🎟️
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#333' }}>
                      {tx.description || tx.coupon_name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      {tx.store && `${tx.store} • `}
                      {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {tx.coupon_code && (
                      <div style={{ fontSize: '11px', color: '#C41230', fontFamily: 'monospace', fontWeight: 'bold', marginTop: '2px' }}>
                        Code: {tx.coupon_code}
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontWeight: '800', fontSize: '15px',
                    color: '#C62828'
                  }}>
                    -{tx.amount} pts
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Coupon Store */
          <>
            {/* Category Tabs */}
            <div style={{
              display: 'flex', gap: '6px', padding: '12px 16px',
              overflowX: 'auto', borderBottom: '1px solid #eee',
              flexShrink: 0
            }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '6px 14px', borderRadius: '20px', border: 'none',
                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    background: selectedCategory === cat ? '#C41230' : '#f0f0f0',
                    color: selectedCategory === cat ? 'white' : '#555',
                    transition: 'all 0.2s'
                  }}
                >
                  {cat === 'Food' ? '🍔 ' : cat === 'Coffee' ? '☕ ' : cat === 'Merch' ? '🎓 ' : cat === 'Campus' ? '🏫 ' : ''}{cat}
                </button>
              ))}
            </div>

            {/* Coupon Grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {filteredCoupons.map(coupon => {
                const canAfford = balance >= coupon.cost;
                const isRedeeming = redeeming === coupon.id;

                return (
                  <div key={coupon.id} style={{
                    display: 'flex', alignItems: 'center', padding: '14px',
                    marginBottom: '10px', borderRadius: '12px',
                    border: canAfford ? '1px solid #e0e0e0' : '1px solid #f0f0f0',
                    opacity: canAfford ? 1 : 0.6,
                    background: canAfford ? 'white' : '#fafafa',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Left color accent */}
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                      background: coupon.color
                    }} />

                    {/* Icon */}
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '22px', marginLeft: '8px', marginRight: '12px',
                      background: `${coupon.color}15`, flexShrink: 0
                    }}>
                      {coupon.icon}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#333', marginBottom: '2px' }}>
                        {coupon.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>
                        {coupon.description}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#C41230' }}>
                        {coupon.cost} pts
                      </div>
                    </div>

                    {/* Redeem Button */}
                    <button
                      onClick={() => handleRedeem(coupon)}
                      disabled={!canAfford || isRedeeming}
                      style={{
                        padding: '8px 14px',
                        background: canAfford ? coupon.color : '#ccc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: canAfford ? 'pointer' : 'not-allowed',
                        flexShrink: 0,
                        marginLeft: '8px',
                        transition: 'transform 0.2s',
                        opacity: isRedeeming ? 0.7 : 1
                      }}
                      onMouseOver={e => canAfford && (e.currentTarget.style.transform = 'scale(1.05)')}
                      onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      {isRedeeming ? '...' : (canAfford ? 'Redeem' : '🔒')}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default RedeemStore;

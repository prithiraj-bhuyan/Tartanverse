import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const ChatBox = forwardRef(({ socket, currentUser, friends }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState('everyone'); // 'everyone' or a friend's userId
  const [messages, setMessages] = useState({}); // { channel: [msgs] }
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadPerChannel, setUnreadPerChannel] = useState({}); // { channelId: count }
  const messagesEndRef = useRef(null);

  // Refs to avoid re-subscribing the socket listener on every state change
  const isOpenRef = useRef(isOpen);
  const activeChannelRef = useRef(activeChannel);
  const currentUserRef = useRef(currentUser);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { activeChannelRef.current = activeChannel; }, [activeChannel]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    openToFriend: (friendId) => {
      setIsOpen(true);
      setActiveChannel(friendId);
      // Clear unread for this channel
      setUnreadPerChannel(prev => {
        const cleared = { ...prev };
        delete cleared[friendId];
        return cleared;
      });
    },
    getUnreadForFriend: (friendId) => {
      return unreadPerChannel[friendId] || 0;
    },
    unreadPerChannel
  }), [unreadPerChannel]);

  // Listen for incoming messages — subscribe ONCE, use refs inside handler
  useEffect(() => {
    const handleMessage = (msg) => {
      console.log('[ChatBox] received message:', msg);
      const curUser = currentUserRef.current;
      const channel = msg.channel === 'everyone'
        ? 'everyone'
        : // For DMs, key by the OTHER person's userId
          msg.senderUserId === curUser?.id
            ? msg.channel // I sent this DM → file under recipient
            : msg.senderUserId; // I received this DM → file under sender

      setMessages(prev => ({
        ...prev,
        [channel]: [...(prev[channel] || []), msg]
      }));

      // Increment unread if chat is closed or on a different channel
      if (!isOpenRef.current || activeChannelRef.current !== channel) {
        setUnreadCount(prev => prev + 1);
        setUnreadPerChannel(prev => ({
          ...prev,
          [channel]: (prev[channel] || 0) + 1
        }));
      }
    };

    socket.on('chatMessageReceived', handleMessage);

    return () => {
      socket.off('chatMessageReceived', handleMessage);
    };
  }, [socket]); // only depend on socket — it never changes

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannel]);

  // Clear unread when opening
  const toggleChat = () => {
    if (!isOpen) {
      setUnreadCount(0);
      // Clear per-channel unread for current active channel
      setUnreadPerChannel(prev => {
        const cleared = { ...prev };
        delete cleared[activeChannel];
        return cleared;
      });
    }
    setIsOpen(prev => !prev);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const isEveryone = activeChannel === 'everyone';
    const payload = {
      text: inputText.trim(),
      to: isEveryone ? 'everyone' : activeChannel,
      toUserId: isEveryone ? null : activeChannel
    };
    console.log('[ChatBox] sending message:', payload, 'socket connected:', socket.connected);
    socket.emit('chatMessage', payload);

    setInputText('');
  };

  const channelMessages = messages[activeChannel] || [];

  const getActiveFriend = () => {
    if (activeChannel === 'everyone') return null;
    return friends.find(f => f.id === activeChannel);
  };

  const activeFriend = getActiveFriend();

  return (
    <>
      {/* Floating Chat Icon - Bottom Right */}
      <div
        onClick={toggleChat}
        style={{
          position: 'absolute',
          bottom: '50px',
          right: '60px',
          zIndex: 2000,
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(102, 126, 234, 0.5)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseOver={e => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.7)';
        }}
        onMouseOut={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.5)';
        }}
      >
        {/* Chat bubble SVG icon */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#FF4081',
            color: 'white',
            borderRadius: '50%',
            width: '22px',
            height: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 'bold',
            border: '2px solid white'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>

      {/* Chat Panel */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '100px',
          right: '20px',
          width: '360px',
          height: '480px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
              💬 Chat
            </div>
            <button
              onClick={toggleChat}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0 4px',
                lineHeight: 1
              }}
            >
              ×
            </button>
          </div>

          {/* Channel Tabs - Zoom-style: Everyone + Friends */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #e0e0e0',
            overflowX: 'auto',
            flexShrink: 0,
            backgroundColor: '#fafafa'
          }}>
            {/* Everyone tab */}
            <button
              onClick={() => { setActiveChannel('everyone'); setUnreadCount(0); setUnreadPerChannel(prev => { const c = {...prev}; delete c['everyone']; return c; }); }}
              style={{
                padding: '10px 16px',
                border: 'none',
                background: activeChannel === 'everyone' ? '#fff' : 'transparent',
                borderBottom: activeChannel === 'everyone' ? '2px solid #667eea' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeChannel === 'everyone' ? 'bold' : 'normal',
                color: activeChannel === 'everyone' ? '#667eea' : '#666',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              🌍 Everyone
            </button>

            {/* Friend tabs */}
            {friends.map(friend => {
              const hasUnread = (messages[friend.id] || []).length > 0 &&
                activeChannel !== friend.id;

              return (
                <button
                  key={friend.id}
                  onClick={() => { setActiveChannel(friend.id); setUnreadCount(0); setUnreadPerChannel(prev => { const c = {...prev}; delete c[friend.id]; return c; }); }}
                  style={{
                    padding: '10px 12px',
                    border: 'none',
                    background: activeChannel === friend.id ? '#fff' : 'transparent',
                    borderBottom: activeChannel === friend.id ? '2px solid #667eea' : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: activeChannel === friend.id ? 'bold' : 'normal',
                    color: activeChannel === friend.id ? '#667eea' : '#666',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                >
                  {friend.avatar_url && (
                    <img
                      src={friend.avatar_url}
                      alt=""
                      style={{ width: '18px', height: '18px', borderRadius: '50%' }}
                    />
                  )}
                  {friend.display_name?.split(' ')[0]}
                  {hasUnread && (
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#FF4081',
                      display: 'inline-block'
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: '#f5f5f5'
          }}>
            {channelMessages.length === 0 && (
              <div style={{
                textAlign: 'center',
                color: '#999',
                marginTop: '40px',
                fontSize: '14px'
              }}>
                {activeChannel === 'everyone'
                  ? 'No messages yet. Say hi to everyone! 👋'
                  : `Start chatting with ${activeFriend?.display_name || 'your friend'}! 💬`}
              </div>
            )}

            {channelMessages.map(msg => {
              const isMe = msg.senderUserId === currentUser?.id;
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: isMe ? 'row-reverse' : 'row',
                    alignItems: 'flex-end',
                    gap: '8px'
                  }}
                >
                  {/* Avatar */}
                  {!isMe && (
                    <img
                      src={msg.senderAvatar || 'https://via.placeholder.com/28'}
                      alt=""
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        flexShrink: 0
                      }}
                    />
                  )}

                  <div style={{
                    maxWidth: '70%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start'
                  }}>
                    {/* Sender name (only for non-DM or group) */}
                    {!isMe && activeChannel === 'everyone' && (
                      <span style={{
                        fontSize: '11px',
                        color: '#888',
                        marginBottom: '2px',
                        paddingLeft: '4px'
                      }}>
                        {msg.senderName}
                      </span>
                    )}

                    <div style={{
                      padding: '8px 12px',
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      backgroundColor: isMe ? '#667eea' : '#fff',
                      color: isMe ? '#fff' : '#333',
                      fontSize: '14px',
                      lineHeight: '1.4',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      wordBreak: 'break-word'
                    }}>
                      {msg.text}
                    </div>

                    <span style={{
                      fontSize: '10px',
                      color: '#aaa',
                      marginTop: '2px',
                      paddingLeft: '4px',
                      paddingRight: '4px'
                    }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={sendMessage}
            style={{
              display: 'flex',
              padding: '10px',
              borderTop: '1px solid #e0e0e0',
              backgroundColor: '#fff',
              gap: '8px',
              flexShrink: 0
            }}
          >
            <input
              type="text"
              placeholder={
                activeChannel === 'everyone'
                  ? 'Message everyone...'
                  : `Message ${activeFriend?.display_name || 'friend'}...`
              }
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid #ddd',
                borderRadius: '24px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={e => e.target.style.borderColor = '#667eea'}
              onBlur={e => e.target.style.borderColor = '#ddd'}
              autoFocus
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: 'none',
                background: inputText.trim()
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : '#ccc',
                color: 'white',
                cursor: inputText.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.2s'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
});

ChatBox.displayName = 'ChatBox';

export default ChatBox;

import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Chat.css';

const Chat = () => {
  const { user, socket, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const currentUserId = user?.id || user?._id;

  useEffect(() => {
    if (!user) return;
    loadUsers();
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    const handleUsersOnline = (onlineUsers) => {
      // Merge server-provided users with local list
      setUsers((prev) => {
        const map = new Map(prev.map(u => [u._id?.toString() || u.id?.toString(), u]));
        onlineUsers.forEach(u => map.set(u._id?.toString() || u.id?.toString(), { ...map.get(u._id?.toString() || u.id?.toString()), ...u }));
        return Array.from(map.values());
      });
    };

    const handleMessageReceive = (message) => {
      // If message belongs to the open conversation, append
      const otherId = message.sender?._id?.toString() || message.sender?.id;
      if (selectedUser && otherId === (selectedUser._id?.toString() || selectedUser.id?.toString())) {
        setMessages((m) => [...m, message]);
      } else {
        // Optionally update unread counts or notify
      }
    };

    const handleMessageSent = (message) => {
      const otherId = message.receiver?._id?.toString() || message.receiver?.id;
      if (selectedUser && otherId === (selectedUser._id?.toString() || selectedUser.id?.toString())) {
        setMessages((m) => [...m, message]);
      }
    };

    const handleTypingStart = ({ userId }) => {
      setTypingUsers((t) => ({ ...t, [userId]: true }));
    };

    const handleTypingStop = ({ userId }) => {
      setTypingUsers((t) => {
        const copy = { ...t };
        delete copy[userId];
        return copy;
      });
    };

    socket.on('users:online', handleUsersOnline);
    socket.on('message:receive', handleMessageReceive);
    socket.on('message:sent', handleMessageSent);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    return () => {
      socket.off('users:online', handleUsersOnline);
      socket.off('message:receive', handleMessageReceive);
      socket.off('message:sent', handleMessageSent);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
    };
  }, [socket, selectedUser]);

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data.filter(u => (u._id?.toString() || u.id?.toString()) !== (currentUserId?.toString())));
    } catch (err) {
      console.error('Load users error', err);
    }
  };

  const openConversation = async (other) => {
    setSelectedUser(other);
    setMessages([]);
    setLoadingMessages(true);
    try {
      const token = localStorage.getItem('token');
      const otherId = other._id || other.id;
      const res = await axios.get(`/api/messages/${otherId}`, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(res.data || []);
      // Scroll to bottom after messages loaded
      setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 100);
    } catch (err) {
      console.error('Load messages error', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!content.trim() || !selectedUser) return;

    const payload = {
      receiverId: selectedUser._id || selectedUser.id,
      content: content.trim()
    };

    // Optimistic UI: append message locally
    const optimisticMessage = {
      _id: `tmp-${Date.now()}`,
      sender: { _id: currentUserId, username: user.username },
      receiver: { _id: payload.receiverId },
      content: payload.content,
      createdAt: new Date().toISOString()
    };
    setMessages((m) => [...m, optimisticMessage]);

    // Emit via socket
    if (socket && socket.connected) {
      socket.emit('message:send', payload);
    }

    setContent('');
    inputRef.current?.focus();
  };

  const handleInput = (e) => {
    setContent(e.target.value);

    if (!selectedUser || !socket) return;

    const receiverId = selectedUser._id || selectedUser.id;

    // Emit typing:start and then typing:stop after 1s of inactivity
    if (socket && socket.connected) {
      socket.emit('typing:start', { receiverId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { receiverId });
      }, 1000);
    }
  };

  const renderUsers = () => {
    if (users.length === 0) {
      return <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No users available</div>;
    }
    return users.map((u) => {
      const id = u._id || u.id;
      const isSelected = selectedUser && ((selectedUser._id || selectedUser.id) === id);
      const onlineStatus = u.isOnline ? 'Online' : `Last seen ${u.lastSeen ? new Date(u.lastSeen).toLocaleTimeString() : 'unknown'}`;
      return (
        <div key={id} className={`user-item ${isSelected ? 'selected' : ''}`} onClick={() => openConversation(u)}>
          <div className="user-avatar">{u.username?.charAt(0).toUpperCase()}</div>
          <div className="user-meta">
            <div className="user-name">{u.username}</div>
            <div className="user-status">{onlineStatus}</div>
          </div>
        </div>
      );
    });
  };

  const renderMessages = () => {
    if (loadingMessages) return <div className="no-chat-selected"><h2>Loading messages...</h2></div>;
    if (!selectedUser) return <div className="no-chat-selected"><h2>👋 Select a user</h2><p>Pick someone to start chatting</p></div>;

    return (
      <div className="messages-list">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#ccc', margin: 'auto' }}>
            <p>No messages yet. Say hi! 👋</p>
          </div>
        )}
        {messages.map((m) => {
          const senderId = m.sender?._id?.toString() || m.sender?.id;
          const isMine = senderId === (currentUserId?.toString());
          return (
            <div key={m._id} className={`message-item ${isMine ? 'mine' : 'theirs'}`}>
              {!isMine && <div className="msg-sender">{m.sender?.username}</div>}
              <div className="msg-content">{m.content}</div>
              <div className="msg-time">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          );
        })}

        {typingUsers[selectedUser?._id || selectedUser?.id] && (
          <div className="typing-indicator">✏️ {selectedUser.username} is typing...</div>
        )}
      </div>
    );
  };

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <div className="me">
            <div style={{ fontSize: '13px', opacity: 0.9 }}>👤 Signed in as</div>
            <strong>{user?.username}</strong>
          </div>
          <button className="logout" onClick={logout}>Logout</button>
        </div>
        <div className="users-list">{renderUsers()}</div>
      </div>

      <div className="chat-main">
        <div className="chat-header">
          {selectedUser ? (
            <div className="chat-with">💬 Chat with <strong>{selectedUser.username}</strong></div>
          ) : (
            <div className="chat-with">💬 Select a conversation</div>
          )}
        </div>

        <div className="chat-body">{renderMessages()}</div>

        <div className="chat-input">
          <form onSubmit={handleSend} className="send-form">
            <input
              ref={inputRef}
              type="text"
              placeholder={selectedUser ? `Message ${selectedUser.username}...` : 'Select a user to start typing'}
              value={content}
              onChange={handleInput}
              disabled={!selectedUser}
            />
            <button type="submit" disabled={!selectedUser || !content.trim()}>Send</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;

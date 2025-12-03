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
  const [notifications, setNotifications] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
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

    const handleNotification = (notification) => {
      setNotifications((n) => [...n, { ...notification, id: Date.now() }]);
      setTimeout(() => {
        setNotifications((n) => n.filter((notif) => notif.id !== notification.id + Date.now()));
      }, 4000);
    };

    socket.on('users:online', handleUsersOnline);
    socket.on('message:receive', handleMessageReceive);
    socket.on('message:sent', handleMessageSent);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('notification:new', handleNotification);

    return () => {
      socket.off('users:online', handleUsersOnline);
      socket.off('message:receive', handleMessageReceive);
      socket.off('message:sent', handleMessageSent);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('notification:new', handleNotification);
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
    setSelectedFile(null);
    inputRef.current?.focus();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || !selectedUser) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('content', content.trim());

      const token = localStorage.getItem('token');
      const receiverId = selectedUser._id || selectedUser.id;

      const res = await axios.post(`/api/messages/upload/${receiverId}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setMessages((m) => [...m, res.data]);
      setContent('');
      setSelectedFile(null);
      inputRef.current?.focus();
    } catch (err) {
      console.error('Upload error', err);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
    }
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
          const getFileIcon = (mimetype) => {
            if (mimetype?.startsWith('image/')) return '🖼️';
            if (mimetype?.startsWith('video/')) return '🎬';
            if (mimetype?.startsWith('audio/')) return '🎵';
            if (mimetype?.includes('pdf')) return '📄';
            if (mimetype?.includes('word')) return '📝';
            return '📎';
          };
          return (
            <div key={m._id} className={`message-item ${isMine ? 'mine' : 'theirs'}`}>
              {!isMine && <div className="msg-sender">{m.sender?.username}</div>}
              {m.file && (
                <a href={m.file.url} target="_blank" rel="noopener noreferrer" className="msg-file">
                  {getFileIcon(m.file.mimetype)} {m.file.originalName}
                </a>
              )}
              {m.content && <div className="msg-content">{m.content}</div>}
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
      {/* Notifications */}
      <div className="notifications-container">
        {notifications.map((notif) => (
          <div key={notif.id} className="notification">
            <span>🔔 {notif.from?.username}: {notif.content}</span>
          </div>
        ))}
      </div>

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
          {selectedFile && (
            <div className="file-preview">
              📎 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              <button type="button" onClick={() => setSelectedFile(null)} className="remove-file">✕</button>
            </div>
          )}
          <form onSubmit={selectedFile ? handleFileUpload : handleSend} className="send-form">
            <input
              ref={inputRef}
              type="text"
              placeholder={selectedUser ? `Message ${selectedUser.username}...` : 'Select a user to start typing'}
              value={content}
              onChange={handleInput}
              disabled={!selectedUser || uploading}
            />
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!selectedUser || uploading} className="file-btn">
              📎
            </button>
            <button type="submit" disabled={(!selectedUser || !content.trim()) && !selectedFile || uploading}>
              {uploading ? 'Uploading...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import api, { socketUrl } from '../api.js';
import { useAuth } from './AuthContext.jsx';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);

  function load() {
    api.get('/notifications').then((res) => setNotifications(res.data)).catch(() => {});
    api.get('/notifications/unread-count').then((res) => setUnreadCount(res.data.count)).catch(() => {});
  }

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    load();

    const socket = io(socketUrl, { transports: ['websocket', 'polling'], withCredentials: true });
    socketRef.current = socket;
    socket.on('notification', (n) => {
      setNotifications((prev) => [{ ...n, is_read: false }, ...prev].slice(0, 50));
      setUnreadCount((prev) => prev + 1);
    });

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function markRead(id) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await api.put(`/notifications/${id}/read`);
    } catch {
      // best-effort — a stale unread count isn't worth surfacing an error for
    }
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await api.put('/notifications/read-all');
    } catch {
      // best-effort
    }
  }

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, refresh: load }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

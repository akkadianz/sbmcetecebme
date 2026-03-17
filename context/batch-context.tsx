'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

export type UserRole = 'admin' | 'staff' | 'student'

interface BatchSession {
  batch_id: number;
  batch_name: string;
  department: 'ECE' | 'BME';
  created_at: string;
  role: UserRole;
  student_id?: number;
  student_name?: string;
}

interface BatchContextType {
  batch: BatchSession | null;
  setBatch: (batch: BatchSession) => void;
  logout: () => void;
  isLoggedIn: boolean;
  isReady: boolean;
}

const BatchContext = createContext<BatchContextType | undefined>(undefined);

export function BatchProvider({ children }: { children: ReactNode }) {
  const [batch, setBatchState] = useState<BatchSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedSession = sessionStorage.getItem('batch_session');
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession);
        setBatchState({
          ...parsedSession,
          department: parsedSession.department || 'ECE',
          role: parsedSession.role || 'admin',
        });
      } catch {
        sessionStorage.removeItem('batch_session');
      }
    }

    setIsReady(true);
  }, []);

  const setBatch = useCallback((newBatch: BatchSession) => {
    setBatchState(newBatch);
    // Store in session storage (not persistent across browser close)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('batch_session', JSON.stringify(newBatch));
    }
  }, []);

  const logout = useCallback(() => {
    setBatchState(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('batch_session');
    }
  }, []);

  const value: BatchContextType = {
    batch,
    setBatch,
    logout,
    isLoggedIn: batch !== null,
    isReady,
  };

  return <BatchContext.Provider value={value}>{children}</BatchContext.Provider>;
}

export function useBatch(): BatchContextType {
  const context = useContext(BatchContext);
  if (!context) {
    throw new Error('useBatch must be used within BatchProvider');
  }
  return context;
}

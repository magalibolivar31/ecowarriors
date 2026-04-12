import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface UserAliasProps {
  uid: string;
  fallback?: string;
  className?: string;
  initialOnly?: boolean;
}

export const UserAlias: React.FC<UserAliasProps> = ({ uid, fallback = 'EcoWarrior', className, initialOnly = false }) => {
  const [alias, setAlias] = useState<string>(fallback);

  useEffect(() => {
    if (!uid) return;

    const unsub = onSnapshot(doc(db, 'users', uid), (docSnap) => {
      if (docSnap.exists()) {
        setAlias(docSnap.data().alias || fallback);
      }
    });

    return () => unsub();
  }, [uid, fallback]);

  if (initialOnly) {
    return <span className={className}>{alias.charAt(0).toUpperCase()}</span>;
  }

  return <span className={className}>{alias}</span>;
};

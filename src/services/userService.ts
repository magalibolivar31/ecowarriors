import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, handleFirestoreError, OperationType, storage } from '../firebase';
import { UserSettings } from '../types';
import { sanitizeText } from '../lib/utils';

const USER_SETTINGS_COLLECTION = 'userSettings';

export async function getUserSettings(): Promise<UserSettings | null> {
  if (!auth.currentUser) return null;
  
  try {
    const docRef = doc(db, USER_SETTINGS_COLLECTION, auth.currentUser.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as UserSettings;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${USER_SETTINGS_COLLECTION}/${auth.currentUser?.uid}`);
    return null;
  }
}

export async function getUserProfile(uid: string): Promise<any | null> {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

export async function updateUserSettings(settings: Partial<UserSettings>): Promise<void> {
  if (!auth.currentUser) throw new Error('User must be authenticated');
  
  try {
    const docRef = doc(db, USER_SETTINGS_COLLECTION, auth.currentUser.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      await updateDoc(docRef, settings);
    } else {
      await setDoc(docRef, {
        uid: auth.currentUser.uid,
        onboardingCompleted: false,
        ...settings
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${USER_SETTINGS_COLLECTION}/${auth.currentUser?.uid}`);
    throw error;
  }
}

export async function updateUserProfile(uid: string, data: {
  alias?: string;
  photoURL?: string;
  zone?: string;
  commitment?: string;
  xp?: number;
  level?: number;
}): Promise<void> {
  try {
    const sanitizedData = { ...data };
    if (sanitizedData.alias) sanitizedData.alias = sanitizeText(sanitizedData.alias);
    if (sanitizedData.zone) sanitizedData.zone = sanitizeText(sanitizedData.zone);
    if (sanitizedData.commitment) sanitizedData.commitment = sanitizeText(sanitizedData.commitment);

    await updateDoc(doc(db, 'users', uid), sanitizedData);
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  const storageRef = ref(storage, `profiles/${uid}/avatar.jpg`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await updateUserProfile(uid, { photoURL: url });
  return url;
}

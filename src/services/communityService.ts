import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  arrayUnion,
  arrayRemove,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, cleanFirestoreData } from '../firebase';
import { Squad, Post, PostStatus, SquadStatus } from '../types';
import { sanitizeText } from '../lib/utils';

const SQUADS_COLLECTION = 'crew_events';
const POSTS_COLLECTION = 'posts';

// --- SQUADS (CUADRILLAS) ---

export async function createSquad(data: Omit<Squad, 'id' | 'createdAt' | 'createdBy' | 'createdByName' | 'attendees' | 'status'>): Promise<string> {
  if (!auth.currentUser) throw new Error('User must be authenticated');

  const uid = auth.currentUser.uid;
  const userName = auth.currentUser.displayName || 'Usuario EcoWarrior';

  try {
    const squadData = {
      ...data,
      createdAt: serverTimestamp(),
      createdBy: uid,
      createdByName: userName,
      attendees: [uid],
      status: 'próxima' as SquadStatus
    };

    const docRef = await addDoc(collection(db, SQUADS_COLLECTION), cleanFirestoreData(squadData));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, SQUADS_COLLECTION);
    throw error;
  }
}

export async function joinSquad(squadId: string): Promise<void> {
  if (!auth.currentUser) throw new Error('User must be authenticated');
  const uid = auth.currentUser.uid;

  try {
    const squadRef = doc(db, SQUADS_COLLECTION, squadId);
    await updateDoc(squadRef, {
      attendees: arrayUnion(uid)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, SQUADS_COLLECTION);
    throw error;
  }
}

export async function leaveSquad(squadId: string): Promise<void> {
  if (!auth.currentUser) throw new Error('User must be authenticated');
  const uid = auth.currentUser.uid;

  try {
    const squadRef = doc(db, SQUADS_COLLECTION, squadId);
    await updateDoc(squadRef, {
      attendees: arrayRemove(uid)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, SQUADS_COLLECTION);
    throw error;
  }
}

export function subscribeToSquads(callback: (squads: Squad[]) => void) {
  const q = query(
    collection(db, SQUADS_COLLECTION),
    orderBy('date', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const squads = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Squad));
    callback(squads);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, SQUADS_COLLECTION);
  });
}

// --- POSTS (TE DOY / RECIBO) ---

export async function createPost(data: Omit<Post, 'id' | 'createdAt' | 'createdBy' | 'createdByName' | 'status'>): Promise<string> {
  if (!auth.currentUser) throw new Error('User must be authenticated');

  const uid = auth.currentUser.uid;
  const userName = auth.currentUser.displayName || 'Usuario EcoWarrior';

  try {
    const postData = {
      ...data,
      content: sanitizeText(data.content),
      createdAt: serverTimestamp(),
      createdBy: uid,
      createdByName: userName,
      status: 'disponible' as PostStatus
    };

    const docRef = await addDoc(collection(db, POSTS_COLLECTION), cleanFirestoreData(postData));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, POSTS_COLLECTION);
    throw error;
  }
}

export async function updatePostStatus(postId: string, status: PostStatus): Promise<void> {
  if (!auth.currentUser) throw new Error('User must be authenticated');

  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) throw new Error('Post not found');
    if (postDoc.data().createdBy !== auth.currentUser.uid) throw new Error('Only the creator can update status');

    await updateDoc(postRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, POSTS_COLLECTION);
    throw error;
  }
}

export function subscribeToPosts(callback: (posts: Post[]) => void) {
  const q = query(
    collection(db, POSTS_COLLECTION),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Post));
    callback(posts);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, POSTS_COLLECTION);
  });
}

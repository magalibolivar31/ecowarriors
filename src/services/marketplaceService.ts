import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, cleanFirestoreData } from '../firebase';
import { MarketplacePost } from '../types';
import { sanitizeText } from '../lib/utils';

const MARKETPLACE_COLLECTION = 'marketplace';

export async function createMarketplacePost(
  type: 'doy' | 'recibo',
  title: string,
  content: string,
  tag: string,
  images: string[],
  contact: string
): Promise<string> {
  if (!auth.currentUser) throw new Error('User must be authenticated');

  const uid = auth.currentUser.uid;
  
  try {
    const postData = {
      uid,
      type,
      title: sanitizeText(title),
      content: sanitizeText(content),
      tag,
      images,
      contact: sanitizeText(contact),
      status: 'disponible',
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, MARKETPLACE_COLLECTION), cleanFirestoreData(postData));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, MARKETPLACE_COLLECTION);
    throw error;
  }
}

export async function updatePostStatus(
  postId: string, 
  status: 'disponible' | 'reservado' | 'entregado/resuelto' | 'vencido'
): Promise<void> {
  if (!auth.currentUser) throw new Error('User must be authenticated');
  
  try {
    const postRef = doc(db, MARKETPLACE_COLLECTION, postId);
    await updateDoc(postRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${MARKETPLACE_COLLECTION}/${postId}`);
    throw error;
  }
}

export function subscribeToMarketplace(callback: (posts: MarketplacePost[]) => void) {
  const q = query(collection(db, MARKETPLACE_COLLECTION), orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MarketplacePost));
    callback(posts);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, MARKETPLACE_COLLECTION);
  });
}

/**
 * Deletes a marketplace post (Admin only).
 */
export async function deleteMarketplacePost(postId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, MARKETPLACE_COLLECTION, postId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${MARKETPLACE_COLLECTION}/${postId}`);
    throw error;
  }
}

/**
 * Cancels a marketplace post (User owned).
 */
export async function cancelMarketplacePost(postId: string): Promise<void> {
  try {
    await updateDoc(doc(db, MARKETPLACE_COLLECTION, postId), {
      status: 'vencido'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${MARKETPLACE_COLLECTION}/${postId}`);
    throw error;
  }
}

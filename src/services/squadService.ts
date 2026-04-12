import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot,
  arrayUnion,
  arrayRemove,
  Timestamp
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, cleanFirestoreData } from '../firebase';
import { Squad } from '../types';
import { sanitizeText } from '../lib/utils';

const SQUADS_COLLECTION = 'squads';

export async function createSquad(
  title: string,
  description: string,
  date: string,
  time: string,
  location: string,
  maxParticipants?: number
): Promise<string> {
  if (!auth.currentUser) throw new Error('User must be authenticated');

  const uid = auth.currentUser.uid;
  
  try {
    const squadData = {
      title: sanitizeText(title),
      description: sanitizeText(description),
      date,
      time,
      location: sanitizeText(location),
      attendees: [uid],
      createdBy: uid,
      createdAt: serverTimestamp(),
      status: 'próxima',
      maxParticipants: maxParticipants || null
    };

    const docRef = await addDoc(collection(db, SQUADS_COLLECTION), cleanFirestoreData(squadData));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, SQUADS_COLLECTION);
    throw error;
  }
}

export async function toggleSquadAttendance(squadId: string, isAttending: boolean): Promise<void> {
  if (!auth.currentUser) throw new Error('User must be authenticated');
  const uid = auth.currentUser.uid;
  const email = auth.currentUser.email;

  try {
    const squadRef = doc(db, SQUADS_COLLECTION, squadId);
    await updateDoc(squadRef, {
      attendees: isAttending ? arrayRemove(uid) : arrayUnion(uid)
    });

    // Mock Email Confirmation
    if (!isAttending && email) {
      console.log(`[SIMULACIÓN EMAIL] Enviando confirmación de inscripción a ${email} para la cuadrilla ${squadId}`);
      // En una app real, aquí llamaríamos a una Cloud Function o servicio de email (SendGrid, etc.)
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SQUADS_COLLECTION}/${squadId}`);
    throw error;
  }
}

export async function cancelSquad(squadId: string): Promise<void> {
  if (!auth.currentUser) throw new Error('User must be authenticated');
  
  try {
    const squadRef = doc(db, SQUADS_COLLECTION, squadId);
    await updateDoc(squadRef, {
      status: 'cancelada',
      updatedAt: serverTimestamp()
    });
    
    console.log(`[SIMULACIÓN NOTIFICACIÓN] Notificando a todos los asistentes que la cuadrilla ${squadId} ha sido cancelada.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SQUADS_COLLECTION}/${squadId}`);
    throw error;
  }
}

export async function deleteSquad(squadId: string): Promise<void> {
  if (!auth.currentUser) throw new Error('User must be authenticated');
  
  try {
    const squadRef = doc(db, SQUADS_COLLECTION, squadId);
    await deleteDoc(squadRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${SQUADS_COLLECTION}/${squadId}`);
    throw error;
  }
}

export async function updateSquad(squadId: string, updates: Partial<Squad>): Promise<void> {
  if (!auth.currentUser) throw new Error('User must be authenticated');
  
  try {
    const squadRef = doc(db, SQUADS_COLLECTION, squadId);
    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.title) sanitizedUpdates.title = sanitizeText(sanitizedUpdates.title);
    if (sanitizedUpdates.description) sanitizedUpdates.description = sanitizeText(sanitizedUpdates.description);
    if (sanitizedUpdates.location) sanitizedUpdates.location = sanitizeText(sanitizedUpdates.location);

    await updateDoc(squadRef, cleanFirestoreData({
      ...sanitizedUpdates,
      updatedAt: serverTimestamp()
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SQUADS_COLLECTION}/${squadId}`);
    throw error;
  }
}

export async function updateSquadStatus(squadId: string, status: 'próxima' | 'completa' | 'finalizada'): Promise<void> {
  try {
    const squadRef = doc(db, SQUADS_COLLECTION, squadId);
    await updateDoc(squadRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SQUADS_COLLECTION}/${squadId}`);
    throw error;
  }
}

export function subscribeToSquads(callback: (squads: Squad[]) => void) {
  const q = query(collection(db, SQUADS_COLLECTION), orderBy('date', 'asc'));

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

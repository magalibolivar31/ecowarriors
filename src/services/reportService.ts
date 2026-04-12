import { 
  collection, 
  addDoc, 
  updateDoc, 
  setDoc,
  doc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  writeBatch,
  increment,
  getDoc,
  getDocs,
  collectionGroup
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage, auth, handleFirestoreError, OperationType, cleanFirestoreData } from '../firebase';
import { Report, ReportUpdate, ReportStatus, ReportType, ReportLocation } from '../types';
import {
  normalizeReportLocation,
  normalizeReportStatus,
  isValidReportStatus,
  isActiveReportStatus,
} from '../lib/reportNormalization';
import { sanitizeText } from '../lib/utils';

const REPORTS_COLLECTION = 'reports';
const EMERGENCY_REPORTS_COLLECTION = 'emergency_reports';
const UPDATES_SUBCOLLECTION = 'updates';

/**
 * Normalizes all existing reports to ensure they have valid coordinates and status.
 */
export async function normalizeAllReports(): Promise<void> {
  try {
    const reportsRef = collection(db, REPORTS_COLLECTION);
    const snapshot = await getDocs(reportsRef);
    const batch = writeBatch(db);
    let count = 0;

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data() as any;
      let needsUpdate = false;
      const updateData: any = {};

      // 1. Normalize Location (Unified Source of Truth: Coordinates)
      const hasValidCoords = data.location && 
                             typeof data.location.lat === 'number' && 
                             typeof data.location.lng === 'number' &&
                             Number.isFinite(data.location.lat) &&
                             Number.isFinite(data.location.lng);

      if (!hasValidCoords) {
        // If no valid coordinates, but we have address, we could try to geocode,
        // but the user requested NOT to depend on reverse geocoding and to remove address.
        // We will just ensure the location object exists with 0,0 if invalid.
        updateData.location = {
          lat: data.location?.lat || 0,
          lng: data.location?.lng || 0
        };
        needsUpdate = true;
      } else if (data.location && 'address' in data.location) {
        // Remove address field if it exists
        updateData.location = {
          lat: data.location.lat,
          lng: data.location.lng
        };
        needsUpdate = true;
      }

      // 2. Normalize Status (Abierto / Resuelto)
      const currentStatus = data.currentStatus;
      
      if (!isValidReportStatus(currentStatus)) {
        const normalizedStatus = normalizeReportStatus(currentStatus);
        updateData.currentStatus = normalizedStatus;
        updateData.isActive = isActiveReportStatus(normalizedStatus);
        needsUpdate = true;
      } else {
        // Ensure isActive matches currentStatus
        const shouldBeActive = isActiveReportStatus(currentStatus);
        if (data.isActive !== shouldBeActive) {
          updateData.isActive = shouldBeActive;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        batch.update(docSnapshot.ref, updateData);
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
      console.log(`[EcoWarriors] Normalización completada: ${count} reportes actualizados.`);
    }
  } catch (error) {
    console.error("[EcoWarriors] Error durante la normalización de reportes:", error);
  }
}

/**
 * Uploads a base64 image to Firebase Storage and returns the download URL.
 */
async function uploadImage(base64: string, path: string): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadString(storageRef, base64, 'data_url');
  return await getDownloadURL(storageRef);
}

/**
 * Awards XP to a user and updates their level if necessary.
 */
async function awardXP(uid: string, amount: number): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    let currentXP = amount;
    let currentLevel = 1;

    if (userDoc.exists()) {
      const userData = userDoc.data();
      currentXP = (userData.xp || 0) + amount;
      currentLevel = Math.floor(currentXP / 100) + 1;
    } else {
      currentLevel = Math.floor(amount / 100) + 1;
    }

    await setDoc(userRef, {
      xp: currentXP,
      level: currentLevel
    }, { merge: true });
  } catch (error) {
    console.error("Error awarding XP:", error);
  }
}

/**
 * Creates a new report with an initial update.
 */
export async function createReport(
  type: ReportType,
  title: string,
  description: string,
  location: ReportLocation,
  imageBase64?: string | null,
  aiAnalysis?: any
): Promise<string> {
  if (!auth.currentUser) throw new Error('User must be authenticated');

  // Strict coordinate validation
  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number' || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    throw new Error('Las coordenadas (latitud y longitud) son obligatorias para crear un reporte.');
  }

  const uid = auth.currentUser.uid;
  const userName = auth.currentUser.displayName || 'Usuario EcoWarrior';
  const timestamp = serverTimestamp();

  try {
    // 1. Upload initial image if provided
    let initialImageUrl: string | null = null;
    if (imageBase64) {
      const imagePath = `reports/${Date.now()}_initial.jpg`;
      initialImageUrl = await uploadImage(imageBase64, imagePath);
    }

    // 2. Create base report document
    const sanitizedAiAnalysis = aiAnalysis ? {
      ...aiAnalysis,
      analisis: aiAnalysis.analisis ? sanitizeText(aiAnalysis.analisis) : aiAnalysis.analisis
    } : null;

    const reportData = {
      type,
      title: sanitizeText(title),
      description: sanitizeText(description),
      location,
      createdAt: timestamp,
      createdBy: uid,
      createdByName: userName,
      initialImageUrl,
      currentStatus: 'Abierto (nuevo)' as ReportStatus,
      isActive: true,
      aiAnalysis: sanitizedAiAnalysis
    };

    const reportRef = await addDoc(collection(db, REPORTS_COLLECTION), cleanFirestoreData(reportData));

    // 3. Create first update automatically
    const updateData = {
      createdAt: timestamp,
      createdBy: uid,
      createdByName: userName,
      description: 'Reporte creado inicialmente.',
      newStatus: 'Abierto (nuevo)' as ReportStatus,
      imageUrl: null
    };

    await addDoc(collection(db, REPORTS_COLLECTION, reportRef.id, UPDATES_SUBCOLLECTION), cleanFirestoreData(updateData));

    // 4. Award XP for creating a report
    await awardXP(uid, 50);

    return reportRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, REPORTS_COLLECTION);
    throw error;
  }
}

/**
 * Adds a new update to an existing report.
 */
export async function addReportUpdate(
  reportId: string,
  description: string,
  newStatus: ReportStatus,
  imageBase64?: string | null
): Promise<void> {
  if (!auth.currentUser) throw new Error('User must be authenticated');

  const uid = auth.currentUser.uid;
  const userName = auth.currentUser.displayName || 'Usuario EcoWarrior';
  const timestamp = serverTimestamp();

  console.log(`[reportService] Agregando actualización a reporte ${reportId}. Nuevo estado: ${newStatus}`);

  try {
    let imageUrl = null;
    if (imageBase64) {
      const imagePath = `reports/${reportId}/updates/${Date.now()}.jpg`;
      imageUrl = await uploadImage(imageBase64, imagePath);
    }

    // Determine which collection the report belongs to
    let collectionName = REPORTS_COLLECTION;
    let reportRef = doc(db, REPORTS_COLLECTION, reportId);
    let reportDoc = await getDoc(reportRef);

    if (!reportDoc.exists()) {
      collectionName = EMERGENCY_REPORTS_COLLECTION;
      reportRef = doc(db, EMERGENCY_REPORTS_COLLECTION, reportId);
      reportDoc = await getDoc(reportRef);
    }

    if (!reportDoc.exists()) {
      throw new Error(`Reporte ${reportId} no encontrado en ninguna colección.`);
    }

    const batch = writeBatch(db);

    // 1. Create update document
    const updateRef = doc(collection(db, collectionName, reportId, UPDATES_SUBCOLLECTION));
    batch.set(updateRef, {
      createdAt: timestamp,
      createdBy: uid,
      createdByName: userName,
      description: sanitizeText(description),
      newStatus,
      imageUrl
    });

    // 2. Update parent report status and isActive flag
    const isResolved = newStatus === 'Resuelto' || newStatus === 'Cancelado';
    
    batch.update(reportRef, {
      currentStatus: newStatus,
      isActive: !isResolved,
      updatedAt: timestamp
    });

    await batch.commit();
    console.log(`[reportService] Actualización exitosa para reporte ${reportId} en ${collectionName}`);

    // 3. Award XP for updating a report
    let xpAmount = 20;
    if (isResolved) xpAmount += 100;
    await awardXP(uid, xpAmount);
  } catch (error) {
    console.error(`[reportService] Error agregando actualización a reporte ${reportId}:`, error);
    handleFirestoreError(error, OperationType.UPDATE, `reports_or_emergency/${reportId}`);
    throw error;
  }
}

/**
 * Subscribes to all reports (active and resolved) from both reports and emergency_reports collections.
 */
export function subscribeToAllReports(callback: (reports: Report[]) => void) {
  let reportsData: Report[] = [];
  let emergencyData: Report[] = [];

  const updateAndNotify = () => {
    const combined = [...reportsData, ...emergencyData];
    combined.sort((a, b) => {
      const timeA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });
    callback(combined);
  };

  const unsubReports = onSnapshot(collection(db, REPORTS_COLLECTION), (snapshot) => {
    reportsData = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        location: normalizeReportLocation(data),
        currentStatus: normalizeReportStatus(data.currentStatus),
        isActive: data.isActive !== undefined ? data.isActive : isActiveReportStatus(normalizeReportStatus(data.currentStatus)),
      } as Report;
    });
    updateAndNotify();
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, REPORTS_COLLECTION);
  });

  const unsubEmergency = onSnapshot(collection(db, EMERGENCY_REPORTS_COLLECTION), (snapshot) => {
    emergencyData = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        type: 'crisis', // Force crisis type for emergency reports
        location: normalizeReportLocation(data),
        currentStatus: normalizeReportStatus(data.currentStatus),
        isActive: data.isActive !== undefined ? data.isActive : isActiveReportStatus(normalizeReportStatus(data.currentStatus)),
      } as Report;
    });
    updateAndNotify();
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, EMERGENCY_REPORTS_COLLECTION);
  });

  return () => {
    unsubReports();
    unsubEmergency();
  };
}

/**
 * Subscribes to active reports from both collections.
 */
export function subscribeToActiveReports(callback: (reports: Report[]) => void) {
  let reportsData: Report[] = [];
  let emergencyData: Report[] = [];

  const updateAndNotify = () => {
    const combined = [...reportsData, ...emergencyData];
    combined.sort((a, b) => {
      const timeA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });
    callback(combined);
  };

  const qReports = query(collection(db, REPORTS_COLLECTION), where('isActive', '==', true));
  const unsubReports = onSnapshot(qReports, (snapshot) => {
    reportsData = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        location: normalizeReportLocation(data),
      } as Report;
    });
    updateAndNotify();
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, REPORTS_COLLECTION);
  });

  const qEmergency = query(collection(db, EMERGENCY_REPORTS_COLLECTION), where('isActive', '==', true));
  const unsubEmergency = onSnapshot(qEmergency, (snapshot) => {
    emergencyData = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        type: 'crisis',
        location: normalizeReportLocation(data),
      } as Report;
    });
    updateAndNotify();
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, EMERGENCY_REPORTS_COLLECTION);
  });

  return () => {
    unsubReports();
    unsubEmergency();
  };
}

/**
 * Subscribes to updates for a specific report.
 */
export function subscribeToReportUpdates(reportId: string, callback: (updates: ReportUpdate[]) => void) {
  // Try reports collection first, then emergency_reports if not found
  // For simplicity in this implementation, we'll check both or assume we know which one it is.
  // In a real app, we might want to pass the collection name or have a unified updates collection.
  const q = query(
    collection(db, REPORTS_COLLECTION, reportId, UPDATES_SUBCOLLECTION),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      const updates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ReportUpdate));
      callback(updates);
    } else {
      // Try emergency reports
      const qEmergency = query(
        collection(db, EMERGENCY_REPORTS_COLLECTION, reportId, UPDATES_SUBCOLLECTION),
        orderBy('createdAt', 'asc')
      );
      onSnapshot(qEmergency, (snap) => {
        const updates = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ReportUpdate));
        callback(updates);
      });
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `${REPORTS_COLLECTION}/${reportId}/${UPDATES_SUBCOLLECTION}`);
  });
}

/**
 * Subscribes to all updates across all reports using collectionGroup.
 */
export function subscribeToAllUpdates(callback: (updates: ReportUpdate[]) => void) {
  const q = query(collectionGroup(db, UPDATES_SUBCOLLECTION), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const updates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ReportUpdate));
    callback(updates);
  }, (error) => {
    // Collection group queries might require an index. 
    // If it fails, we'll log it but not crash.
    console.error("Error in subscribeToAllUpdates (might need index):", error);
  });
}

/**
 * Deletes a report (Admin only).
 */
export async function deleteReport(reportId: string, type: ReportType): Promise<void> {
  const deleteReportCollectionData = async (collectionName: string): Promise<void> => {
    const updatesRef = collection(db, collectionName, reportId, UPDATES_SUBCOLLECTION);
    const updatesSnapshot = await getDocs(updatesRef);
    const batch = writeBatch(db);

    updatesSnapshot.docs.forEach((updateDocSnapshot) => {
      batch.delete(updateDocSnapshot.ref);
    });

    batch.delete(doc(db, collectionName, reportId));
    await batch.commit();
  };

  try {
    const collectionName = (type === 'crisis') ? EMERGENCY_REPORTS_COLLECTION : REPORTS_COLLECTION;
    await deleteReportCollectionData(collectionName);
    console.log(`Reporte ${reportId} eliminado de ${collectionName}`);
  } catch (error) {
    try {
      const fallbackCollection = (type === 'crisis') ? REPORTS_COLLECTION : EMERGENCY_REPORTS_COLLECTION;
      await deleteReportCollectionData(fallbackCollection);
      console.log(`Reporte ${reportId} eliminado de ${fallbackCollection} (fallback)`);
    } catch (fallbackError) {
      console.error('Error eliminando reporte en ambas colecciones:', fallbackError);
      handleFirestoreError(fallbackError, OperationType.DELETE, `reports_or_emergency/${reportId}`);
      throw fallbackError;
    }
  }
}

/**
 * Cancels a report (User owned).
 */
export async function cancelReport(
  reportId: string, 
  type: ReportType, 
  userId: string, 
  userName: string
): Promise<void> {
  const collectionName = (type === 'crisis') ? EMERGENCY_REPORTS_COLLECTION : REPORTS_COLLECTION;
  
  try {
    const timestamp = serverTimestamp();

    // 1. Registrar en historial para trazabilidad
    await addDoc(
      collection(db, collectionName, reportId, UPDATES_SUBCOLLECTION),
      {
        createdAt: timestamp,
        createdBy: userId,
        createdByName: userName,
        description: 'Reporte cancelado por el autor.',
        newStatus: 'Cargado por error',
        imageUrl: null
      }
    );

    // 2. Baja lógica: sacar del mapa y lista activa
    await updateDoc(doc(db, collectionName, reportId), {
      isActive: false,
      currentStatus: 'Cargado por error'
    });
  } catch (error) {
    // Fallback a la otra colección
    try {
      const fallback = (type === 'crisis') ? REPORTS_COLLECTION : EMERGENCY_REPORTS_COLLECTION;
      const timestamp = serverTimestamp();

      await addDoc(
        collection(db, fallback, reportId, UPDATES_SUBCOLLECTION),
        {
          createdAt: timestamp,
          createdBy: userId,
          createdByName: userName,
          description: 'Reporte cancelado por el autor.',
          newStatus: 'Cargado por error',
          imageUrl: null
        }
      );

      await updateDoc(doc(db, fallback, reportId), {
        isActive: false,
        currentStatus: 'Cargado por error'
      });
    } catch (fallbackError) {
      console.error('Error en cancelReport fallback:', fallbackError);
      handleFirestoreError(fallbackError, OperationType.UPDATE, `reports_or_emergency/${reportId}`);
      throw fallbackError;
    }
  }
}

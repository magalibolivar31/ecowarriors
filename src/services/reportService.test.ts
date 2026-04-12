import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => {
  class MockTimestamp {
    private readonly value: number;
    constructor(value: number) {
      this.value = value;
    }
    toMillis() {
      return this.value;
    }
  }

  return {
    collection: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    setDoc: vi.fn(),
    doc: vi.fn(),
    deleteDoc: vi.fn(),
    serverTimestamp: vi.fn(() => 'ts'),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn(),
    Timestamp: MockTimestamp,
    writeBatch: vi.fn(),
    increment: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    collectionGroup: vi.fn(),
  };
});

const storageMocks = vi.hoisted(() => ({
  ref: vi.fn(),
  uploadString: vi.fn(),
  getDownloadURL: vi.fn(),
}));

const firebaseMocks = vi.hoisted(() => ({
  db: {},
  storage: {},
  auth: {
    currentUser: { uid: 'user-1', displayName: 'Eco' } as
      | { uid: string; displayName?: string | null }
      | null,
  },
  handleFirestoreError: vi.fn(),
  cleanFirestoreData: vi.fn((value: unknown) => value),
  OperationType: {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LIST: 'list',
  },
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('firebase/storage', () => storageMocks);
vi.mock('../firebase', () => firebaseMocks);

import {
  addReportUpdate,
  cancelReport,
  createReport,
  deleteReport,
  normalizeAllReports,
  subscribeToActiveReports,
  subscribeToAllReports,
  subscribeToAllUpdates,
  subscribeToReportUpdates,
} from './reportService';

describe('reportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseMocks.auth.currentUser = { uid: 'user-1', displayName: 'Eco' };

    firestoreMocks.collection.mockImplementation((_db: unknown, ...segments: string[]) =>
      segments.join('/'),
    );
    firestoreMocks.doc.mockImplementation((_db: unknown, ...segments: string[]) =>
      segments.join('/'),
    );
    firestoreMocks.query.mockImplementation((...args: unknown[]) => args);
    firestoreMocks.where.mockImplementation((...args: unknown[]) => args);
    firestoreMocks.orderBy.mockImplementation((...args: unknown[]) => args);
    firestoreMocks.collectionGroup.mockImplementation((_db: unknown, name: string) => name);
  });

  // --- createReport ---

  it('createReport falla si no hay usuario autenticado', async () => {
    firebaseMocks.auth.currentUser = null;

    await expect(
      createReport('ambiental', 'Título', 'Descripción', { lat: -34.6, lng: -58.4 }),
    ).rejects.toThrow('User must be authenticated');
  });

  it('createReport valida coordenadas obligatorias', async () => {
    await expect(
      createReport('ambiental', 'Título', 'Descripción', { lat: Number.NaN, lng: -58.4 } as any),
    ).rejects.toThrow('Las coordenadas (latitud y longitud) son obligatorias para crear un reporte.');
  });

  it('createReport crea reporte sin imagen ni análisis de IA', async () => {
    firestoreMocks.addDoc.mockResolvedValue({ id: 'report-1' });
    firestoreMocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ xp: 100, level: 2 }) });
    firestoreMocks.setDoc.mockResolvedValue(undefined);

    const id = await createReport('ambiental', 'Título', 'Descripción', { lat: -34.6, lng: -58.4 });

    expect(id).toBe('report-1');
    expect(firestoreMocks.addDoc).toHaveBeenCalledTimes(2);
    expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1);
  });

  it('awardXP maneja error silenciosamente', async () => {
    firestoreMocks.addDoc.mockResolvedValue({ id: 'report-x' });
    firestoreMocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ xp: 50 }) });
    firestoreMocks.setDoc.mockRejectedValueOnce(new Error('setDoc fail'));

    // createReport internally calls awardXP which calls setDoc and should not throw
    await expect(
      createReport('ambiental', 'Título', 'Descripción', { lat: -34.6, lng: -58.4 }),
    ).resolves.toBeDefined();
  });

  it('createReport sube imagen si se provee base64', async () => {
    storageMocks.ref.mockReturnValue('storage-ref');
    storageMocks.uploadString.mockResolvedValue(undefined);
    storageMocks.getDownloadURL.mockResolvedValue('https://cdn/img.jpg');
    firestoreMocks.addDoc.mockResolvedValue({ id: 'report-2' });
    firestoreMocks.getDoc.mockResolvedValue({ exists: () => false });
    firestoreMocks.setDoc.mockResolvedValue(undefined);

    const id = await createReport(
      'ambiental',
      'Título',
      'Descripción',
      { lat: -34.6, lng: -58.4 },
      'data:image/jpeg;base64,abc123',
    );

    expect(id).toBe('report-2');
    expect(storageMocks.uploadString).toHaveBeenCalledTimes(1);
    expect(storageMocks.getDownloadURL).toHaveBeenCalledTimes(1);
  });

  it('createReport incluye análisis de IA sanitizado', async () => {
    firestoreMocks.addDoc.mockResolvedValue({ id: 'report-3' });
    firestoreMocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ xp: 50, level: 1 }) });
    firestoreMocks.setDoc.mockResolvedValue(undefined);

    const id = await createReport(
      'ambiental',
      'Título',
      'Descripción',
      { lat: -34.6, lng: -58.4 },
      null,
      { analisis: '<b>Contaminación</b>', nivelUrgencia: 4 },
    );

    expect(id).toBe('report-3');
    expect(firestoreMocks.addDoc).toHaveBeenNthCalledWith(
      1,
      'reports',
      expect.objectContaining({
        aiAnalysis: { analisis: 'Contaminación', nivelUrgencia: 4 },
      }),
    );
  });

  it('awardXP acumula XP correctamente cuando userData.xp es undefined', async () => {
    firestoreMocks.addDoc.mockResolvedValue({ id: 'report-xp' });
    firestoreMocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ xp: undefined }) });
    firestoreMocks.setDoc.mockResolvedValue(undefined);

    const id = await createReport('ambiental', 'Título', 'Descripción', { lat: -34.6, lng: -58.4 });

    expect(id).toBe('report-xp');
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      'users/user-1',
      expect.objectContaining({ xp: 50 }),
      { merge: true },
    );
  });

  it('createReport usa displayName por defecto y sanitiza aiAnalysis.analisis null', async () => {
    firebaseMocks.auth.currentUser = { uid: 'user-1', displayName: null };
    firestoreMocks.addDoc.mockResolvedValue({ id: 'report-4' });
    firestoreMocks.getDoc.mockResolvedValue({ exists: () => false });
    firestoreMocks.setDoc.mockResolvedValue(undefined);

    const id = await createReport(
      'ambiental',
      'Título',
      'Descripción',
      { lat: -34.6, lng: -58.4 },
      null,
      { analisis: null, nivelUrgencia: 2 },
    );

    expect(id).toBe('report-4');
    expect(firestoreMocks.addDoc).toHaveBeenNthCalledWith(
      1,
      'reports',
      expect.objectContaining({
        createdByName: 'Usuario EcoWarrior',
        aiAnalysis: { analisis: null, nivelUrgencia: 2 },
      }),
    );
  });

  it('createReport propaga error de Firestore', async () => {
    firestoreMocks.addDoc.mockRejectedValueOnce(new Error('firestore fail'));

    await expect(
      createReport('ambiental', 'Título', 'Descripción', { lat: -34.6, lng: -58.4 }),
    ).rejects.toThrow('firestore fail');
    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });

  // --- addReportUpdate ---

  it('addReportUpdate falla si no hay usuario', async () => {
    firebaseMocks.auth.currentUser = null;
    await expect(addReportUpdate('r1', 'desc', 'Resuelto')).rejects.toThrow(
      'User must be authenticated',
    );
  });

  it('addReportUpdate actualiza reporte en colección principal (no resuelto)', async () => {
    const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    firestoreMocks.writeBatch.mockReturnValue(batch);
    firestoreMocks.getDoc
      .mockResolvedValueOnce({ exists: () => true })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ xp: 20 }) });
    firestoreMocks.setDoc.mockResolvedValue(undefined);
    firestoreMocks.doc.mockReturnValue('doc-ref');

    await addReportUpdate('r1', 'nueva actualización', 'Abierto (en seguimiento)');

    expect(batch.set).toHaveBeenCalledTimes(1);
    expect(batch.update).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({ currentStatus: 'Abierto (en seguimiento)', isActive: true }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('addReportUpdate usa displayName por defecto cuando es null', async () => {
    firebaseMocks.auth.currentUser = { uid: 'user-1', displayName: null };
    const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    firestoreMocks.writeBatch.mockReturnValue(batch);
    firestoreMocks.getDoc
      .mockResolvedValueOnce({ exists: () => true })
      .mockResolvedValueOnce({ exists: () => false });
    firestoreMocks.setDoc.mockResolvedValue(undefined);
    firestoreMocks.doc.mockReturnValue('doc-ref');

    await addReportUpdate('r1', 'descripción', 'Abierto (en seguimiento)');

    expect(batch.set).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({ createdByName: 'Usuario EcoWarrior' }),
    );
  });

  it('addReportUpdate otorga XP extra al resolver reporte', async () => {
    const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    firestoreMocks.writeBatch.mockReturnValue(batch);
    firestoreMocks.getDoc
      .mockResolvedValueOnce({ exists: () => true })
      .mockResolvedValueOnce({ exists: () => false });
    firestoreMocks.setDoc.mockResolvedValue(undefined);
    firestoreMocks.doc.mockReturnValue('doc-ref');

    await addReportUpdate('r1', 'Resuelto finalmente', 'Resuelto');

    expect(batch.update).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({ isActive: false }),
    );
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({ xp: 120 }),
      { merge: true },
    );
  });

  it('addReportUpdate sube imagen si se provee', async () => {
    const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    firestoreMocks.writeBatch.mockReturnValue(batch);
    firestoreMocks.getDoc
      .mockResolvedValueOnce({ exists: () => true })
      .mockResolvedValueOnce({ exists: () => false });
    firestoreMocks.setDoc.mockResolvedValue(undefined);
    firestoreMocks.doc.mockReturnValue('doc-ref');
    storageMocks.ref.mockReturnValue('storage-ref');
    storageMocks.uploadString.mockResolvedValue(undefined);
    storageMocks.getDownloadURL.mockResolvedValue('https://cdn/update.jpg');

    await addReportUpdate('r1', 'Con foto', 'Abierto (en seguimiento)', 'data:image/jpeg;base64,xyz');

    expect(storageMocks.uploadString).toHaveBeenCalledTimes(1);
    expect(storageMocks.getDownloadURL).toHaveBeenCalledTimes(1);
  });

  it('addReportUpdate busca en emergency_reports si no está en primary', async () => {
    const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    firestoreMocks.writeBatch.mockReturnValue(batch);
    firestoreMocks.getDoc
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce({ exists: () => true })
      .mockResolvedValueOnce({ exists: () => false });
    firestoreMocks.setDoc.mockResolvedValue(undefined);
    firestoreMocks.doc.mockReturnValue('doc-ref');

    await addReportUpdate('r1', 'desc', 'Resuelto');

    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('addReportUpdate lanza error si reporte no existe en ninguna colección', async () => {
    firestoreMocks.getDoc
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce({ exists: () => false });
    firestoreMocks.doc.mockReturnValue('doc-ref');

    await expect(addReportUpdate('r1', 'desc', 'Abierto (en seguimiento)')).rejects.toThrow(
      'Reporte r1 no encontrado en ninguna colección.',
    );
    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });

  // --- deleteReport ---

  it('deleteReport elimina en colección principal cuando funciona', async () => {
    await deleteReport('r1', 'ambiental');
    expect(firestoreMocks.deleteDoc).toHaveBeenCalledWith('reports/r1');
  });

  it('deleteReport usa fallback de colección cuando falla el primer intento', async () => {
    firestoreMocks.deleteDoc.mockRejectedValueOnce(new Error('primary fail')).mockResolvedValueOnce(
      undefined,
    );

    await deleteReport('r1', 'crisis');

    expect(firestoreMocks.deleteDoc).toHaveBeenNthCalledWith(1, 'emergency_reports/r1');
    expect(firestoreMocks.deleteDoc).toHaveBeenNthCalledWith(2, 'reports/r1');
  });

  it('deleteReport reporta error si fallan ambos intentos', async () => {
    firestoreMocks.deleteDoc
      .mockRejectedValueOnce(new Error('primary fail'))
      .mockRejectedValueOnce(new Error('fallback fail'));

    await expect(deleteReport('r1', 'ambiental')).rejects.toThrow('fallback fail');
    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });

  // --- cancelReport ---

  it('cancelReport registra update y desactiva reporte', async () => {
    await cancelReport('r1', 'ambiental', 'user-1', 'Eco');

    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(
      'reports/r1/updates',
      expect.objectContaining({
        createdBy: 'user-1',
        createdByName: 'Eco',
        newStatus: 'Cargado por error',
      }),
    );
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('reports/r1', {
      isActive: false,
      currentStatus: 'Cargado por error',
    });
  });

  it('cancelReport usa fallback de colección al fallar el primero', async () => {
    firestoreMocks.addDoc.mockRejectedValueOnce(new Error('main fail')).mockResolvedValueOnce(
      undefined,
    );

    await cancelReport('r1', 'crisis', 'user-1', 'Eco');

    expect(firestoreMocks.addDoc).toHaveBeenNthCalledWith(
      2,
      'reports/r1/updates',
      expect.any(Object),
    );
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('reports/r1', {
      isActive: false,
      currentStatus: 'Cargado por error',
    });
  });

  it('cancelReport lanza error si fallan ambas colecciones', async () => {
    firestoreMocks.addDoc
      .mockRejectedValueOnce(new Error('primary fail'))
      .mockRejectedValueOnce(new Error('fallback fail'));

    await expect(cancelReport('r1', 'ambiental', 'user-1', 'Eco')).rejects.toThrow('fallback fail');
    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });

  // --- normalizeAllReports ---

  it('normalizeAllReports normaliza ubicación y estado inválido', async () => {
    const batch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };

    firestoreMocks.getDocs.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            location: {},
            currentStatus: 'estado-invalido',
          }),
          ref: 'doc-ref-1',
        },
      ],
    });
    firestoreMocks.writeBatch.mockReturnValueOnce(batch);

    await normalizeAllReports();

    expect(batch.update).toHaveBeenCalledWith(
      'doc-ref-1',
      expect.objectContaining({
        location: { lat: 0, lng: 0 },
        currentStatus: 'Abierto (nuevo)',
        isActive: true,
      }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('normalizeAllReports elimina campo address cuando hay coords válidas', async () => {
    const batch = { update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    firestoreMocks.getDocs.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            location: { lat: -34.6, lng: -58.4, address: 'Calle Falsa 123' },
            currentStatus: 'Abierto (nuevo)',
            isActive: true,
          }),
          ref: 'doc-ref-2',
        },
      ],
    });
    firestoreMocks.writeBatch.mockReturnValueOnce(batch);

    await normalizeAllReports();

    expect(batch.update).toHaveBeenCalledWith(
      'doc-ref-2',
      expect.objectContaining({
        location: { lat: -34.6, lng: -58.4 },
      }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('normalizeAllReports corrige isActive inconsistente', async () => {
    const batch = { update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    firestoreMocks.getDocs.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            location: { lat: -34.6, lng: -58.4 },
            currentStatus: 'Resuelto',
            isActive: true,
          }),
          ref: 'doc-ref-3',
        },
      ],
    });
    firestoreMocks.writeBatch.mockReturnValueOnce(batch);

    await normalizeAllReports();

    expect(batch.update).toHaveBeenCalledWith(
      'doc-ref-3',
      expect.objectContaining({ isActive: false }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('normalizeAllReports no llama commit si no hay cambios', async () => {
    const batch = { update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    firestoreMocks.getDocs.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            location: { lat: -34.6, lng: -58.4 },
            currentStatus: 'Abierto (nuevo)',
            isActive: true,
          }),
          ref: 'doc-ref-4',
        },
      ],
    });
    firestoreMocks.writeBatch.mockReturnValueOnce(batch);

    await normalizeAllReports();

    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it('normalizeAllReports maneja error silenciosamente', async () => {
    firestoreMocks.getDocs.mockRejectedValueOnce(new Error('getDocs fail'));

    await expect(normalizeAllReports()).resolves.toBeUndefined();
  });

  // --- subscribeToAllReports ---

  it('subscribeToAllReports combina y ordena snapshots de ambas colecciones', () => {
    const callback = vi.fn();
    const unsubA = vi.fn();
    const unsubB = vi.fn();

    const MockTimestamp = firestoreMocks.Timestamp;

    firestoreMocks.onSnapshot
      .mockImplementationOnce((_col: unknown, onNext: Function) => {
        onNext({
          docs: [
            {
              id: 'r1',
              data: () => ({
                currentStatus: 'Abierto (nuevo)',
                isActive: true,
                createdAt: new MockTimestamp(2000),
                location: { lat: -34.6, lng: -58.4 },
              }),
            },
          ],
        });
        return unsubA;
      })
      .mockImplementationOnce((_col: unknown, onNext: Function) => {
        onNext({
          docs: [
            {
              id: 'e1',
              data: () => ({
                currentStatus: 'Abierto (nuevo)',
                isActive: true,
                createdAt: new MockTimestamp(3000),
                location: { lat: -34.7, lng: -58.5 },
              }),
            },
          ],
        });
        return unsubB;
      });

    const unsub = subscribeToAllReports(callback);

    expect(callback).toHaveBeenCalledTimes(2);
    const lastCall = callback.mock.calls[1][0];
    expect(lastCall[0].id).toBe('e1');
    expect(lastCall[1].id).toBe('r1');

    unsub();
    expect(unsubA).toHaveBeenCalledTimes(1);
    expect(unsubB).toHaveBeenCalledTimes(1);
  });

  it('subscribeToAllReports cubre rama isActive=undefined en emergency_reports', () => {
    const callback = vi.fn();
    const MockTimestamp = firestoreMocks.Timestamp;

    firestoreMocks.onSnapshot
      .mockImplementationOnce((_col: unknown, onNext: Function) => {
        onNext({
          docs: [
            {
              id: 'r-nonts',
              data: () => ({
                currentStatus: 'Abierto (nuevo)',
                isActive: true,
                createdAt: 1000,
                location: { lat: -34.6, lng: -58.4 },
              }),
            },
          ],
        });
        return vi.fn();
      })
      .mockImplementationOnce((_col: unknown, onNext: Function) => {
        onNext({
          docs: [
            {
              id: 'e2',
              data: () => ({
                currentStatus: 'Resuelto',
                // isActive intentionally omitted → undefined
                createdAt: new MockTimestamp(500),
                location: { lat: -34.6, lng: -58.4 },
              }),
            },
          ],
        });
        return vi.fn();
      });

    subscribeToAllReports(callback);

    const reports = callback.mock.calls[1][0];
    expect(reports[0].isActive).toBe(false);
    // The non-Timestamp doc (r-nonts) should sort before the Timestamp doc (e2) when timeB > timeA
    // r-nonts: timeA = 0 (not instanceof Timestamp), e2: timeB = 500 → e2 first
    expect(reports[0].id).toBe('e2');
  });

  it('subscribeToAllReports cubre rama sort con Timestamp como a y no-Timestamp como b', () => {
    const callback = vi.fn();
    const MockTimestamp = firestoreMocks.Timestamp;

    firestoreMocks.onSnapshot
      .mockImplementationOnce((_col: unknown, onNext: Function) => {
        onNext({
          docs: [
            {
              id: 'r-ts',
              data: () => ({
                currentStatus: 'Abierto (nuevo)',
                isActive: true,
                createdAt: new MockTimestamp(2000),
                location: { lat: -34.6, lng: -58.4 },
              }),
            },
          ],
        });
        return vi.fn();
      })
      .mockImplementationOnce((_col: unknown, onNext: Function) => {
        onNext({
          docs: [
            {
              id: 'e-nonts',
              data: () => ({
                currentStatus: 'Abierto (nuevo)',
                isActive: false,
                createdAt: 0,
                location: { lat: -34.7, lng: -58.5 },
              }),
            },
          ],
        });
        return vi.fn();
      });

    subscribeToAllReports(callback);

    // Sort compares (r-ts=TS2000, e-nonts=0): 303 TRUE, 304 FALSE
    // timeA = 2000 (TS), timeB = 0 (not TS) → timeB-timeA = -2000 < 0, r-ts stays first
    const reports = callback.mock.calls[1][0];
    expect(reports[0].id).toBe('r-ts');
  });

  it('subscribeToAllReports maneja errores de ambas colecciones', () => {
    const callback = vi.fn();

    firestoreMocks.onSnapshot
      .mockImplementationOnce((_col: unknown, _onNext: Function, onError: Function) => {
        onError(new Error('reports error'));
        return vi.fn();
      })
      .mockImplementationOnce((_col: unknown, _onNext: Function, onError: Function) => {
        onError(new Error('emergency error'));
        return vi.fn();
      });

    subscribeToAllReports(callback);

    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalledTimes(2);
    expect(callback).not.toHaveBeenCalled();
  });

  it('subscribeToAllReports normaliza datos de reportes (isActive undefined)', () => {
    const callback = vi.fn();

    firestoreMocks.onSnapshot
      .mockImplementationOnce((_col: unknown, onNext: Function) => {
        onNext({
          docs: [
            {
              id: 'r2',
              data: () => ({
                currentStatus: 'Resuelto',
                createdAt: 0,
                location: { lat: 0, lng: 0 },
              }),
            },
          ],
        });
        return vi.fn();
      })
      .mockImplementationOnce((_col: unknown, onNext: Function) => {
        onNext({ docs: [] });
        return vi.fn();
      });

    subscribeToAllReports(callback);

    const reports = callback.mock.calls[1][0];
    expect(reports[0].isActive).toBe(false);
  });

  // --- subscribeToActiveReports ---

  it('subscribeToActiveReports combina snapshots de ambas colecciones', () => {
    const callback = vi.fn();
    const unsubA = vi.fn();
    const unsubB = vi.fn();
    const MockTimestamp = firestoreMocks.Timestamp;

    firestoreMocks.onSnapshot
      .mockImplementationOnce((_q: unknown, onNext: Function) => {
        onNext({
          docs: [{ id: 'r1', data: () => ({ location: { lat: -34.6, lng: -58.4 }, createdAt: new MockTimestamp(1000) }) }],
        });
        return unsubA;
      })
      .mockImplementationOnce((_q: unknown, onNext: Function) => {
        onNext({
          docs: [{ id: 'e1', data: () => ({ location: { lat: -34.7, lng: -58.5 }, createdAt: 0 }) }],
        });
        return unsubB;
      });

    const unsub = subscribeToActiveReports(callback);

    expect(callback).toHaveBeenCalledTimes(2);
    const lastCall = callback.mock.calls[1][0];
    expect(lastCall.map((r: any) => r.id)).toContain('r1');
    expect(lastCall.map((r: any) => r.id)).toContain('e1');
    // r1 has Timestamp(1000) → toMillis() = 1000; e1 has 0 → : 0 branch → timeB=0; r1 first
    expect(lastCall[0].id).toBe('r1');

    unsub();
    expect(unsubA).toHaveBeenCalledTimes(1);
    expect(unsubB).toHaveBeenCalledTimes(1);
  });

  it('subscribeToActiveReports maneja errores', () => {
    const callback = vi.fn();

    firestoreMocks.onSnapshot
      .mockImplementationOnce((_q: unknown, _onNext: Function, onError: Function) => {
        onError(new Error('active reports error'));
        return vi.fn();
      })
      .mockImplementationOnce((_q: unknown, _onNext: Function, onError: Function) => {
        onError(new Error('active emergency error'));
        return vi.fn();
      });

    subscribeToActiveReports(callback);

    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalledTimes(2);
  });

  it('subscribeToActiveReports cubre rama sort non-Timestamp como a y Timestamp como b', () => {
    const callback = vi.fn();
    const MockTimestamp = firestoreMocks.Timestamp;

    firestoreMocks.onSnapshot
      .mockImplementationOnce((_q: unknown, onNext: Function) => {
        onNext({
          docs: [{ id: 'r-nonts', data: () => ({ location: { lat: -34.6, lng: -58.4 }, createdAt: 0 }) }],
        });
        return vi.fn();
      })
      .mockImplementationOnce((_q: unknown, onNext: Function) => {
        onNext({
          docs: [{ id: 'e-ts', data: () => ({ location: { lat: -34.7, lng: -58.5 }, createdAt: new MockTimestamp(2000) }) }],
        });
        return vi.fn();
      });

    subscribeToActiveReports(callback);

    // Sort compares (r-nonts=0, e-ts=TS2000): 359 FALSE, 360 TRUE
    // timeA=0, timeB=2000 → timeB-timeA=2000 > 0 → e-ts first
    const lastCall = callback.mock.calls[1][0];
    expect(lastCall[0].id).toBe('e-ts');
  });

  // --- subscribeToReportUpdates ---

  it('subscribeToReportUpdates devuelve updates si el snapshot no está vacío', () => {
    const callback = vi.fn();

    firestoreMocks.onSnapshot.mockImplementationOnce((_q: unknown, onNext: Function) => {
      onNext({
        empty: false,
        docs: [{ id: 'u1', data: () => ({ description: 'Update 1' }) }],
      });
      return vi.fn();
    });

    subscribeToReportUpdates('r1', callback);

    expect(callback).toHaveBeenCalledWith([{ id: 'u1', description: 'Update 1' }]);
  });

  it('subscribeToReportUpdates prueba emergency_reports si snapshot primario está vacío', () => {
    const callback = vi.fn();

    firestoreMocks.onSnapshot
      .mockImplementationOnce((_q: unknown, onNext: Function) => {
        onNext({ empty: true, docs: [] });
        return vi.fn();
      })
      .mockImplementationOnce((_q: unknown, onNext: Function) => {
        onNext({ docs: [{ id: 'u2', data: () => ({ description: 'Emergency update' }) }] });
        return vi.fn();
      });

    subscribeToReportUpdates('r1', callback);

    expect(callback).toHaveBeenCalledWith([{ id: 'u2', description: 'Emergency update' }]);
  });

  it('subscribeToReportUpdates maneja error', () => {
    const callback = vi.fn();

    firestoreMocks.onSnapshot.mockImplementationOnce(
      (_q: unknown, _onNext: Function, onError: Function) => {
        onError(new Error('updates error'));
        return vi.fn();
      },
    );

    subscribeToReportUpdates('r1', callback);

    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });

  // --- subscribeToAllUpdates ---

  it('subscribeToAllUpdates entrega updates del collectionGroup', () => {
    const callback = vi.fn();

    firestoreMocks.onSnapshot.mockImplementationOnce((_q: unknown, onNext: Function) => {
      onNext({
        docs: [
          { id: 'u1', data: () => ({ description: 'Update A' }) },
          { id: 'u2', data: () => ({ description: 'Update B' }) },
        ],
      });
      return vi.fn();
    });

    subscribeToAllUpdates(callback);

    expect(callback).toHaveBeenCalledWith([
      { id: 'u1', description: 'Update A' },
      { id: 'u2', description: 'Update B' },
    ]);
  });

  it('subscribeToAllUpdates loguea error sin relanzarlo', () => {
    const callback = vi.fn();

    firestoreMocks.onSnapshot.mockImplementationOnce(
      (_q: unknown, _onNext: Function, onError: Function) => {
        onError(new Error('collectionGroup error'));
        return vi.fn();
      },
    );

    expect(() => subscribeToAllUpdates(callback)).not.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });
});

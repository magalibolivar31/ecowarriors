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
  });

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

  it('addReportUpdate falla si no hay usuario', async () => {
    firebaseMocks.auth.currentUser = null;
    await expect(addReportUpdate('r1', 'desc', 'Resuelto')).rejects.toThrow(
      'User must be authenticated',
    );
  });

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
});

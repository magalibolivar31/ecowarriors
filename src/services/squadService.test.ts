import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: vi.fn(() => 'ts'),
  query: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  arrayUnion: vi.fn((value: unknown) => ({ op: 'arrayUnion', value })),
  arrayRemove: vi.fn((value: unknown) => ({ op: 'arrayRemove', value })),
}));

const firebaseMocks = vi.hoisted(() => ({
  db: {},
  auth: {
    currentUser: { uid: 'user-1', email: 'user@test.com' } as
      | { uid: string; email?: string | null }
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
vi.mock('../firebase', () => firebaseMocks);

import {
  cancelSquad,
  createSquad,
  deleteSquad,
  subscribeToSquads,
  toggleSquadAttendance,
  updateSquad,
  updateSquadStatus,
} from './squadService';

describe('squadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseMocks.auth.currentUser = { uid: 'user-1', email: 'user@test.com' };
    firestoreMocks.doc.mockReturnValue('doc-ref');
    firestoreMocks.collection.mockReturnValue('collection-ref');
    firestoreMocks.query.mockReturnValue('query-ref');
    firestoreMocks.orderBy.mockReturnValue('order-by-ref');
  });

  it('createSquad requiere usuario autenticado', async () => {
    firebaseMocks.auth.currentUser = null;
    await expect(createSquad('T', 'D', '2026-04-12', '10:00', 'Plaza')).rejects.toThrow(
      'User must be authenticated',
    );
  });

  it('createSquad sanitiza y guarda datos', async () => {
    firestoreMocks.addDoc.mockResolvedValueOnce({ id: 'squad-1' });

    const id = await createSquad(
      '<b>Limpieza Norte</b>',
      '  <i>Llevá guantes</i>  ',
      '2026-04-12',
      '10:00',
      '  <span>Plaza Central</span>  ',
      10,
    );

    expect(id).toBe('squad-1');
    expect(firestoreMocks.addDoc).toHaveBeenCalledWith('collection-ref', {
      title: 'Limpieza Norte',
      description: 'Llevá guantes',
      date: '2026-04-12',
      time: '10:00',
      location: 'Plaza Central',
      attendees: ['user-1'],
      createdBy: 'user-1',
      createdAt: 'ts',
      status: 'próxima',
      maxParticipants: 10,
    });
  });

  it('toggleSquadAttendance usa arrayRemove cuando ya asiste', async () => {
    await toggleSquadAttendance('squad-1', true);

    expect(firestoreMocks.arrayRemove).toHaveBeenCalledWith('user-1');
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('doc-ref', {
      attendees: { op: 'arrayRemove', value: 'user-1' },
    });
  });

  it('toggleSquadAttendance usa arrayUnion cuando no asiste', async () => {
    await toggleSquadAttendance('squad-1', false);

    expect(firestoreMocks.arrayUnion).toHaveBeenCalledWith('user-1');
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('doc-ref', {
      attendees: { op: 'arrayUnion', value: 'user-1' },
    });
  });

  it('cancelSquad marca estado cancelada', async () => {
    await cancelSquad('squad-1');
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('doc-ref', {
      status: 'cancelada',
      updatedAt: 'ts',
    });
  });

  it('updateSquad sanitiza campos editables', async () => {
    await updateSquad('squad-1', {
      title: '<b>Título</b>',
      description: '<i>Descripción</i>',
      location: ' <u>Ubicación</u> ',
    } as any);

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('doc-ref', {
      title: 'Título',
      description: 'Descripción',
      location: 'Ubicación',
      updatedAt: 'ts',
    });
  });

  it('updateSquadStatus actualiza solo status', async () => {
    await updateSquadStatus('squad-1', 'finalizada');
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('doc-ref', { status: 'finalizada' });
  });

  it('deleteSquad elimina documento', async () => {
    await deleteSquad('squad-1');
    expect(firestoreMocks.deleteDoc).toHaveBeenCalledWith('doc-ref');
  });

  it('subscribeToSquads transforma docs y devuelve unsubscribe', () => {
    const callback = vi.fn();
    const unsubscribe = vi.fn();

    firestoreMocks.onSnapshot.mockImplementationOnce((_query, onNext) => {
      onNext({
        docs: [
          {
            id: 'sq1',
            data: () => ({ title: 'Acción 1' }),
          },
        ],
      });
      return unsubscribe;
    });

    const unSub = subscribeToSquads(callback);

    expect(callback).toHaveBeenCalledWith([{ id: 'sq1', title: 'Acción 1' }]);
    expect(unSub).toBe(unsubscribe);
  });
});

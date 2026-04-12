import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

const firebaseMocks = vi.hoisted(() => ({
  db: { __type: 'db' },
  storage: { __type: 'storage' },
  auth: {
    currentUser: { uid: 'user-1' } as { uid: string } | null,
  },
  handleFirestoreError: vi.fn(),
  cleanFirestoreData: vi.fn((value: unknown) => value),
  OperationType: {
    GET: 'get',
    UPDATE: 'update',
  },
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('firebase/storage', () => storageMocks);
vi.mock('../firebase', () => firebaseMocks);

import {
  getUserProfile,
  getUserSettings,
  updateUserProfile,
  updateUserSettings,
  uploadProfilePhoto,
} from './userService';

describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseMocks.auth.currentUser = { uid: 'user-1' };
    firestoreMocks.doc.mockReturnValue('doc-ref');
  });

  it('getUserSettings devuelve null sin sesión', async () => {
    firebaseMocks.auth.currentUser = null;
    await expect(getUserSettings()).resolves.toBeNull();
    expect(firestoreMocks.getDoc).not.toHaveBeenCalled();
  });

  it('getUserSettings retorna datos cuando el documento existe', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ uid: 'user-1', onboardingCompleted: true }),
    });

    await expect(getUserSettings()).resolves.toEqual({
      uid: 'user-1',
      onboardingCompleted: true,
    });
  });

  it('updateUserSettings usa updateDoc si ya existe', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce({ exists: () => true });

    await updateUserSettings({ onboardingCompleted: true });

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('doc-ref', { onboardingCompleted: true });
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
  });

  it('updateUserSettings usa setDoc con defaults si no existe', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce({ exists: () => false });

    await updateUserSettings({ crisisRemindersEnabled: true } as any);

    expect(firestoreMocks.setDoc).toHaveBeenCalledWith('doc-ref', {
      uid: 'user-1',
      onboardingCompleted: false,
      crisisRemindersEnabled: true,
    });
  });

  it('updateUserProfile sanea texto antes de persistir', async () => {
    await updateUserProfile('user-1', {
      alias: '<b>Ana</b>',
      zone: '  <i>Palermo</i> ',
      commitment: '  javascript:alto  ',
      xp: 120,
    });

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('doc-ref', {
      alias: 'Ana',
      zone: 'Palermo',
      commitment: 'alto',
      xp: 120,
    });
  });

  it('getUserProfile devuelve null cuando falla getDoc', async () => {
    firestoreMocks.getDoc.mockRejectedValueOnce(new Error('fail'));
    await expect(getUserProfile('user-1')).resolves.toBeNull();
  });

  it('uploadProfilePhoto sube archivo, obtiene URL y actualiza perfil', async () => {
    const file = { name: 'avatar.jpg', type: 'image/jpeg' } as unknown as File;

    storageMocks.ref.mockReturnValue('storage-ref');
    storageMocks.uploadBytes.mockResolvedValueOnce(undefined);
    storageMocks.getDownloadURL.mockResolvedValueOnce('https://cdn/avatar.jpg');

    const result = await uploadProfilePhoto('user-1', file);

    expect(storageMocks.uploadBytes).toHaveBeenCalledWith('storage-ref', file);
    expect(result).toBe('https://cdn/avatar.jpg');
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('doc-ref', {
      photoURL: 'https://cdn/avatar.jpg',
    });
  });
});

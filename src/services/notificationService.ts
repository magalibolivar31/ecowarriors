// src/services/notificationService.ts

// Solicita permiso al usuario (llamar una sola vez al login)
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('[EcoWarriors] Browser does not support notifications');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch (e) {
    console.error('[EcoWarriors] Error requesting notification permission:', e);
    return false;
  }
}

// Muestra una notificación del sistema si el permiso fue otorgado
export function showNotification(title: string, body: string, icon = '/icon-192.png'): void {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  
  try {
    new Notification(title, { 
      body, 
      icon,
      badge: icon,
      tag: 'ecowarriors-notification'
    });
  } catch (e) {
    console.warn('[EcoWarriors] Notification failed:', e);
  }
}

// Eventos específicos donde disparar notificaciones:
export function notifyReportStatusChanged(reportTitle: string, newStatus: string): void {
  showNotification(
    'Actualización de Reporte',
    `El reporte "${reportTitle}" ha cambiado su estado a: ${newStatus}`
  );
}

export function notifySquadConfirmed(squadName: string): void {
  showNotification(
    'Cuadrilla Confirmada',
    `Te has unido exitosamente a la cuadrilla: ${squadName}`
  );
}

export function notifySquadCancelled(squadName: string): void {
  showNotification(
    'Cuadrilla Cancelada',
    `Has abandonado la cuadrilla: ${squadName}`
  );
}

export function notifyCrisisModeChanged(active: boolean): void {
  showNotification(
    active ? '⚠️ Modo Crisis Activado' : '✅ Modo Crisis Desactivado',
    active 
      ? 'Se han activado los protocolos de emergencia. Por favor, mantente a salvo.' 
      : 'La situación se ha normalizado. Gracias por tu colaboración.'
  );
}

export function notifyVolunteerRegistered(): void {
  showNotification(
    '¡Bienvenido Voluntario!',
    'Gracias por registrarte como voluntario. Tu ayuda es fundamental para la comunidad.'
  );
}

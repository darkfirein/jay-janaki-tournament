import api from '../api.js';

// A VAPID public key arrives as a base64url string; the Push API wants it
// as a raw Uint8Array.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPermissionState() {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

let swRegistration = null;
async function registerServiceWorker() {
  if (!swRegistration) {
    swRegistration = await navigator.serviceWorker.register('/sw.js');
  }
  return swRegistration;
}

// Full opt-in flow: registers the service worker, asks for OS notification
// permission (must be called from a user gesture like a button click), then
// creates a push subscription and saves it on the backend.
export async function enablePushNotifications() {
  if (!pushSupported()) throw new Error('Push notifications are not supported on this browser.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Notifications are blocked for this site. Enable them from your browser settings to turn this on.'
      : 'Notification permission was not granted.');
  }

  const { data } = await api.get('/notifications/push-public-key');
  if (!data.configured || !data.public_key) {
    throw new Error('Push notifications are not set up on the server yet.');
  }

  const registration = await registerServiceWorker();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.public_key)
    });
  }

  await api.post('/notifications/push-subscribe', subscription.toJSON());
  return true;
}

export async function disablePushNotifications() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await api.post('/notifications/push-unsubscribe', { endpoint: subscription.endpoint }).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
}

// Are we already subscribed on this device? Used to show the right state
// (Enable vs Enabled) without re-prompting.
export async function isSubscribed() {
  if (!pushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

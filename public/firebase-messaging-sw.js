importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDVXOqOb7kL13UhAy2lFgA-SX5NIdgy8Bo",
  authDomain: "balmy-comfort-r09p9.firebaseapp.com",
  projectId: "balmy-comfort-r09p9",
  storageBucket: "balmy-comfort-r09p9.firebasestorage.app",
  messagingSenderId: "269243101302",
  appId: "1:269243101302:web:878d6f5da73da1daebef57"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/pwa-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

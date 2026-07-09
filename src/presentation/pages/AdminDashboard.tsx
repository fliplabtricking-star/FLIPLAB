import React, { useState, useEffect } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfig from '../../../firebase-applet-config.json';
import { subscriberRepository } from '../../data/repositories/subscriber_repository.ts';
import { Subscriber, CLASS_RULES, ScanLog, FinanceLog } from '../../domain/entities/subscriber.ts';
import QRCode from 'react-qr-code';
import { Loader2, CheckCircle, XCircle, Users, Activity, BarChart3, Edit3, Save, Download, Bell, DollarSign, RefreshCw } from 'lucide-react';
import { Toast } from '../components/Toast.tsx';
import { downloadIdCard } from '../../utils/downloadIdCard.ts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleAuthProvider = new GoogleAuthProvider();

export function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>('');
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  
  const [allSubscribers, setAllSubscribers] = useState<Subscriber[]>([]);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [financeLogs, setFinanceLogs] = useState<FinanceLog[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [activeTab, setActiveTab] = useState<'scanner' | 'database' | 'finance' | 'logs' | 'settings'>('scanner');
  const [selectedSubscribers, setSelectedSubscribers] = useState<string[]>([]);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingScanLog, setEditingScanLog] = useState<ScanLog | null>(null);
  const [isUpdatingScanLog, setIsUpdatingScanLog] = useState(false);
  const [scanLogDateStr, setScanLogDateStr] = useState<string>('');
  const [classRules, setClassRules] = useState<any>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [viewingUserLogs, setViewingUserLogs] = useState<Subscriber | null>(null);
  
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: 'subscriber' | 'scanLog'; id: string } | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(5);

  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
  };

  const ADMIN_EMAILS = (import.meta as any).env?.VITE_ADMIN_EMAILS ? (import.meta as any).env.VITE_ADMIN_EMAILS.split(',') : [];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (!ADMIN_EMAILS.includes(currentUser.email) && currentUser.email !== 'admin@local.dev') {
          showToast("Access Denied: Not an Administrator", "error");
          auth.signOut();
          setUser(null);
          return;
        }
        setUser(currentUser);
        const idToken = await currentUser.getIdToken();
        setToken(idToken);
        setupMessaging();
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (deleteModal?.isOpen && deleteCountdown > 0) {
      timer = setTimeout(() => setDeleteCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [deleteModal?.isOpen, deleteCountdown]);

  const setupMessaging = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        showToast('Push notifications are not supported by your browser.', 'error');
        return;
      }
      
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        
        // Fetch VAPID public key
        const response = await fetch('/api/push/public-key');
        const data = await response.json();
        const publicKey = data.publicKey;
        
        const convertedVapidKey = urlBase64ToUint8Array(publicKey);

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });

        // Send subscription to server
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify(subscription)
        });
        
        showToast('Push notifications enabled successfully!', 'success');
      } else {
        showToast('Permission for notifications was denied.', 'error');
      }
    } catch (err: any) {
      console.log('Error setting up push notifications', err);
      showToast('Error enabling notifications.', 'error');
    }
  };

  // Utility to convert Base64 URL-safe to Uint8Array
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [token]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const [data, logs, financeRes, settingsRes] = await Promise.all([
        subscriberRepository.getAllSubscribers(token),
        subscriberRepository.getAllScanLogs(token),
        subscriberRepository.getFinanceLogs(token).catch(() => []),
        fetch('/api/settings/classes').then(res => res.json())
      ]);
      setAllSubscribers(data);
      setScanLogs(logs);
      setFinanceLogs(financeRes);
      setClassRules(settingsRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  const login = async () => {
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      if (!ADMIN_EMAILS.includes(result.user.email) && result.user.email !== 'admin@local.dev') {
        showToast("Access Denied: Not an Administrator", "error");
        auth.signOut();
        setUser(null);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/unauthorized-domain' || (import.meta as any).env?.DEV) {
        console.log("Using DEV fallback user due to unauthorized domain");
        setUser({ email: 'admin@local.dev' } as User);
        setToken('dev-mock-token');
      } else {
        showToast("Failed to sign in", 'error');
      }
    }
  };

  const logout = () => {
    auth.signOut();
  };

  const handleScan = async (result: string) => {
    if (result && result !== scannedId) {
      setScannedId(result);
      setLoading(true);
      setError('');
      setSubscriber(null);
      
      try {
        const { subscriber, scanLog } = await subscriberRepository.logScan(result, token);
        setSubscriber(subscriber);
        fetchStats(); // refresh scan logs
      } catch (err: any) {
        console.error(err);
        if (err.isExpired) {
          setSubscriber(err.subscriber);
          setError("EXPIRED");
        } else {
          setError(err.message || "Subscriber not found or invalid ID.");
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const verifySubscriber = async () => {
    if (!scannedId || !token) return;
    setVerifying(true);
    try {
      await subscriberRepository.verifySubscriber(scannedId, token);
      setSubscriber(prev => prev ? { ...prev, isVerified: true } : null);
      showToast("Subscriber verified successfully!", 'success');
      fetchStats(); // Refresh stats
    } catch (err) {
      console.error(err);
      showToast("Failed to verify subscriber", 'error');
    } finally {
      setVerifying(false);
    }
  };

  const renewSubscriber = async () => {
    if (!subscriber?.id || !token) return;
    setVerifying(true); // Reusing verifying state for loading indicator
    try {
      const renewed = await subscriberRepository.renewSubscriber(subscriber.id, token);
      setSubscriber(renewed);
      setError(''); // Clear EXPIRED error
      showToast("Subscription renewed for 30 days!", 'success');
      fetchStats();
    } catch (err) {
      console.error(err);
      showToast("Failed to renew subscription", 'error');
    } finally {
      setVerifying(false);
    }
  };

  const renewSubscriberById = async (id: string) => {
    if (!token) return;
    try {
      await subscriberRepository.renewSubscriber(id, token);
      showToast("Subscription renewed for 30 days!", 'success');
      fetchStats(); // This refreshes the database list
    } catch (err) {
      console.error(err);
      showToast("Failed to renew subscription", 'error');
    }
  };

  const renewSessionSubscriber = async () => {
    if (!subscriber?.id || !token) return;
    setVerifying(true);
    try {
      const renewed = await subscriberRepository.renewSessionSubscriber(subscriber.id, token);
      setSubscriber(renewed);
      setError(''); 
      showToast("Subscription renewed for 1 session (24h)!", 'success');
      fetchStats();
    } catch (err) {
      console.error(err);
      showToast("Failed to renew session", 'error');
    } finally {
      setVerifying(false);
    }
  };

  const renewSessionSubscriberById = async (id: string) => {
    if (!token) return;
    try {
      await subscriberRepository.renewSessionSubscriber(id, token);
      showToast("Subscription renewed for 1 session (24h)!", 'success');
      fetchStats();
    } catch (err) {
      console.error(err);
      showToast("Failed to renew session", 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !classRules) return;
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/settings/classes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(classRules)
      });
      if (!res.ok) throw new Error('Failed to save settings');
      showToast('Settings saved successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to save settings.', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubscriber || !token) return;
    setIsUpdating(true);
    try {
      const updated = await subscriberRepository.updateSubscriber(editingSubscriber.id!, editingSubscriber, token);
      showToast("Subscriber updated successfully!", 'success');
      setEditingSubscriber(null);
      fetchStats(); // refresh list
      if (subscriber?.id === updated.id) {
        setSubscriber(updated); // update scanned view if it's the same
      }
    } catch (error) {
      console.error(error);
      showToast("Failed to update subscriber.", 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const openDeleteModal = (type: 'subscriber' | 'scanLog', id: string) => {
    setDeleteCountdown(5);
    setDeleteModal({ isOpen: true, type, id });
  };

  const confirmDelete = async () => {
    if (!deleteModal || !token) return;
    try {
      if (deleteModal.type === 'scanLog') {
        await subscriberRepository.deleteScanLog(deleteModal.id, token);
        showToast("Scan log deleted", 'success');
      } else {
        await subscriberRepository.deleteSubscriber(deleteModal.id, token);
        showToast("Subscriber deleted", 'success');
        if (subscriber?.id === deleteModal.id) {
          setSubscriber(null);
          setScannedId('');
        }
        setSelectedSubscribers(prev => prev.filter(id => id !== deleteModal.id));
      }
      fetchStats();
    } catch (err) {
      console.error(err);
      showToast(`Failed to delete ${deleteModal.type}.`, 'error');
    } finally {
      setDeleteModal(null);
    }
  };

  const handleDeleteScanLog = async (id: string) => {
    openDeleteModal('scanLog', id);
  };

  const handleUpdateScanLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScanLog || !token) return;
    setIsUpdatingScanLog(true);
    try {
      // scanLogDateStr comes from input type="datetime-local", converting to ISO
      const newDate = new Date(scanLogDateStr).toISOString();
      await subscriberRepository.updateScanLog(editingScanLog.id, newDate, token);
      setEditingScanLog(null);
      fetchStats();
      showToast("Scan log updated", 'success');
    } catch (err) {
      console.error(err);
      showToast("Failed to update scan log.", 'error');
    } finally {
      setIsUpdatingScanLog(false);
    }
  };

  const handleDeleteSubscriber = async (id: string) => {
    openDeleteModal('subscriber', id);
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedSubscribers.length} subscribers? This cannot be undone.`)) {
      setLoading(true);
      try {
        // Run sequentially to avoid overwhelming the server, or run in parallel
        await Promise.all(selectedSubscribers.map(id => subscriberRepository.deleteSubscriber(id, token!)));
        showToast(`${selectedSubscribers.length} subscribers deleted`, 'success');
        setSelectedSubscribers([]);
        fetchStats();
        if (subscriber && selectedSubscribers.includes(subscriber.id!)) setSubscriber(null);
      } catch (err) {
        showToast("Failed to delete some subscribers", 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const downloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast("Please allow popups to download PDF", "error");
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Fliplab Academy - Subscriber Database</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=JetBrains+Mono:wght@700&display=swap');
            
            body { 
              font-family: 'Cairo', sans-serif; 
              padding: 40px; 
              color: #1a1a1a; 
              direction: rtl; 
              background-color: #fcfcfc;
              margin: 0;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              border-bottom: 4px solid #e9c400;
              padding-bottom: 20px;
            }
            .header h1 { 
              color: #0f0f0f; 
              text-transform: uppercase; 
              margin: 0;
              font-weight: 900;
              font-size: 32px;
              letter-spacing: 2px;
            }
            .header p {
              color: #666;
              margin-top: 10px;
              font-size: 14px;
            }
            table { 
              width: 100%; 
              border-collapse: separate; 
              border-spacing: 0;
              margin-top: 20px; 
              direction: rtl; 
              background: #fff;
              border: 1px solid #e0e0e0;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            }
            th, td { 
              border-bottom: 1px solid #f0f0f0; 
              padding: 16px 20px; 
              text-align: right; 
              font-size: 14px; 
            }
            th { 
              background-color: #0f0f0f; 
              color: #ffffff; 
              font-weight: 700; 
              text-transform: uppercase; 
              letter-spacing: 1px;
            }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background-color: #fafafa; }
            .id-col { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #555; direction: ltr; text-align: left; }
            .footer { 
              margin-top: 40px; 
              text-align: center; 
              font-size: 12px; 
              color: #888; 
              direction: ltr; 
              border-top: 1px dashed #ccc;
              padding-top: 20px;
            }
            @media print {
              @page { margin: 1cm; size: landscape; }
              body { background-color: #fff; padding: 0; }
              table { box-shadow: none; border: 1px solid #000; border-radius: 0; }
              th { background-color: #e9c400 !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Fliplab Academy</h1>
            <p>سجل المشتركين الشامل (Subscriber Database)</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>رقم البطاقة (QR ID)</th>
                <th>الاسم (Name)</th>
                <th>العمر (Age)</th>
                <th>الفصل (Class)</th>
                <th>الباقة (Package)</th>
                <th>رقم الهاتف (Phone)</th>
                <th>الحالة (Status)</th>
                <th>تاريخ التسجيل (Date)</th>
              </tr>
            </thead>
            <tbody>
              ${allSubscribers.map(sub => `
                <tr>
                  <td class="id-col">${sub.id}</td>
                  <td style="font-weight: 700;">${sub.fullName}</td>
                  <td>${sub.age}</td>
                  <td>${sub.classType}</td>
                  <td>${sub.packageType}</td>
                  <td dir="ltr" style="text-align: right;">${sub.whatsappNumber}</td>
                  <td><span style="color: ${sub.isVerified ? '#16a34a' : '#d97706'}; font-weight: bold;">${sub.isVerified ? 'مفعل' : 'انتظار'}</span></td>
                  <td dir="ltr" style="text-align: right;">${sub.createdAt ? new Date(sub.createdAt).toLocaleDateString('en-GB') : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">Generated by Fliplab System on ${new Date().toLocaleString()}</div>
          <script>
            window.onload = function() { 
              setTimeout(function() {
                window.print(); 
                window.close(); 
              }, 1000); // 1s delay for fonts to load
            }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const downloadFinancePDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast("Please allow popups to download PDF", "error");
      return;
    }

    const totalCapital = financeLogs.reduce((acc, log) => acc + log.amount, 0);

    const htmlContent = `
      <html>
        <head>
          <title>Fliplab Academy - Finance & Revenue</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=JetBrains+Mono:wght@700&display=swap');
            
            body { 
              font-family: 'Cairo', sans-serif; 
              padding: 40px; 
              color: #1a1a1a; 
              direction: rtl; 
              background-color: #fcfcfc;
              margin: 0;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              border-bottom: 4px solid #4ade80;
              padding-bottom: 20px;
            }
            .header h1 { 
              color: #0f0f0f; 
              text-transform: uppercase; 
              margin: 0;
              font-weight: 900;
              font-size: 32px;
              letter-spacing: 2px;
            }
            .header h2 { 
              color: #16a34a; 
              margin-top: 15px; 
              font-size: 28px;
              font-family: 'JetBrains Mono', monospace;
              direction: ltr;
            }
            table { 
              width: 100%; 
              border-collapse: separate; 
              border-spacing: 0;
              margin-top: 20px; 
              direction: rtl; 
              background: #fff;
              border: 1px solid #e0e0e0;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            }
            th, td { 
              border-bottom: 1px solid #f0f0f0; 
              padding: 16px 20px; 
              text-align: right; 
              font-size: 14px; 
            }
            th { 
              background-color: #0f0f0f; 
              color: #ffffff; 
              font-weight: 700; 
              text-transform: uppercase; 
              letter-spacing: 1px;
            }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background-color: #fafafa; }
            .amount-col { font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: bold; color: #16a34a; direction: ltr; text-align: left; }
            .footer { 
              margin-top: 40px; 
              text-align: center; 
              font-size: 12px; 
              color: #888; 
              direction: ltr; 
              border-top: 1px dashed #ccc;
              padding-top: 20px;
            }
            @media print {
              @page { margin: 1cm; }
              body { background-color: #fff; padding: 0; }
              table { box-shadow: none; border: 1px solid #000; border-radius: 0; }
              th { background-color: #4ade80 !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .amount-col { color: #000 !important; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Fliplab Academy - Finance</h1>
            <h2>Total Capital: RM ${totalCapital}</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>التاريخ والوقت (Date & Time)</th>
                <th>اسم المشترك (Subscriber)</th>
                <th>الفصل (Class)</th>
                <th>نوع العملية (Transaction)</th>
                <th>المبلغ (Amount)</th>
              </tr>
            </thead>
            <tbody>
              ${financeLogs.map(log => `
                <tr>
                  <td dir="ltr" style="text-align: right;">${new Date(log.date).toLocaleString('en-GB')}</td>
                  <td style="font-weight: bold;">${log.subscriberName || 'Unknown'}</td>
                  <td>${log.subscriberClass || '-'}</td>
                  <td>${log.type}</td>
                  <td class="amount-col">+RM ${log.amount}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">Generated by Fliplab System on ${new Date().toLocaleString()}</div>
          <script>
            window.onload = function() { 
              setTimeout(function() {
                window.print(); 
                window.close(); 
              }, 1000); // 1s delay for fonts to load
            }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans text-on-background">
        <div className="mb-12 flex flex-col items-center justify-center font-sans tracking-tighter" style={{ lineHeight: '0.85' }}>
          <span className="text-6xl font-black text-[#e9c400]">FLIPLAB</span>
          <span className="text-6xl font-black text-[#e9c400]">ACADEMY</span>
        </div>
        <div className="bg-surface-container p-8 border border-outline-variant rounded-xl shadow-[0px_10px_25px_rgba(0,0,0,0.5)] max-w-sm w-full text-center relative">
          <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-primary m-2 opacity-50"></div>
          <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-primary m-2 opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-primary m-2 opacity-50"></div>
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-primary m-2 opacity-50"></div>
          
          <h2 className="text-xl font-mono text-secondary uppercase tracking-widest mb-8 mt-2">System Access</h2>
          <button 
            onClick={login}
            className="w-full flex justify-center py-4 px-6 border-0 text-base font-black text-on-primary bg-primary uppercase tracking-wider hover:bg-primary-container focus:outline-none clip-chamfer transition-all duration-200 hover:shadow-[0_0_15px_rgba(255,215,0,0.3)] active:scale-[0.98]"
          >
            Authenticate
          </button>
        </div>
      </div>
    );
  }

  const totalRegistrations = allSubscribers.length;
  const pendingVerification = allSubscribers.filter(s => !s.isVerified).length;
  const parkourCount = allSubscribers.filter(s => s.classType.toLowerCase() === 'parkour').length;
  const trickingCount = allSubscribers.filter(s => s.classType.toLowerCase() === 'tricking').length;

  return (
    <div className="min-h-screen text-on-background font-sans relative">
      {toastMessage && <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />}
      <nav className="bg-[#0f0f0f] border-b-2 border-outline-variant p-4 md:p-6 flex flex-col sm:flex-row justify-between items-center gap-4 relative z-20 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col font-sans tracking-tighter italic items-center sm:items-start" style={{ lineHeight: '0.85' }}>
          <span className="text-xl sm:text-2xl font-black text-primary">FLIPLAB</span>
          <span className="text-xl sm:text-2xl font-black text-primary">ACADEMY</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full sm:w-auto">
          <button onClick={setupMessaging} className="w-full sm:w-auto justify-center text-[10px] sm:text-xs font-mono font-bold text-background hover:text-on-surface bg-[#4ade80] hover:bg-surface-container-highest uppercase tracking-widest flex items-center border-2 border-[#4ade80] px-4 py-2 transition-colors">
            <Bell className="w-4 h-4 mr-2" /> Enable Notifications
          </button>
          <span className="text-[10px] sm:text-xs font-mono font-bold text-secondary tracking-widest uppercase inline-block border border-outline-variant px-3 py-1 bg-surface-container-highest truncate max-w-full">{user.email}</span>
          <button onClick={logout} className="w-full sm:w-auto justify-center text-[10px] sm:text-xs font-mono font-bold text-primary hover:text-background hover:bg-primary uppercase tracking-widest flex items-center border-2 border-primary px-4 py-2 transition-colors">TERMINATE SESSION</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8 mt-4">
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface-container border-2 border-outline-variant p-6 relative">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 flex items-center justify-center border-b-2 border-l-2 border-outline-variant">
              <Users className="text-primary w-8 h-8" />
            </div>
            <h3 className="text-xs font-mono font-bold text-secondary tracking-widest uppercase mb-2">Total Registrations</h3>
            <div className="text-4xl font-black text-on-surface">{loadingStats ? '-' : totalRegistrations}</div>
          </div>
          
          <div className="bg-surface-container border-2 border-outline-variant p-6 relative">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#e9c400]/10 flex items-center justify-center border-b-2 border-l-2 border-outline-variant">
              <Activity className="text-[#e9c400] w-8 h-8" />
            </div>
            <h3 className="text-xs font-mono font-bold text-secondary tracking-widest uppercase mb-2">Pending Verification</h3>
            <div className="text-4xl font-black text-[#e9c400]">{loadingStats ? '-' : pendingVerification}</div>
          </div>
          
          <div className="bg-surface-container border-2 border-outline-variant p-6 relative">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#4ade80]/10 flex items-center justify-center border-b-2 border-l-2 border-outline-variant">
              <BarChart3 className="text-[#4ade80] w-8 h-8" />
            </div>
            <h3 className="text-xs font-mono font-bold text-secondary tracking-widest uppercase mb-2">Class Distribution</h3>
            <div className="flex items-end gap-4">
              <div className="flex flex-col">
                <span className="text-sm font-black text-on-surface uppercase">PK</span>
                <span className="text-2xl font-black text-primary">{loadingStats ? '-' : parkourCount}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-on-surface uppercase">TRK</span>
                <span className="text-2xl font-black text-primary">{loadingStats ? '-' : trickingCount}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:flex md:flex-row gap-2 sm:gap-4 mb-8">
          <button 
            onClick={() => setActiveTab('scanner')}
            className={`flex-1 py-3 sm:py-4 text-xs sm:text-base border-2 font-black uppercase tracking-widest transition-colors ${activeTab === 'scanner' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container border-outline-variant text-secondary hover:text-on-surface'}`}
          >
            Scanner
          </button>
          <button 
            onClick={() => setActiveTab('database')}
            className={`flex-1 py-3 sm:py-4 text-xs sm:text-base border-2 font-black uppercase tracking-widest transition-colors ${activeTab === 'database' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container border-outline-variant text-secondary hover:text-on-surface'}`}
          >
            Database
          </button>
          <button 
            onClick={() => setActiveTab('finance')}
            className={`flex-1 py-3 sm:py-4 text-xs sm:text-base border-2 font-black uppercase tracking-widest transition-colors ${activeTab === 'finance' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container border-outline-variant text-secondary hover:text-on-surface'}`}
          >
            Finance
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 sm:py-4 text-xs sm:text-base border-2 font-black uppercase tracking-widest transition-colors ${activeTab === 'settings' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container border-outline-variant text-secondary hover:text-on-surface'}`}
          >
            Settings
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-3 sm:py-4 text-xs sm:text-base border-2 font-black uppercase tracking-widest transition-colors ${activeTab === 'logs' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container border-outline-variant text-secondary hover:text-on-surface'}`}
          >
            Logs
          </button>
        </div>

        {activeTab === 'scanner' && (
          <div className="grid md:grid-cols-12 gap-6 sm:gap-8">
            <div className="md:col-span-5 lg:col-span-4 bg-surface-container border-2 border-outline-variant shadow-[8px_8px_0px_0px_rgba(233,196,0,0.05)] p-4 sm:p-8 h-fit relative">
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary m-[-2px] z-10"></div>
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary m-[-2px] z-10"></div>
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary m-[-2px] z-10"></div>
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary m-[-2px] z-10"></div>
            
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 text-on-surface border-b-2 border-outline-variant pb-4 italic">QR Scanner</h2>
            <div className="border-4 border-outline-variant overflow-hidden bg-[#0f0f0f] relative p-2 aspect-square flex items-center justify-center group">
              <div className="absolute inset-0 border-[4px] border-primary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 m-2"></div>
              <div className="w-full h-full relative">
                 <Scanner onScan={(result) => handleScan(result[0].rawValue)} />
              </div>
            </div>
            <p className="text-xs font-mono font-bold text-secondary mt-6 text-center uppercase tracking-widest bg-surface-container-highest p-3 border border-outline-variant mb-6">POINT CAMERA AT QR CODE</p>
            
            <div className="border-t-2 border-outline-variant pt-6">
              <label className="block text-xs font-mono font-bold text-secondary uppercase tracking-widest mb-2">Manual ID Entry</label>
              <div className="flex gap-2">
                <input 
                  id="manual-scan-input"
                  type="text" 
                  placeholder="ENTER SUBSCRIBER ID" 
                  className="w-full bg-background border-2 border-outline-variant p-3 text-on-surface focus:border-primary focus:outline-none font-mono text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleScan(e.currentTarget.value);
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    const input = document.getElementById('manual-scan-input') as HTMLInputElement;
                    if (input && input.value) handleScan(input.value);
                  }}
                  className="bg-primary text-on-primary px-4 font-black uppercase tracking-widest hover:bg-primary-container transition-colors"
                >
                  SEARCH
                </button>
              </div>
            </div>
          </div>

          <div className="md:col-span-7 lg:col-span-8 bg-surface-container border-2 border-outline-variant shadow-[8px_8px_0px_0px_rgba(233,196,0,0.05)] p-4 sm:p-8 min-h-[400px] sm:min-h-[500px] relative">
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 text-on-surface border-b-2 border-outline-variant pb-4 italic">Subscriber Validation</h2>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64">
                <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
                <p className="text-secondary font-mono font-bold text-sm uppercase tracking-widest">FETCHING RECORDS...</p>
              </div>
            ) : error && error !== "EXPIRED" ? (
              <div className="flex flex-col items-center justify-center h-64 text-error text-center border-2 border-error p-8 bg-[#93000a]/10">
                <XCircle className="h-20 w-20 mb-6" />
                <p className="font-mono font-bold text-base uppercase tracking-widest">{error}</p>
                <button 
                  onClick={() => setScannedId(null)}
                  className="mt-8 px-8 py-3 border-2 border-error text-error text-sm font-black uppercase tracking-widest hover:bg-error hover:text-on-error transition-colors"
                >
                  RESET SCANNER
                </button>
              </div>
            ) : subscriber ? (
              <div className="space-y-8 animate-in fade-in duration-300">
                {error === "EXPIRED" && (
                   <div className="flex flex-col items-center justify-center text-error text-center border-2 border-error p-6 bg-[#93000a]/10 mb-6">
                     <p className="font-mono font-black text-xl uppercase tracking-widest mb-2">انتهى الاشتراك (Subscription Expired)</p>
                     <p className="text-sm font-bold text-on-surface mb-6 uppercase">Please wait for admin to renew the subscription.</p>
                     <div className="flex gap-4 mb-6">
                       <button onClick={renewSubscriber} disabled={verifying} className="px-6 py-3 bg-primary text-on-primary font-black uppercase tracking-widest hover:bg-primary-container transition-colors disabled:opacity-50">
                         {verifying ? 'RENEWING...' : 'RENEW 30 DAYS'}
                       </button>
                       <button onClick={renewSessionSubscriber} disabled={verifying} className="px-6 py-3 border-2 border-primary text-primary font-black uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-colors disabled:opacity-50">
                         {verifying ? 'RENEWING...' : 'RENEW 1 SESSION'}
                       </button>
                     </div>
                   </div>
                )}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b-2 border-outline-variant pb-8 gap-4 bg-[#0f0f0f] p-6">
                  <div>
                    <h3 className="text-4xl font-black text-primary uppercase tracking-tighter italic">{subscriber.fullName}</h3>
                    <div className="flex gap-2 items-center mt-2 flex-wrap">
                      <p className="text-secondary font-mono font-bold text-sm uppercase tracking-widest border border-outline-variant inline-block px-3 py-1 bg-surface-container">{subscriber.age} YRS // {subscriber.gender}</p>
                      {subscriber.createdAt && (
                        <p className="text-secondary font-mono font-bold text-sm uppercase tracking-widest border border-outline-variant inline-block px-3 py-1 bg-surface-container">REG: {new Date(subscriber.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      )}
                    </div>
                  </div>
                  {subscriber.isVerified ? (
                    <div className="flex flex-col items-end gap-2">
                      <span className="inline-flex items-center px-4 py-2 text-sm font-black uppercase tracking-widest border-2 border-[#4ade80] text-[#4ade80] bg-[#4ade80]/10">
                        <CheckCircle className="w-5 h-5 mr-2" /> VERIFIED
                      </span>
                      <div style={{ display: 'none' }}>
                        <QRCode id={`qr-code-${subscriber.id}`} value={subscriber.id || ''} size={260} bgColor="#ffffff" fgColor="#000000" />
                      </div>
                      <button onClick={() => downloadIdCard(subscriber.id!, subscriber.fullName, subscriber.classType, subscriber.packageType, `qr-code-${subscriber.id}`)} className="text-xs font-black uppercase text-primary border border-primary px-3 py-1 hover:bg-primary hover:text-on-primary transition-colors flex items-center">
                        <Download className="w-3 h-3 mr-2" /> DIGITAL PASS
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-2">
                      <span className="inline-flex items-center px-4 py-2 text-sm font-black uppercase tracking-widest border-2 border-primary text-primary bg-primary/10">
                        PENDING VERIFICATION
                      </span>
                      <div style={{ display: 'none' }}>
                        <QRCode id={`qr-code-${subscriber.id}`} value={subscriber.id || ''} size={260} bgColor="#ffffff" fgColor="#000000" />
                      </div>
                      <button onClick={() => downloadIdCard(subscriber.id!, subscriber.fullName, subscriber.classType, subscriber.packageType, `qr-code-${subscriber.id}`)} className="text-xs font-black uppercase text-primary border border-primary px-3 py-1 hover:bg-primary hover:text-on-primary transition-colors flex items-center">
                        <Download className="w-3 h-3 mr-2" /> DIGITAL PASS
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 text-sm p-4 sm:p-6 bg-surface-container-low border border-outline-variant">
                  <div>
                    <span className="block text-secondary font-mono font-bold text-xs uppercase tracking-widest mb-2 border-b border-outline-variant pb-1 inline-block">Class Type</span>
                    <span className="font-black text-on-surface uppercase text-xl block mt-1">{subscriber.classType}</span>
                  </div>
                  <div>
                    <span className="block text-secondary font-mono font-bold text-xs uppercase tracking-widest mb-2 border-b border-outline-variant pb-1 inline-block">Package</span>
                    <span className="font-black text-on-surface uppercase text-xl block mt-1">{subscriber.packageType}</span>
                  </div>
                  <div>
                    <span className="block text-secondary font-mono font-bold text-xs uppercase tracking-widest mb-2 border-b border-outline-variant pb-1 inline-block">WhatsApp</span>
                    <span className="font-black text-on-surface uppercase text-xl block mt-1">{subscriber.whatsappNumber}</span>
                  </div>
                  {subscriber.guardianName && (
                    <div>
                      <span className="block text-secondary font-mono font-bold text-xs uppercase tracking-widest mb-2 border-b border-outline-variant pb-1 inline-block">Guardian</span>
                      <span className="font-black text-on-surface uppercase text-xl block mt-1">{subscriber.guardianName}</span>
                    </div>
                  )}
                  <div className="col-span-2 mt-2">
                    <span className="block text-secondary font-mono font-bold text-xs uppercase tracking-widest mb-2 border-b border-outline-variant pb-1 inline-block">Class Schedule & Timing</span>
                    <span className="font-black text-[#e9c400] uppercase text-xl block mt-1">
                      {CLASS_RULES[subscriber.classType as keyof typeof CLASS_RULES]?.schedule}
                      {subscriber.packageType === 'Trial' && (CLASS_RULES[subscriber.classType as keyof typeof CLASS_RULES]?.packages.Trial as any).note && (
                        <span className="text-sm ml-3 text-secondary font-bold">
                          ({(CLASS_RULES[subscriber.classType as keyof typeof CLASS_RULES].packages.Trial as any).note})
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="block text-secondary font-mono font-bold text-xs uppercase tracking-widest mb-4">Payment Receipt Log</span>
                  <div className="bg-[#0f0f0f] border-2 border-outline-variant p-6 max-h-80 overflow-hidden flex justify-center relative group">
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    <img 
                      src={subscriber.receiptImageBase64} 
                      alt="Receipt" 
                      className="max-w-full h-auto object-contain cursor-pointer grayscale group-hover:grayscale-0 transition-all duration-300 border border-outline-variant"
                      onClick={() => window.open(subscriber.receiptImageBase64)}
                      title="Click to view full size"
                    />
                  </div>
                </div>

                {!subscriber.isVerified && (
                  <button
                    onClick={verifySubscriber}
                    disabled={verifying}
                    className="w-full flex justify-center items-center py-6 px-8 border-0 text-xl font-black text-on-primary bg-primary uppercase tracking-widest hover:bg-primary-container focus:outline-none transition-all duration-200 mt-8 disabled:opacity-50 hover:ring-4 hover:ring-primary hover:ring-offset-4 hover:ring-offset-background"
                  >
                    {verifying ? <Loader2 className="animate-spin h-8 w-8 mr-4 text-on-primary" /> : <CheckCircle className="h-8 w-8 mr-4" />}
                    AUTHORIZE ENTRY
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-secondary text-center opacity-50 border-2 border-dashed border-outline-variant p-12 bg-[#0f0f0f]">
                <span className="material-symbols-outlined text-[80px] mb-6">qr_code_scanner</span>
                <p className="font-mono font-bold text-base uppercase tracking-widest">AWAITING SCANNER INPUT...</p>
              </div>
            )}
          </div>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="bg-surface-container border-2 border-outline-variant shadow-[8px_8px_0px_0px_rgba(233,196,0,0.05)] p-8 relative">
            <div className="flex justify-between items-center mb-6 border-b-2 border-outline-variant pb-4">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-on-surface italic m-0">Full Subscriber Database</h2>
              <div className="flex gap-2">
                {selectedSubscribers.length > 0 && (
                  <button onClick={handleBulkDelete} className="flex items-center gap-2 bg-error text-on-error px-4 py-2 font-black uppercase tracking-widest text-xs hover:bg-[#ff5449] transition-colors">
                    DELETE SELECTED ({selectedSubscribers.length})
                  </button>
                )}
                <button onClick={downloadPDF} className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 font-black uppercase tracking-widest text-xs hover:bg-primary-container transition-colors">
                  <Download className="w-4 h-4" /> Download PDF
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto border-2 border-outline-variant">
              <table className="w-full text-left text-sm font-mono text-on-surface">
                <thead className="bg-[#0f0f0f] border-b-2 border-outline-variant text-secondary uppercase tracking-widest text-xs">
                  <tr>
                    <th className="px-6 py-4 w-10">
                      <input 
                        type="checkbox" 
                        onChange={(e) => setSelectedSubscribers(e.target.checked ? allSubscribers.map(s => s.id!) : [])} 
                        checked={selectedSubscribers.length === allSubscribers.length && allSubscribers.length > 0}
                        className="w-4 h-4 accent-primary"
                      />
                    </th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Class</th>
                    <th className="px-6 py-4">Package</th>
                    <th className="px-6 py-4">Phone</th>
                    <th className="px-6 py-4">Reg. Date</th>
                    <th className="px-6 py-4">Expires</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {allSubscribers.map(sub => (
                    <tr key={sub.id} className="hover:bg-surface-container-highest transition-colors">
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          checked={selectedSubscribers.includes(sub.id!)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedSubscribers([...selectedSubscribers, sub.id!]);
                            else setSelectedSubscribers(selectedSubscribers.filter(id => id !== sub.id));
                          }}
                          className="w-4 h-4 accent-primary"
                        />
                      </td>
                      <td className="px-6 py-4 font-bold">{sub.fullName}</td>
                      <td className="px-6 py-4 uppercase">{sub.classType}</td>
                      <td className="px-6 py-4 uppercase">{sub.packageType}</td>
                      <td className="px-6 py-4">{sub.whatsappNumber}</td>
                      <td className="px-6 py-4 text-xs whitespace-nowrap">{sub.createdAt ? new Date(sub.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                      <td className="px-6 py-4 text-xs whitespace-nowrap">{sub.activeUntil ? new Date(sub.activeUntil).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
                      <td className="px-6 py-4">
                        {sub.isVerified ? (
                          <span className="inline-block px-2 py-1 bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80] text-xs font-bold uppercase">Verified</span>
                        ) : (
                          <span className="inline-block px-2 py-1 bg-[#e9c400]/10 text-[#e9c400] border border-[#e9c400] text-xs font-bold uppercase">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 flex gap-2">

                        <button onClick={() => setViewingReceipt(sub.receiptImageBase64)} className="text-primary hover:text-on-primary hover:bg-primary border border-primary px-3 py-1 uppercase tracking-widest text-xs font-bold transition-colors">
                          RECEIPT
                        </button>
                        <button onClick={() => setViewingUserLogs(sub)} className="text-primary hover:text-on-primary hover:bg-primary border border-primary px-3 py-1 uppercase tracking-widest text-xs font-bold transition-colors">
                          LOGS
                        </button>
                        <button onClick={() => renewSubscriberById(sub.id!)} className="text-[#4ade80] hover:text-[#0f0f0f] hover:bg-[#4ade80] border border-[#4ade80] px-3 py-1 uppercase tracking-widest text-xs font-bold transition-colors">
                          30 DAYS
                        </button>
                        <button onClick={() => renewSessionSubscriberById(sub.id!)} className="text-[#4ade80] hover:text-[#0f0f0f] hover:bg-[#4ade80] border border-[#4ade80] px-3 py-1 uppercase tracking-widest text-xs font-bold transition-colors">
                          1 SESSION
                        </button>
                        <button 
                          onClick={() => setEditingSubscriber(sub)}
                          className="text-primary hover:text-on-primary hover:bg-primary border border-primary px-3 py-1 uppercase tracking-widest text-xs font-bold flex items-center transition-colors"
                        >
                          <Edit3 className="w-3 h-3 mr-2" /> EDIT
                        </button>
                        <button 
                          onClick={() => handleDeleteSubscriber(sub.id!)}
                          className="text-error hover:text-on-error hover:bg-error border border-error px-3 py-1 uppercase tracking-widest text-xs font-bold transition-colors"
                        >
                          DELETE
                        </button>
                      </td>
                    </tr>
                  ))}
                  {allSubscribers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-secondary font-bold uppercase tracking-widest">No subscribers found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="bg-surface-container border-2 border-outline-variant shadow-[8px_8px_0px_0px_rgba(233,196,0,0.05)] p-8 relative">
            <div className="flex justify-between items-center mb-6 border-b-2 border-outline-variant pb-4">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-on-surface italic flex items-center m-0">
                <DollarSign className="w-8 h-8 mr-3 text-primary" />
                Finance & Revenue (رأس المال)
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={fetchStats} 
                  disabled={loadingStats}
                  className="flex items-center gap-2 bg-surface-container-highest text-on-surface border border-outline-variant px-4 py-2 font-black uppercase tracking-widest text-xs hover:bg-outline-variant transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} /> Refresh
                </button>
                <button onClick={downloadFinancePDF} className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 font-black uppercase tracking-widest text-xs hover:bg-primary-container transition-colors">
                  <Download className="w-4 h-4" /> Download PDF
                </button>
              </div>
            </div>
            
            <div className="bg-[#0f0f0f] border-2 border-primary p-8 mb-8 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full border-b-2 border-l-2 border-primary/20"></div>
              <h3 className="text-sm font-mono font-bold text-secondary tracking-widest uppercase mb-4 relative z-10">Total Capital</h3>
              <div className="text-6xl md:text-8xl font-black text-primary relative z-10 flex items-baseline">
                <span>{financeLogs.reduce((acc, log) => acc + log.amount, 0)}</span>
                <span className="text-2xl md:text-4xl ml-4 opacity-80">RM</span>
              </div>
            </div>

            <h3 className="text-xl font-black uppercase tracking-tighter mb-4 text-on-surface italic">Transaction History</h3>
            <div className="overflow-x-auto border-2 border-outline-variant">
              <table className="w-full text-left text-sm font-mono text-on-surface">
                <thead className="bg-[#0f0f0f] border-b-2 border-outline-variant text-secondary uppercase tracking-widest text-xs">
                  <tr>
                    <th className="px-6 py-4">Date & Time</th>
                    <th className="px-6 py-4">Subscriber Name</th>
                    <th className="px-6 py-4">Class</th>
                    <th className="px-6 py-4">Transaction Type</th>
                    <th className="px-6 py-4 text-right">Amount (RM)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {financeLogs.map(log => (
                    <tr key={log.id} className="hover:bg-surface-container-highest transition-colors">
                      <td className="px-6 py-4 font-bold text-primary">
                        {new Date(log.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 font-bold">{log.subscriberName || 'Unknown'}</td>
                      <td className="px-6 py-4 uppercase">{log.subscriberClass || '-'}</td>
                      <td className="px-6 py-4 uppercase">
                        <span className={`inline-block px-2 py-1 text-xs font-bold ${log.type.includes('Renew') ? 'bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]' : 'bg-primary/10 text-primary border border-primary'}`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-black text-right text-lg">+{log.amount}</td>
                    </tr>
                  ))}
                  {financeLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-secondary font-bold uppercase tracking-widest">No financial transactions found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-surface-container border-2 border-outline-variant shadow-[8px_8px_0px_0px_rgba(233,196,0,0.05)] p-8 relative">
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 text-on-surface border-b-2 border-outline-variant pb-4 italic">Scan & Attendance Logs</h2>
            
            <div className="overflow-x-auto border-2 border-outline-variant">
              <table className="w-full text-left text-sm font-mono text-on-surface">
                <thead className="bg-[#0f0f0f] border-b-2 border-outline-variant text-secondary uppercase tracking-widest text-xs">
                  <tr>
                    <th className="px-6 py-4">Scan Time (Check-In)</th>
                    <th className="px-6 py-4">Subscriber Name</th>
                    <th className="px-6 py-4">Class</th>
                    <th className="px-6 py-4">Package</th>
                    <th className="px-6 py-4">Registration Time</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {scanLogs.map(log => (
                    <tr key={log.id} className="hover:bg-surface-container-highest transition-colors">
                      <td className="px-6 py-4 font-bold text-primary">
                        {log.scannedAt ? new Date(log.scannedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                      </td>
                      <td className="px-6 py-4 font-bold text-on-surface">{log.subscriberName || 'Unknown'}</td>
                      <td className="px-6 py-4 uppercase">{log.subscriberClass || '-'}</td>
                      <td className="px-6 py-4 uppercase">{log.subscriberPackage || '-'}</td>
                      <td className="px-6 py-4 text-xs">
                        {log.subscriberRegistrationDate ? new Date(log.subscriberRegistrationDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-6 py-4 flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingScanLog(log);
                            // Set datetime-local value format: YYYY-MM-DDThh:mm
                            const date = log.scannedAt ? new Date(log.scannedAt) : new Date();
                            const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
                            const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0,16);
                            setScanLogDateStr(localISOTime);
                          }}
                          className="text-primary hover:text-on-primary hover:bg-primary border border-primary px-3 py-1 uppercase tracking-widest text-xs font-bold transition-colors"
                        >
                          EDIT
                        </button>
                        <button 
                          onClick={() => handleDeleteScanLog(log.id)}
                          className="text-error hover:text-on-error hover:bg-error border border-error px-3 py-1 uppercase tracking-widest text-xs font-bold transition-colors"
                        >
                          DELETE
                        </button>
                      </td>
                    </tr>
                  ))}
                  {scanLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-secondary font-bold uppercase tracking-widest">No scan logs found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

                {activeTab === 'settings' && classRules && (
          <div className="bg-surface-container border-2 border-outline-variant shadow-[8px_8px_0px_0px_rgba(233,196,0,0.05)] p-8 relative">
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 text-on-surface border-b-2 border-outline-variant pb-4 italic">Class Configuration</h2>
            
            <form onSubmit={handleSaveSettings} className="space-y-8 font-mono">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {['Parkour', 'Tricking'].map((sport) => (
                  <div key={sport} className="border-2 border-outline-variant bg-[#0f0f0f] p-6">
                    <h3 className="text-xl font-black uppercase tracking-widest text-primary mb-6 border-b border-outline-variant pb-2">{sport} Settings</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-1">Schedule & Timing (Text)</label>
                        <input 
                          type="text" 
                          value={classRules[sport].schedule}
                          onChange={(e) => setClassRules({...classRules, [sport]: {...classRules[sport], schedule: e.target.value}})}
                          className="w-full bg-background border border-outline-variant p-2 text-on-surface focus:border-primary focus:outline-none"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Allowed Days</label>
                        <div className="flex flex-wrap gap-2">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                            <label key={day} className="flex items-center gap-1 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={(classRules[sport].allowedDays || []).includes(idx)}
                                onChange={(e) => {
                                  const currentDays = classRules[sport].allowedDays || [];
                                  if (e.target.checked) {
                                    setClassRules({...classRules, [sport]: {...classRules[sport], allowedDays: [...currentDays, idx].sort()}});
                                  } else {
                                    setClassRules({...classRules, [sport]: {...classRules[sport], allowedDays: currentDays.filter((d: number) => d !== idx)}});
                                  }
                                }}
                                className="w-4 h-4 accent-primary"
                              />
                              <span className="text-xs uppercase font-bold">{day}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-1">Start Time (24h)</label>
                          <input 
                            type="time" 
                            value={classRules[sport].startTime || ''}
                            onChange={(e) => setClassRules({...classRules, [sport]: {...classRules[sport], startTime: e.target.value}})}
                            className="w-full bg-background border border-outline-variant p-2 text-on-surface focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-1">End Time (24h)</label>
                          <input 
                            type="time" 
                            value={classRules[sport].endTime || ''}
                            onChange={(e) => setClassRules({...classRules, [sport]: {...classRules[sport], endTime: e.target.value}})}
                            className="w-full bg-background border border-outline-variant p-2 text-on-surface focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-1">Min Age</label>
                          <input 
                            type="number" 
                            value={classRules[sport].minAge}
                            onChange={(e) => setClassRules({...classRules, [sport]: {...classRules[sport], minAge: parseInt(e.target.value)}})}
                            className="w-full bg-background border border-outline-variant p-2 text-on-surface focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-1">Max Age</label>
                          <input 
                            type="number" 
                            value={classRules[sport].maxAge}
                            onChange={(e) => setClassRules({...classRules, [sport]: {...classRules[sport], maxAge: parseInt(e.target.value)}})}
                            className="w-full bg-background border border-outline-variant p-2 text-on-surface focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-outline-variant">
                        <h4 className="text-sm font-bold text-on-surface uppercase mb-3">Monthly Package</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-1">Price (RM)</label>
                            <input 
                              type="number" 
                              value={classRules[sport].packages.Monthly.price}
                              onChange={(e) => setClassRules({...classRules, [sport]: {...classRules[sport], packages: {...classRules[sport].packages, Monthly: {...classRules[sport].packages.Monthly, price: parseInt(e.target.value)}}}})}
                              className="w-full bg-background border border-outline-variant p-2 text-on-surface focus:border-primary focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-1">Sessions</label>
                            <input 
                              type="number" 
                              value={classRules[sport].packages.Monthly.sessions}
                              onChange={(e) => setClassRules({...classRules, [sport]: {...classRules[sport], packages: {...classRules[sport].packages, Monthly: {...classRules[sport].packages.Monthly, sessions: parseInt(e.target.value)}}}})}
                              className="w-full bg-background border border-outline-variant p-2 text-on-surface focus:border-primary focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-outline-variant">
                        <h4 className="text-sm font-bold text-on-surface uppercase mb-3">Trial Package</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-1">Price (RM)</label>
                            <input 
                              type="number" 
                              value={classRules[sport].packages.Trial.price}
                              onChange={(e) => setClassRules({...classRules, [sport]: {...classRules[sport], packages: {...classRules[sport].packages, Trial: {...classRules[sport].packages.Trial, price: parseInt(e.target.value)}}}})}
                              className="w-full bg-background border border-outline-variant p-2 text-on-surface focus:border-primary focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-1">Sessions</label>
                            <input 
                              type="number" 
                              value={classRules[sport].packages.Trial.sessions}
                              onChange={(e) => setClassRules({...classRules, [sport]: {...classRules[sport], packages: {...classRules[sport].packages, Trial: {...classRules[sport].packages.Trial, sessions: parseInt(e.target.value)}}}})}
                              className="w-full bg-background border border-outline-variant p-2 text-on-surface focus:border-primary focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-1">Trial Note</label>
                          <input 
                            type="text" 
                            value={classRules[sport].packages.Trial.note || ''}
                            onChange={(e) => setClassRules({...classRules, [sport]: {...classRules[sport], packages: {...classRules[sport].packages, Trial: {...classRules[sport].packages.Trial, note: e.target.value}}}})}
                            className="w-full bg-background border border-outline-variant p-2 text-on-surface focus:border-primary focus:outline-none"
                            placeholder="e.g. Saturdays only"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-6 border-t-2 border-outline-variant">
                <button 
                  type="submit" 
                  disabled={isSavingSettings}
                  className="px-8 py-3 bg-primary text-on-primary font-black uppercase tracking-widest hover:bg-primary-container transition-colors flex items-center disabled:opacity-50"
                >
                  {isSavingSettings ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit Modal */}
        {editingSubscriber && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface-container border-2 border-primary shadow-[10px_10px_0px_0px_rgba(233,196,0,0.5)] w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="bg-[#0f0f0f] border-b-2 border-outline-variant p-4 sm:p-6 flex justify-between items-center sticky top-0 z-10">
                <h3 className="text-xl font-black uppercase tracking-widest text-primary italic">Edit Subscriber</h3>
                <button onClick={() => setEditingSubscriber(null)} className="text-secondary hover:text-error">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleUpdate} className="p-4 sm:p-8 space-y-6 sm:space-y-8 font-mono">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Full Name</label>
                    <input 
                      type="text" 
                      value={editingSubscriber.fullName}
                      onChange={e => setEditingSubscriber({...editingSubscriber, fullName: e.target.value})}
                      className="w-full bg-background border-2 border-outline-variant p-3 text-on-surface focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Age</label>
                    <input 
                      type="number" 
                      value={editingSubscriber.age}
                      onChange={e => setEditingSubscriber({...editingSubscriber, age: parseInt(e.target.value)})}
                      className="w-full bg-background border-2 border-outline-variant p-3 text-on-surface focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Class Type</label>
                    <select 
                      value={editingSubscriber.classType}
                      onChange={e => setEditingSubscriber({...editingSubscriber, classType: e.target.value})}
                      className="w-full bg-background border-2 border-outline-variant p-3 text-on-surface focus:border-primary focus:outline-none"
                    >
                      <option value="Parkour">Parkour</option>
                      <option value="Tricking">Tricking</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Package</label>
                    <select 
                      value={editingSubscriber.packageType}
                      onChange={e => setEditingSubscriber({...editingSubscriber, packageType: e.target.value})}
                      className="w-full bg-background border-2 border-outline-variant p-3 text-on-surface focus:border-primary focus:outline-none"
                    >
                      <option value="Trial">Trial</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">WhatsApp</label>
                    <input 
                      type="text" 
                      value={editingSubscriber.whatsappNumber}
                      onChange={e => setEditingSubscriber({...editingSubscriber, whatsappNumber: e.target.value})}
                      className="w-full bg-background border-2 border-outline-variant p-3 text-on-surface focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Verified Status</label>
                    <div className="flex items-center gap-3 mt-3">
                      <input 
                        type="checkbox" 
                        checked={editingSubscriber.isVerified}
                        onChange={e => setEditingSubscriber({...editingSubscriber, isVerified: e.target.checked})}
                        className="w-5 h-5 accent-primary"
                      />
                      <span className="text-on-surface font-bold uppercase">Is Verified</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Expiry Date</label>
                    <input 
                      type="datetime-local" 
                      value={editingSubscriber.activeUntil ? new Date(editingSubscriber.activeUntil).toISOString().slice(0,16) : ''}
                      onChange={e => setEditingSubscriber({...editingSubscriber, activeUntil: e.target.value ? new Date(e.target.value).toISOString() : undefined})}
                      className="w-full bg-background border-2 border-outline-variant p-3 text-on-surface focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
                
                <div className="pt-6 border-t-2 border-outline-variant flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
                  <div className="flex items-center gap-4 border-2 border-outline-variant p-2 bg-[#131313]">
                    <div className="bg-white p-2 flex flex-col items-center">
                       <QRCode id={`qr-code-${editingSubscriber.id}`} value={editingSubscriber.id || ''} size={80} bgColor="#ffffff" fgColor="#000000" />
                       <span className="mt-2 text-[10px] text-black font-bold uppercase tracking-widest bg-gray-200 px-2 py-1 rounded select-all">{editingSubscriber.id}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => downloadIdCard(editingSubscriber.id!, editingSubscriber.fullName, editingSubscriber.classType, editingSubscriber.packageType, `qr-code-${editingSubscriber.id}`)}
                      className="text-secondary hover:text-primary transition-colors flex flex-col items-center justify-center p-4 font-bold uppercase tracking-widest text-xs"
                    >
                      <Download className="w-6 h-6 mb-2" />
                      Download Pass
                    </button>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      type="button" 
                      onClick={() => setEditingSubscriber(null)}
                      className="px-6 py-3 border-2 border-outline-variant font-bold uppercase tracking-widest text-secondary hover:text-on-surface hover:bg-surface-container-highest transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isUpdating}
                      className="px-8 py-3 border-0 bg-primary font-black uppercase tracking-widest text-on-primary hover:bg-primary-container transition-colors flex items-center disabled:opacity-50"
                    >
                      {isUpdating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                      Save Changes
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Scan Log Modal */}
        {editingScanLog && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface-container border-2 border-primary shadow-[10px_10px_0px_0px_rgba(233,196,0,0.5)] w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="bg-[#0f0f0f] border-b-2 border-outline-variant p-4 sm:p-6 flex justify-between items-center sticky top-0 z-10">
                <h3 className="text-xl font-black uppercase tracking-widest text-primary italic">Edit Scan Time</h3>
                <button onClick={() => setEditingScanLog(null)} className="text-secondary hover:text-error">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleUpdateScanLog} className="p-4 sm:p-8 space-y-6 font-mono">
                <div>
                  <p className="mb-4 text-sm text-secondary">
                    Editing scan record for: <strong className="text-on-surface">{editingScanLog.subscriberName}</strong>
                  </p>
                  <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Check-In Time</label>
                  <input 
                    type="datetime-local" 
                    value={scanLogDateStr}
                    onChange={e => setScanLogDateStr(e.target.value)}
                    className="w-full bg-background border-2 border-outline-variant p-3 text-on-surface focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                
                <div className="pt-6 border-t-2 border-outline-variant flex gap-4 mt-6">
                  <button 
                    type="button" 
                    onClick={() => setEditingScanLog(null)}
                    className="flex-1 py-3 border-2 border-outline-variant font-bold uppercase tracking-widest text-secondary hover:text-on-surface hover:bg-surface-container-highest transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isUpdatingScanLog}
                    className="flex-1 py-3 border-0 bg-primary font-black uppercase tracking-widest text-on-primary hover:bg-primary-container transition-colors flex items-center justify-center disabled:opacity-50"
                  >
                    {isUpdatingScanLog ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
          {toastMessage && (
            <Toast 
              message={toastMessage} 
              type={toastType} 
              onClose={() => setToastMessage('')} 
            />
          )}

        {deleteModal?.isOpen && (
          <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-surface-container border-2 border-error shadow-[10px_10px_0px_0px_rgba(255,85,85,0.5)] w-full max-w-md p-6 sm:p-8 text-center font-mono">
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-widest text-error mb-4 italic">Confirm Deletion</h3>
              <p className="text-secondary mb-8 text-xs sm:text-sm">
                {deleteModal.type === 'subscriber' 
                  ? 'Are you sure you want to delete this subscriber? This will permanently delete all associated scan logs.'
                  : 'Are you sure you want to delete this scan log? This action cannot be undone.'}
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setDeleteModal(null)}
                  className="px-6 py-3 border border-outline-variant text-secondary font-black uppercase tracking-widest hover:text-on-surface hover:bg-surface-container-highest transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteCountdown > 0}
                  className="px-6 py-3 bg-error text-on-error font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 hover:bg-red-600"
                >
                  {deleteCountdown > 0 ? `Wait (${deleteCountdown})` : 'DELETE'}
                </button>
              </div>
            </div>
          </div>
        )}

        {viewingReceipt && (
          <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setViewingReceipt(null)}>
            <div className="bg-surface-container border-2 border-primary shadow-[10px_10px_0px_0px_rgba(233,196,0,0.5)] p-4 max-w-2xl w-full" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4 border-b border-outline-variant pb-2">
                <h3 className="text-xl font-black uppercase tracking-widest text-primary italic">Payment Receipt</h3>
                <button onClick={() => setViewingReceipt(null)} className="text-secondary hover:text-error"><XCircle className="w-6 h-6" /></button>
              </div>
              <div className="flex justify-center items-center bg-[#0f0f0f] p-4 min-h-[300px] border border-outline-variant">
                <img src={viewingReceipt} alt="Receipt" className="max-w-full max-h-[70vh] object-contain" />
              </div>
              <div className="mt-4 flex justify-end">
                 <button onClick={() => {
                   const win = window.open();
                   if (win) {
                     win.document.write(`<iframe src="${viewingReceipt}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                   }
                 }} className="bg-primary text-on-primary font-black uppercase tracking-widest px-4 py-2 hover:bg-primary-container transition-colors">Open in New Tab</button>
              </div>
            </div>
          </div>
        )}

        {viewingUserLogs && (
          <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setViewingUserLogs(null)}>
            <div className="bg-surface-container border-2 border-primary shadow-[10px_10px_0px_0px_rgba(233,196,0,0.5)] w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="bg-[#0f0f0f] border-b-2 border-outline-variant p-4 sm:p-6 flex justify-between items-center sticky top-0 z-10">
                <h3 className="text-xl font-black uppercase tracking-widest text-primary italic">Scan Logs: {viewingUserLogs.fullName}</h3>
                <button onClick={() => setViewingUserLogs(null)} className="text-secondary hover:text-error"><XCircle className="w-6 h-6" /></button>
              </div>
              <div className="p-4 sm:p-8 overflow-y-auto">
                <table className="w-full text-left text-sm font-mono text-on-surface border border-outline-variant">
                  <thead className="bg-[#0f0f0f] border-b border-outline-variant text-secondary uppercase tracking-widest text-xs">
                    <tr>
                      <th className="px-4 py-3">Scan Time</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {scanLogs.filter(log => log.subscriberId === viewingUserLogs.id).length > 0 ? (
                      scanLogs.filter(log => log.subscriberId === viewingUserLogs.id).map(log => (
                        <tr key={log.id} className="hover:bg-surface-container-highest transition-colors">
                          <td className="px-4 py-3 font-bold text-primary">
                            {log.scannedAt ? new Date(log.scannedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                          </td>
                          <td className="px-4 py-3"><span className="text-[#4ade80] text-xs border border-[#4ade80] px-2 py-1">CHECK-IN OK</span></td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={2} className="px-4 py-8 text-center text-secondary uppercase tracking-widest font-bold">No scan history found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

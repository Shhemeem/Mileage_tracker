import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithCustomToken, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { 
  Wallet, 
  Droplet, 
  LogOut, 
  Plus, 
  Trash2, 
  Edit2, 
  FileSpreadsheet,
  HelpCircle,
  AlertTriangle,
  X,
  Fuel,
  History,
  Car,
  ChevronDown,
  Check,
  Download
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// --- CHART REGISTRATION ---
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyA8uPFsPH1VZZdipFPzt7UP0HLr8v2UwXk",
  authDomain: "mileage-tracker-295dd.firebaseapp.com",
  projectId: "mileage-tracker-295dd",
  storageBucket: "mileage-tracker-295dd.firebasestorage.app",
  messagingSenderId: "588006597070",
  appId: "1:588006597070:web:5401f79a85029ebdadcb9f",
  measurementId: "G-CDLJS02BC7"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Default Sheets Script (Backup)
const DEFAULT_SHEETS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwL-wlnEAmx530VZJEpS-uHQKwkir1TtxvuTZoPT8AQbCW6D63u3qoXtDMRicG1HYsCVA/exec';

// --- MAIN COMPONENT ---
export default function App() {
  // Auth State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Data State
  const [vehicles, setVehicles] = useState([]);
  const [currentVehicleId, setCurrentVehicleId] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);

  // App Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Computed from current vehicle
  const currentVehicle = useMemo(() => 
    vehicles.find(v => v.id === currentVehicleId) || null, 
  [vehicles, currentVehicleId]);

  // UI State
  const [isRegistering, setIsRegistering] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ show: false, title: '', msg: '', type: 'info' });
  const [activeModal, setActiveModal] = useState(null); // 'edit', 'sheets', 'guide', 'clear', 'add-vehicle', 'vehicle-menu'
  const [editData, setEditData] = useState(null);

  // --- AUTHENTICATION ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- PWA SETUP (Service Worker & Install Prompt) ---
  useEffect(() => {
    // 1. Register Service Worker (Local Strategy)
    if ('serviceWorker' in navigator) {
      // We use a slight delay to not block initial page load
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('SW registered: ', registration);
          })
          .catch(registrationError => {
            console.log('SW registration failed: ', registrationError);
          });
      });
    }

    // 2. Capture Install Prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log("Install prompt captured");
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 3. Fallback: Dynamic Manifest Injection 
    // (This ensures it works even if you haven't set up the public folder files perfectly yet)
    const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⛽</text></svg>`;
    const iconUrl = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`;
    
    // Set Favicon
    const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/svg+xml';
    link.rel = 'icon';
    link.href = iconUrl;
    document.getElementsByTagName('head')[0].appendChild(link);

    // Set Dynamic Manifest (Backup)
    if (!document.querySelector("link[rel='manifest']")) {
        const manifest = {
          name: "Fuel Mileage Tracker",
          short_name: "FuelTrack",
          start_url: "/",
          display: "standalone",
          background_color: "#F8FAFC",
          theme_color: "#4F46E5",
          icons: [
            { src: iconUrl, sizes: "192x192", type: "image/svg+xml" },
            { src: iconUrl, sizes: "512x512", type: "image/svg+xml" }
          ]
        };
        const stringManifest = JSON.stringify(manifest);
        const blob = new Blob([stringManifest], {type: 'application/json'});
        const manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        manifestLink.href = URL.createObjectURL(blob);
        document.getElementsByTagName('head')[0].appendChild(manifestLink);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      showAlert(
        'Install App', 
        'To install:\n• Mobile: Tap Share/Menu → "Add to Home Screen"\n• Desktop: Click the install icon in the browser address bar',
        'info'
      );
    }
  };

  // --- 1. LISTEN TO VEHICLES ---
  useEffect(() => {
    if (!user) {
      setVehicles([]);
      setCurrentVehicleId(null);
      return;
    }

    // Path: artifacts/{appId}/users/{uid}/vehicles
    const vehiclesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'vehicles');
    
    const unsubVehicles = onSnapshot(vehiclesRef, (snapshot) => {
      setDbConnected(true);
      const loadedVehicles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (loadedVehicles.length === 0) {
        // Auto-create default vehicle if none exist
        createDefaultVehicle();
      } else {
        setVehicles(loadedVehicles);
        // If no vehicle selected (or selected one was deleted), select the first one
        if (!currentVehicleId || !loadedVehicles.find(v => v.id === currentVehicleId)) {
          // Prefer one named "Primary" or just the first
          const primary = loadedVehicles.find(v => v.name === 'Primary Vehicle') || loadedVehicles[0];
          setCurrentVehicleId(primary.id);
        }
      }
    }, (error) => {
      console.error("Vehicles listener error", error);
      setDbConnected(false);
      // Don't show alert immediately on load to avoid spamming if permission pending
    });

    return () => unsubVehicles();
  }, [user]);

  // --- 2. LISTEN TO TRIPS (Dependent on Current Vehicle) ---
  useEffect(() => {
    if (!user || !currentVehicleId) {
      setTrips([]);
      return;
    }

    setLoading(true);

    // Path: artifacts/{appId}/users/{uid}/vehicles/{vehicleId}/trips
    const tripsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'vehicles', currentVehicleId, 'trips');
    
    const unsubTrips = onSnapshot(tripsRef, (snapshot) => {
      const loadedTrips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by Odometer Descending (Highest first)
      loadedTrips.sort((a, b) => b.odo - a.odo);
      
      // Calculate derived stats
      const ascTrips = [...loadedTrips].sort((a, b) => a.odo - b.odo);
      const calculatedTrips = loadedTrips.map(trip => {
        const indexInAsc = ascTrips.findIndex(t => t.id === trip.id);
        const prevTrip = indexInAsc > 0 ? ascTrips[indexInAsc - 1] : null;
        
        let dist = 0;
        let mpg = 0;
        
        if (prevTrip) {
          dist = trip.odo - prevTrip.odo;
          if (trip.liters > 0) {
            mpg = dist / trip.liters;
          }
        }
        
        return { ...trip, distance: dist, mileage: mpg };
      });

      setTrips(calculatedTrips);
      setLoading(false);
    }, (error) => {
      console.error("Trips listener error", error);
      setLoading(false);
    });

    return () => unsubTrips();
  }, [user, currentVehicleId]);

  // --- HELPER FUNCTIONS ---
  const showAlert = (title, msg, type = 'info') => {
    setAlertInfo({ show: true, title, msg, type });
  };
  const closeAlert = () => setAlertInfo({ ...alertInfo, show: false });

  const createDefaultVehicle = async () => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'vehicles'), {
        name: 'Primary Vehicle',
        fuelPrice: 0,
        sheetUrl: '',
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error creating default vehicle", e);
    }
  };

  // --- ACTIONS ---
  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const name = e.target.name ? e.target.name.value : null;

    try {
      if (isRegistering) {
        if (!name) throw new Error("Name is required");
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      showAlert('Authentication Failed', error.message, 'error');
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google Login Error", error);
      if (error.code === 'auth/unauthorized-domain') {
        showAlert('Domain Not Authorized', `Add ${window.location.hostname} to Authorized Domains in Firebase Console > Authentication > Settings.`, 'error');
      } else {
        showAlert('Login Failed', error.message, 'error');
      }
    }
  };

  const handleGuestLogin = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      showAlert('Login Failed', error.message, 'error');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // --- DATA ACTIONS ---

  const createVehicle = async (e) => {
    e.preventDefault();
    const name = e.target.vehicleName.value;
    if (!name) return;

    try {
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'vehicles'), {
        name,
        fuelPrice: 0,
        sheetUrl: '',
        createdAt: new Date().toISOString()
      });
      setCurrentVehicleId(docRef.id);
      setActiveModal(null);
      showAlert('Success', `Switched to "${name}"`, 'success');
    } catch (error) {
      showAlert('Error', 'Could not create vehicle', 'error');
    }
  };

  const saveSettings = async (newPrice, newUrl) => {
    if (!user || !currentVehicleId) return;
    try {
      const vehicleRef = doc(db, 'artifacts', appId, 'users', user.uid, 'vehicles', currentVehicleId);
      const payload = {};
      if (newPrice !== undefined) payload.fuelPrice = parseFloat(newPrice);
      if (newUrl !== undefined) payload.sheetUrl = newUrl;
      
      await updateDoc(vehicleRef, payload);
      
      if(newUrl) showAlert('Success', 'Google Sheets connection saved.');
      else if(newPrice) showAlert('Success', 'Fuel price updated.');
    } catch (error) {
      console.error(error);
      showAlert('Error', 'Failed to save settings.', 'error');
    }
  };

  const sendToSheets = async (tripData, distance, mileage) => {
    if (!currentVehicle?.sheetUrl && !DEFAULT_SHEETS_SCRIPT_URL) return;
    const targetUrl = currentVehicle.sheetUrl || DEFAULT_SHEETS_SCRIPT_URL;
    
    // Safety check for valid URL structure
    if (!targetUrl.includes('script.google.com')) return;

    const payload = {
      ...tripData,
      vehicle: currentVehicle.name,
      distance,
      mileage,
      price: currentVehicle.fuelPrice,
      userEmail: user.email || 'guest',
      // Legacy capitalized keys
      Date: tripData.date,
      Odo: tripData.odo,
      Amount: tripData.amount,
      Liters: tripData.liters,
      Distance: distance,
      Mileage: mileage,
      Price: currentVehicle.fuelPrice
    };

    try {
      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn("Sheet sync error", e);
    }
  };

  const addTrip = async (e) => {
    e.preventDefault();
    if (!currentVehicle || currentVehicle.fuelPrice <= 0) return showAlert('Configuration Missing', 'Please set the Fuel Price first.', 'warning');

    const form = e.target;
    const date = form.date.value;
    const odo = parseFloat(form.odo.value);
    const amount = parseFloat(form.amount.value);

    if (isNaN(odo) || isNaN(amount) || !date) return showAlert('Input Error', 'Please fill all fields correctly.', 'error');
    
    if (trips.length > 0 && odo <= trips[0].odo) {
      return showAlert('Logic Error', `New odometer (${odo}) must be greater than previous (${trips[0].odo}).`, 'error');
    }

    const liters = amount / currentVehicle.fuelPrice;
    let dist = 0; 
    let mpg = 0;
    if (trips.length > 0) {
        dist = odo - trips[0].odo;
        mpg = dist / liters;
    }

    try {
      const newTrip = {
        date,
        odo,
        amount,
        liters,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'vehicles', currentVehicleId, 'trips'), newTrip);
      sendToSheets(newTrip, dist, mpg);

      form.reset();
      form.date.value = new Date().toISOString().slice(0, 10);
    } catch (error) {
      showAlert('Save Failed', error.message, 'error');
    }
  };

  const deleteTrip = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'vehicles', currentVehicleId, 'trips', id));
      setActiveModal(null);
    } catch (error) {
      showAlert('Error', 'Failed to delete trip.', 'error');
    }
  };

  const updateTrip = async (e) => {
    e.preventDefault();
    const id = editData.id;
    const odo = parseFloat(e.target.edit_odo.value);
    const amount = parseFloat(e.target.edit_amount.value);
    const date = e.target.edit_date.value;
    const liters = amount / currentVehicle.fuelPrice;

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'vehicles', currentVehicleId, 'trips', id), {
        odo, amount, date, liters
      });
      setActiveModal(null);
      setEditData(null);
    } catch (error) {
      showAlert('Error', 'Update failed.', 'error');
    }
  };

  const clearDatabase = async () => {
    try {
      const promises = trips.map(t => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'vehicles', currentVehicleId, 'trips', t.id)));
      await Promise.all(promises);
      setActiveModal(null);
      showAlert('Success', 'All data cleared for this vehicle.', 'success');
    } catch (error) {
      showAlert('Error', 'Failed to clear data.', 'error');
    }
  };

  const deleteVehicle = async () => {
    if (vehicles.length <= 1) return showAlert('Error', 'Cannot delete the only vehicle.', 'error');
    try {
      // Note: This only deletes the vehicle doc, subcollections (trips) technically remain orphaned in Firestore
      // unless deleted recursively, but for this app UI they are effectively gone.
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'vehicles', currentVehicleId));
      setActiveModal(null);
      showAlert('Deleted', 'Vehicle profile removed.', 'success');
    } catch (error) {
      showAlert('Error', 'Delete failed', 'error');
    }
  }

  const exportCSV = () => {
    if (trips.length === 0) return showAlert('No Data', 'Nothing to export.');
    let csv = 'Date,Odo,Distance,Amount,Liters,Mileage\n';
    trips.forEach(trip => {
      csv += `${trip.date},${trip.odo},${trip.distance},${trip.amount},${trip.liters},${trip.mileage}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fuel_log_${currentVehicle?.name || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
    const totalCost = trips.reduce((sum, t) => sum + t.amount, 0);
    const totalDist = trips.reduce((sum, t) => sum + (t.distance || 0), 0);
    const totalLiters = trips.reduce((sum, t) => sum + t.liters, 0);
    const avgMileage = totalLiters > 0 ? totalDist / totalLiters : 0;
    return { totalCost, totalDist, avgMileage };
  }, [trips]);

  // --- CHART DATA ---
  const chartData = useMemo(() => {
    const chronoTrips = [...trips].sort((a, b) => new Date(a.date) - new Date(b.date));
    const validTrips = chronoTrips.filter(t => t.mileage > 0 && t.mileage < 150);

    return {
      labels: validTrips.map(t => {
          const d = new Date(t.date);
          return `${d.getDate()}/${d.getMonth()+1}`;
      }),
      datasets: [
        {
          label: 'Mileage (km/L)',
          data: validTrips.map(t => t.mileage),
          borderColor: '#6366F1',
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 200);
            gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
            gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
            return gradient;
          },
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#6366F1',
          pointRadius: 4,
        }
      ]
    };
  }, [trips]);

  // --- ALERT COMPONENT ---
  const AlertToast = () => (
    alertInfo.show ? (
      <div className="fixed bottom-5 right-5 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-white p-4 rounded-xl shadow-2xl border border-slate-100 flex items-start gap-3 max-w-xs">
              {alertInfo.type === 'error' ? <AlertTriangle className="h-6 w-6 text-rose-500 shrink-0" /> : <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">✓</div>}
              <div>
                  <h4 className={`text-sm font-bold ${alertInfo.type === 'error' ? 'text-rose-600' : 'text-slate-800'}`}>{alertInfo.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">{alertInfo.msg}</p>
              </div>
              <button onClick={closeAlert} className="text-slate-300 hover:text-slate-500"><X className="h-4 w-4" /></button>
          </div>
      </div>
    ) : null
  );

  // --- RENDERING ---

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-100 border-t-indigo-600"></div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/90 backdrop-blur-xl p-8 rounded-[2rem] shadow-xl border border-white/50 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-100 rounded-full blur-3xl opacity-60"></div>
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-violet-100 rounded-full blur-3xl opacity-60"></div>

            <div className="relative z-10 text-center space-y-6">
                <div className="flex justify-center">
                    <div className="p-4 bg-gradient-to-br from-indigo-50 to-white rounded-2xl shadow-sm border border-indigo-50">
                        <Fuel className="h-10 w-10 text-indigo-600" />
                    </div>
                </div>
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900">Mileage Manager</h1>
                    <p className="mt-2 text-slate-500">Track your fuel efficiency and costs.</p>
                </div>
                <div className="space-y-4">
                    <button onClick={handleGoogleLogin} className="w-full flex justify-center items-center py-3.5 px-4 border border-slate-200 text-sm font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 transition-all">
                        <img className="h-5 w-5 mr-3" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
                        Continue with Google
                    </button>
                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                        <div className="relative flex justify-center text-xs uppercase tracking-wider font-semibold">
                            <span className="px-3 bg-white text-slate-400">Or with Email</span>
                        </div>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4 text-left">
                         {isRegistering && (
                             <div>
                                 <label className="block text-xs font-semibold text-slate-500 ml-1 mb-1">Full Name</label>
                                 <input name="name" type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="John Doe" required />
                             </div>
                         )}
                         <div>
                             <label className="block text-xs font-semibold text-slate-500 ml-1 mb-1">Email</label>
                             <input name="email" type="email" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="name@example.com" required />
                         </div>
                         <div>
                             <label className="block text-xs font-semibold text-slate-500 ml-1 mb-1">Password</label>
                             <input name="password" type="password" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200" placeholder="••••••••" required />
                         </div>
                         <button type="submit" className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
                             {isRegistering ? 'Register' : 'Sign In'}
                         </button>
                    </form>
                    <div className="text-sm text-slate-500 pt-2">
                        {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
                        <button onClick={() => setIsRegistering(!isRegistering)} className="font-bold text-indigo-600 hover:underline">
                            {isRegistering ? 'Login' : 'Register'}
                        </button>
                    </div>
                     <button onClick={handleGuestLogin} className="text-xs font-medium text-slate-400 hover:text-indigo-500 transition-colors">
                        Continue as Guest (Limited Access)
                    </button>
                    {/* INSTALL APP BUTTON (Visible in Login too) */}
                    <button onClick={handleInstallClick} className="flex items-center justify-center w-full mt-4 py-2 text-xs font-bold text-indigo-500 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors gap-2">
                        <Download className="h-4 w-4" />
                        Install App
                    </button>
                </div>
            </div>
            {/* ALERT TOAST (Now visible in Login) */}
            <AlertToast />
        </div>
      </div>
    );
  }

  // --- MAIN APP UI ---
  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans selection:bg-indigo-100">
      
      {/* --- HEADER --- */}
      <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center space-x-3 w-full md:w-auto">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-200 shrink-0">
                <Fuel className="h-6 w-6" />
             </div>
             
             {/* VEHICLE SELECTOR */}
             <div className="relative group">
                 <button onClick={() => setActiveModal('vehicle-menu')} className="flex items-center space-x-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition border border-slate-200">
                    <div className="flex flex-col items-start">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Current Vehicle</span>
                        <span className="text-sm font-bold text-slate-800 flex items-center gap-1">
                            {currentVehicle ? currentVehicle.name : 'Loading...'}
                            <ChevronDown className="h-3 w-3 text-slate-400" />
                        </span>
                    </div>
                 </button>
             </div>
          </div>
          
          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <button onClick={handleInstallClick} title="Install App" className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
                <Download className="h-6 w-6" />
            </button>
            <button onClick={() => setActiveModal('guide')} title="Setup Guide" className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
               <HelpCircle className="h-6 w-6" />
            </button>
            <button onClick={() => setActiveModal('sheets')} title="Google Sheets" className={`p-2 rounded-lg transition-colors ${currentVehicle?.sheetUrl ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'}`}>
               <FileSpreadsheet className="h-6 w-6" />
            </button>
            
            <div className="hidden sm:flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
               <span className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-emerald-500' : 'bg-yellow-500 animate-pulse'}`}></span>
               <span className="text-xs font-semibold text-slate-500 truncate max-w-[100px]">
                   {user.isAnonymous ? 'Guest' : user.displayName || user.email}
               </span>
            </div>

            <button onClick={handleLogout} title="Logout" className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
               <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* --- STATS CARDS --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <StatCard Icon={Wallet} color="emerald" title="Total Spent" value={`₹${stats.totalCost.toFixed(0)}`} />
           <StatCard Icon={Droplet} color="indigo" title="Avg Mileage" value={stats.avgMileage.toFixed(2)} sub="km/L" />
           <StatCard Icon={History} color="blue" title="Total Distance" value={stats.totalDist.toFixed(0)} sub="km" />
        </div>

        {/* --- MAIN GRID --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT COLUMN: FORMS */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* SETTINGS CARD */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-2xl -mr-16 -mt-16 opacity-50"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center">Fuel Settings</h2>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold uppercase">{currentVehicle?.name}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 items-end">
                             <div className="w-full">
                                 <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">Current Fuel Price</label>
                                 <div className="relative">
                                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">₹</span>
                                     <input 
                                       type="number" 
                                       step="0.01"
                                       // Safely access fuelPrice with fallback
                                       value={currentVehicle?.fuelPrice || ''}
                                       // Optimistically update local state via saving, but input relies on vehicle state
                                       // We can force update via onChange but for now relying on modal/save flow or direct binding
                                       onChange={(e) => saveSettings(e.target.value, undefined)}
                                       className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-semibold text-slate-800"
                                       placeholder="0.00"
                                     />
                                 </div>
                             </div>
                             {/* Auto-save on change implemented above, simplified UI */}
                        </div>
                    </div>
                </div>

                {/* ADD TRIP CARD */}
                <div className="bg-white p-8 rounded-3xl shadow-lg shadow-indigo-100/50 border border-slate-100 relative">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                             <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                 <Plus className="h-5 w-5" />
                             </span>
                             New Log Entry
                        </h2>
                    </div>

                    <form onSubmit={addTrip} className="space-y-5">
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                             <div>
                                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">Date</label>
                                 <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-slate-800 font-medium" />
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">Odometer (km)</label>
                                 <input name="odo" type="number" placeholder="e.g. 12500" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-slate-800 font-medium" />
                                 <p className="mt-1.5 text-xs font-semibold text-indigo-500 text-right">
                                     {trips.length > 0 ? `Last: ${trips[0].odo} km` : 'No history'}
                                 </p>
                             </div>
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">Amount Paid</label>
                             <div className="relative">
                                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                 <input name="amount" type="number" step="0.01" placeholder="0.00" className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-slate-800 font-medium" />
                             </div>
                         </div>
                         
                         <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all active:scale-[0.98]">
                             {loading ? 'Processing...' : 'Add Entry'}
                         </button>
                    </form>
                </div>
            </div>

            {/* RIGHT COLUMN: STATS & CHART */}
            <div className="lg:col-span-1 space-y-6">
                
                {/* LATEST TRIP SUMMARY */}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-8 rounded-3xl shadow-xl shadow-indigo-500/20 border border-white/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-4 -translate-y-4">
                        <Fuel className="h-32 w-32" />
                    </div>
                    <h2 className="text-sm font-bold text-indigo-100 uppercase tracking-widest mb-6 border-b border-white/20 pb-4 relative z-10">Last Trip Analysis</h2>
                    
                    {trips.length > 0 && trips[0].distance >= 0 ? (
                        <div className="space-y-6 relative z-10">
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-5xl font-black tracking-tight">{trips[0].distance.toFixed(0)}</p>
                                    <span className="text-lg font-medium text-indigo-200">km</span>
                                </div>
                                <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider mt-1">Distance Traveled</p>
                            </div>
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-5xl font-black tracking-tight text-emerald-300">{trips[0].mileage.toFixed(2)}</p>
                                    <span className="text-lg font-medium text-emerald-200/80">km/L</span>
                                </div>
                                <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider mt-1">Fuel Efficiency</p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-indigo-200 text-sm font-medium relative z-10">
                            Add a second trip to calculate your efficiency stats!
                        </div>
                    )}
                </div>

                {/* CHART */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-64">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Efficiency Trend</h3>
                    <div className="flex-grow relative w-full h-full">
                        <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { border: { display: false }, grid: { borderDash: [4, 4], drawBorder: false } } } }} />
                    </div>
                </div>
            </div>
        </div>

        {/* --- TRIP TABLE --- */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
             <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <h2 className="text-lg font-extrabold text-slate-800">History Log</h2>
                 <div className="flex space-x-2">
                     <button onClick={exportCSV} className="px-4 py-2 bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-slate-100 transition border border-slate-200">Export CSV</button>
                 </div>
             </div>

             <div className="overflow-x-auto max-h-[500px]">
                 <table className="min-w-full divide-y divide-slate-100">
                     <thead className="bg-slate-50/80 backdrop-blur sticky top-0 z-10">
                         <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                             <th className="px-6 py-4">Date</th>
                             <th className="px-6 py-4">Odo</th>
                             <th className="px-6 py-4">Dist</th>
                             <th className="px-6 py-4">Cost</th>
                             <th className="px-6 py-4">Vol</th>
                             <th className="px-6 py-4">Eff</th>
                             <th className="px-6 py-4"></th>
                         </tr>
                     </thead>
                     <tbody className="bg-white divide-y divide-slate-50 text-sm font-medium text-slate-600">
                         {trips.length === 0 ? (
                             <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-400">No trips recorded yet.</td></tr>
                         ) : (
                             trips.map(trip => (
                                 <tr key={trip.id} className="hover:bg-slate-50 transition group">
                                     <td className="px-6 py-4 text-slate-700 font-semibold">{new Date(trip.date).toLocaleDateString()}</td>
                                     <td className="px-6 py-4">{trip.odo.toFixed(0)}</td>
                                     <td className="px-6 py-4">{trip.distance > 0 ? trip.distance.toFixed(0) : '-'}</td>
                                     <td className="px-6 py-4 text-slate-900">₹{trip.amount.toFixed(0)}</td>
                                     <td className="px-6 py-4">{trip.liters.toFixed(1)}</td>
                                     <td className="px-6 py-4">
                                         {trip.mileage > 0 ? (
                                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                                 {trip.mileage.toFixed(2)}
                                             </span>
                                         ) : '-'}
                                     </td>
                                     <td className="px-6 py-4 text-right">
                                         <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button onClick={() => { setEditData(trip); setActiveModal('edit'); }} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 className="h-4 w-4" /></button>
                                             <button onClick={() => { setEditData(trip); setActiveModal('delete'); }} className="p-1 text-slate-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                                         </div>
                                     </td>
                                 </tr>
                             ))
                         )}
                     </tbody>
                 </table>
             </div>
             
             <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                 <button onClick={() => setActiveModal('clear')} className="text-xs font-bold text-rose-400 hover:text-rose-600 transition uppercase tracking-wide">Clear Database</button>
             </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      
      {/* VEHICLE MENU MODAL */}
      {activeModal === 'vehicle-menu' && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 className="text-lg font-bold text-slate-800">Select Vehicle</h3>
                    <button onClick={() => setActiveModal(null)}><X className="h-5 w-5 text-slate-400"/></button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {vehicles.map(v => (
                        <button 
                            key={v.id} 
                            onClick={() => { setCurrentVehicleId(v.id); setActiveModal(null); }}
                            className={`w-full flex items-center justify-between p-3 rounded-xl transition ${v.id === currentVehicleId ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'hover:bg-slate-50 text-slate-600 border border-transparent'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${v.id === currentVehicleId ? 'bg-white' : 'bg-slate-100'}`}>
                                    <Car className="h-5 w-5" />
                                </div>
                                <span className="font-bold">{v.name}</span>
                            </div>
                            {v.id === currentVehicleId && <Check className="h-4 w-4" />}
                        </button>
                    ))}
                </div>
                <button 
                    onClick={() => setActiveModal('add-vehicle')} 
                    className="w-full py-3 border border-dashed border-slate-300 rounded-xl text-slate-500 font-bold text-sm hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-300 transition flex items-center justify-center gap-2"
                >
                    <Plus className="h-4 w-4" /> Add Another Vehicle
                </button>
                
                {vehicles.length > 1 && (
                   <button onClick={() => setActiveModal('delete-vehicle')} className="w-full text-xs text-rose-400 hover:text-rose-600 py-2">Delete Current Profile</button>
                )}
            </div>
        </div>
      )}

      {/* ADD VEHICLE MODAL */}
      {activeModal === 'add-vehicle' && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6">
                 <h3 className="text-xl font-bold text-slate-800">New Database</h3>
                 <form onSubmit={createVehicle} className="space-y-4">
                     <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vehicle Name</label>
                         <input name="vehicleName" type="text" placeholder="e.g. Work Truck" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
                     </div>
                     <div className="flex justify-end space-x-3 pt-2">
                         <button type="button" onClick={() => setActiveModal('vehicle-menu')} className="px-5 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl">Back</button>
                         <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg">Create</button>
                     </div>
                 </form>
             </div>
          </div>
      )}

      {/* 1. EDIT MODAL */}
      {activeModal === 'edit' && editData && (
         <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full space-y-6">
                 <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4">Edit Entry</h3>
                 <form onSubmit={updateTrip} className="space-y-4">
                     <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                         <input name="edit_date" type="date" defaultValue={editData.date} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800" />
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Odometer</label>
                         <input name="edit_odo" type="number" defaultValue={editData.odo} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800" />
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount</label>
                         <input name="edit_amount" type="number" step="0.01" defaultValue={editData.amount} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800" />
                     </div>
                     <div className="flex justify-end space-x-3 pt-2">
                         <button type="button" onClick={() => setActiveModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl">Cancel</button>
                         <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg">Update</button>
                     </div>
                 </form>
             </div>
         </div>
      )}

      {/* 2. CONFIRM DELETE TRIP MODAL */}
      {activeModal === 'delete' && editData && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-4">
                <h3 className="text-lg font-bold text-rose-600">Delete Trip?</h3>
                <p className="text-slate-600 text-sm">Are you sure you want to remove this entry?</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-slate-100 rounded-lg text-slate-700 font-bold text-sm">Cancel</button>
                    <button onClick={() => deleteTrip(editData.id)} className="px-4 py-2 bg-rose-500 rounded-lg text-white font-bold text-sm shadow-lg shadow-rose-500/30">Delete</button>
                </div>
            </div>
        </div>
      )}
      
      {/* 2b. CONFIRM DELETE VEHICLE MODAL */}
      {activeModal === 'delete-vehicle' && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-4">
                <h3 className="text-lg font-bold text-rose-600">Delete Vehicle?</h3>
                <p className="text-slate-600 text-sm">This will delete "{currentVehicle?.name}" and all its logs. <b>This cannot be undone.</b></p>
                <div className="flex justify-end space-x-3">
                    <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-slate-100 rounded-lg text-slate-700 font-bold text-sm">Cancel</button>
                    <button onClick={() => deleteVehicle()} className="px-4 py-2 bg-rose-500 rounded-lg text-white font-bold text-sm shadow-lg shadow-rose-500/30">Delete Profile</button>
                </div>
            </div>
        </div>
      )}

      {/* 3. CONFIRM CLEAR MODAL */}
      {activeModal === 'clear' && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full space-y-4">
                <h3 className="text-lg font-bold text-rose-600">Clear All Data?</h3>
                <p className="text-slate-600 text-sm">This will permanently delete all logs for <b>{currentVehicle?.name}</b>.</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-slate-100 rounded-lg text-slate-700 font-bold text-sm">Cancel</button>
                    <button onClick={clearDatabase} className="px-4 py-2 bg-rose-500 rounded-lg text-white font-bold text-sm shadow-lg shadow-rose-500/30">Confirm</button>
                </div>
            </div>
        </div>
      )}

      {/* 4. SHEETS MODAL */}
      {activeModal === 'sheets' && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full space-y-6 relative">
                 <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4">Google Sheets Sync</h3>
                 <div className="space-y-4">
                     <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Apps Script Webhook URL</label>
                         <input 
                            type="text" 
                            defaultValue={currentVehicle?.sheetUrl || ''}
                            onChange={(e) => saveSettings(undefined, e.target.value)}
                            placeholder="https://script.google.com/..." 
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 text-xs"
                         />
                         <p className="text-[10px] text-slate-400 mt-2">Paste your Web App URL here.</p>
                     </div>
                     <div className="flex justify-end space-x-3 pt-2">
                         <button onClick={() => setActiveModal(null)} className="py-2.5 px-5 bg-slate-100 text-slate-600 font-bold text-sm rounded-xl">Close</button>
                     </div>
                 </div>
             </div>
          </div>
      )}

      {/* 5. GUIDE MODAL */}
      {activeModal === 'guide' && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col relative overflow-hidden">
                 <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                     <h3 className="text-xl font-bold text-slate-800">Setup Guide</h3>
                     <button onClick={() => setActiveModal(null)} className="p-2 rounded-full hover:bg-slate-200"><X className="h-5 w-5 text-slate-500"/></button>
                 </div>
                 <div className="p-8 overflow-y-auto space-y-8 text-slate-600 text-sm">
                     <div className="space-y-2">
                         <h4 className="font-bold text-indigo-600">1. Google Sheet Setup</h4>
                         <p>Create a sheet with headers: <code className="bg-slate-100 px-2 py-1 rounded">Date | Odo | Distance | Amount | Liters | Mileage</code></p>
                     </div>
                     <div className="space-y-2">
                         <h4 className="font-bold text-indigo-600">2. Apps Script</h4>
                         <p>Extensions &gt; Apps Script. Paste the code below. Deploy as Web App (Execute as: Me, Access: Anyone).</p>
                         <div className="bg-slate-800 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto">
                             function doPost(e) &#123; <br/>
                             &nbsp;&nbsp;var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();<br/>
                             &nbsp;&nbsp;var d = JSON.parse(e.postData.contents);<br/>
                             &nbsp;&nbsp;sheet.appendRow([new Date(), d.date, d.odo, d.distance, d.amount, d.liters, d.mileage]);<br/>
                             &nbsp;&nbsp;return ContentService.createTextOutput("Success");<br/>
                             &#125;
                         </div>
                     </div>
                 </div>
             </div>
          </div>
      )}

      {/* 6. ALERT TOAST (Now rendered here for both Auth and Main App) */}
      <AlertToast />
    </div>
  );
}

// --- SUB COMPONENTS ---

const StatCard = ({ Icon, color, title, value, sub }) => {
    // Map color props to Tailwind classes
    const colorClasses = {
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600' }
    };
    const c = colorClasses[color] || colorClasses.indigo;

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center space-x-4 hover:-translate-y-1 transition-transform duration-300">
            <div className={`p-3 rounded-2xl ${c.bg} ${c.text}`}>
                <Icon className="h-6 w-6" />
            </div>
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
                <p className="text-2xl font-extrabold text-slate-800 mt-0.5">{value} <span className="text-sm font-semibold text-slate-400">{sub}</span></p>
            </div>
        </div>
    );
};
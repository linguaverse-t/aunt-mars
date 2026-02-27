// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    // -----------------------------------------------------------
    //  🔥🔥 วาง Firebase Config ของคุณตรงนี้ 🔥🔥
    // -----------------------------------------------------------
    apiKey: "AIzaSyAg1n8jTcxETemAynZpz2jk-HKZuQZr52E",
    authDomain: "linguaverse-t.firebaseapp.com",
    projectId: "linguaverse-t",
    storageBucket: "linguaverse-t.firebasestorage.app",
    messagingSenderId: "565528090781",
    appId: "1:565528090781:web:8c0776ab672c6780179c74"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false
});

export { auth, db };

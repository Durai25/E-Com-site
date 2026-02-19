/*
IMPORTANT:
This file is SAFE for frontend.
Firebase keys are public by design.
Security is controlled via Firestore rules.
*/

import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB1VCHUGWzxGyVhQaSONx3FUf8jWE5r5vA",
  authDomain: "saree-dhoti-ecommerce.firebaseapp.com",
  projectId: "saree-dhoti-ecommerce",
  storageBucket: "saree-dhoti-ecommerce.firebasestorage.app",
  messagingSenderId: "588900421752",
  appId: "1:588900421752:web:e1f3db8403827beaab1d8d"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
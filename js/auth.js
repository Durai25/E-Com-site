import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ======================
   LOGIN
====================== */
window.login = async function () {

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // 🔑 STEP 1: ADMIN CHECK FIRST
    const adminRef = doc(db, "admins", user.email.toLowerCase());
    const adminSnap = await getDoc(adminRef);

    if (adminSnap.exists()) {
      // ✅ ADMIN → DIRECT ACCESS
      window.location = "/admin/dashboard.html";
      return;
    }

    // 👤 STEP 2: CUSTOMER → EMAIL VERIFICATION REQUIRED
    if (!user.emailVerified) {
      document.getElementById("msg").innerText =
        "Please verify your email before login.";
      return;
    }

    // STEP 3: CUSTOMER ACCOUNT
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    // Update emailVerified status if user has verified their email
    if (user.emailVerified && userSnap.exists() && !userSnap.data().emailVerified) {
      await setDoc(userRef, { emailVerified: true }, { merge: true });
    }

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        role: "customer",
        emailVerified: user.emailVerified,
        createdAt: new Date()
      });
    }

    window.location = "/public/my-account.html";

  } catch (err) {
    document.getElementById("msg").innerText = err.message;
  }
};

/* ======================
   SIGNUP
====================== */
window.signup = async function () {

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // Try to send verification email (may fail if Firebase config issue)
    try {
      await sendEmailVerification(user);
      document.getElementById("msg").innerText =
        "Verification email sent. Please check your inbox.";
    } catch (emailErr) {
      console.warn("Email verification sending failed:", emailErr);
      document.getElementById("msg").innerText =
        "Account created. Please check your inbox for verification email.";
    }

    // Create customer record in Firestore
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      role: "customer",
      emailVerified: false,
      createdAt: new Date()
    });

    console.log("User document created in Firestore");

  } catch (err) {
    console.error("Signup error:", err);
    document.getElementById("msg").innerText = err.message;
  }
};

/* ======================
   REDIRECT LOGIC
====================== */
async function redirectUser(user) {

  // 1️⃣ Admin check
  const adminRef = doc(db, "admins", user.email.toLowerCase());
  const adminSnap = await getDoc(adminRef);

  if (adminSnap.exists()) {
    window.location = "/admin/dashboard.html";
    return;
  }

  // 2️⃣ Customer (verified only)
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  // Update emailVerified status if user has verified their email
  if (user.emailVerified && userSnap.exists() && !userSnap.data().emailVerified) {
    await setDoc(userRef, { emailVerified: true }, { merge: true });
  }

  if (!userSnap.exists()) {
    // Safety fallback
    await setDoc(userRef, {
      email: user.email,
      role: "customer",
      emailVerified: user.emailVerified,
      createdAt: new Date()
    });
  }

  if (!user.emailVerified) {
    document.getElementById("msg").innerText =
      "Please verify your email first.";
    return;
  }

  window.location = "/public/my-account.html";
}

/* ======================
   AUTO UPDATE AFTER VERIFICATION
====================== */
onAuthStateChanged(auth, async (user) => {
  if (user && user.emailVerified) {
    const ref = doc(db, "users", user.uid);
    await setDoc(ref, { emailVerified: true }, { merge: true });
  }
});
import {
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ======================
   PASSWORD RESET
====================== */
window.resetPassword = async function () {

  const email = document.getElementById("email").value.trim();

  if (!email) {
    document.getElementById("msg").innerText =
      "Please enter your email to reset password.";
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    document.getElementById("msg").innerText =
      "Password reset email sent. Check your inbox.";
  } catch (err) {
    document.getElementById("msg").innerText = err.message;
  }
};

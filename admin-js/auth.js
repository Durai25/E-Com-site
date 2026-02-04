import { auth, db } from "../js/firebase.js";
import { doc, getDoc } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export function checkAdminAccess() {
  return new Promise((resolve, reject) => {

    onAuthStateChanged(auth, async user => {
      if (!user) {
        window.location = "login.html";
        return reject("Not logged in");
      }

      const ref = doc(db, "admins", user.email.toLowerCase());
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        alert("Access denied: Not an admin");
        return reject("No admin record");
      }

      if (!snap.data().active) {
        alert("Admin account disabled");
        return reject("Inactive admin");
      }

      resolve(snap.data().role);
    });
  });
}
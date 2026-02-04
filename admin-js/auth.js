import { auth, db } from "../js/firebase.js";
import { doc, getDoc } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export function checkRole() {
  return new Promise((resolve, reject) => {

    auth.onAuthStateChanged(async user => {
      console.log("Auth state changed:", user ? user.email : "no user");
      if (!user) {
        window.location = "login.html";
        return reject("Not logged in");
      }

      try {
        const snap = await getDoc(doc(db,"admins", user.email));
        console.log("Admin doc exists:", snap.exists(), snap.data());
        if (!snap.exists()) {
          alert("Access denied");
          auth.signOut();
          window.location = "login.html";
          return reject("Not an admin");
        }

        resolve(snap.data().role);

      } catch (err) {
        console.error("Error in checkRole:", err);
        reject(err.message);
      }

    });
  });
}
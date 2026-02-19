import { db } from "../js/firebase.js";
import { 
  collection, 
  setDoc, 
  doc, 
  getDocs, 
  deleteDoc, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const auth = getAuth();
const adminsRef = collection(db, "admins");

/* =======================
   SAVE ADMIN (Add/Update)
======================= */
window.saveAdmin = async function() {
  const editEmail = document.getElementById('editEmail').value;
  const isEdit = !!editEmail;
  
  try {
    const email = document.getElementById('email').value.trim();
    const role = document.getElementById('role').value;
    
    if (!email) return alert('Email is required');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return alert('Please enter a valid email');
    if (!['owner', 'manager', 'support'].includes(role)) return alert('Invalid role');
    
    if (isEdit && email !== editEmail) {
      return alert('Cannot change email. Delete and create new admin instead.');
    }

    await setDoc(doc(db, "admins", email), {
      role: role,
      active: true,
      updatedAt: new Date()
    });
    
    if (isEdit) {
      alert('Admin updated successfully');
    } else {
      alert('Admin added successfully');
    }
    clearForm();
    loadAdmins();
  } catch(e) {
    console.error(e);
    alert('Failed to save admin: ' + (e.message || 'Unknown error'));
  }
};

/* =======================
   CLEAR FORM
======================= */
window.clearForm = function() {
  document.getElementById('editEmail').value = '';
  document.getElementById('email').value = '';
  document.getElementById('role').value = 'owner';
  document.getElementById('formTitle').textContent = '➕ Add Admin';
  document.getElementById('saveBtn').textContent = 'Add Admin';
  
  // Remove selected class from all items
  document.querySelectorAll('.admin-item').forEach(item => {
    item.classList.remove('selected');
  });
};

/* =======================
   LOAD ADMINS - Realtime List
======================= */
function loadAdmins() {
  onSnapshot(adminsRef, (snap) => {
    const list = document.getElementById('adminList');
    
    if (snap.empty) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="icon">👥</div>
          <p>No admins found</p>
          <p>Add your first admin using the form on the left</p>
        </div>
      `;
      return;
    }

    list.innerHTML = "";

    snap.forEach((d) => {
      const admin = d.data();
      const email = d.id;

      // Get first letter for avatar
      const initial = email.charAt(0).toUpperCase();

      const item = document.createElement("div");
      item.className = "admin-item";
      item.onclick = () => populateForm(email, admin);

      const avatar = document.createElement("div");
      avatar.className = "admin-avatar";
      avatar.textContent = initial;

      const info = document.createElement("div");
      info.className = "admin-info";
      info.innerHTML = `
        <div class="email">${email}</div>
        <div class="role">
          <span class="role-badge ${admin.role}">${admin.role}</span>
        </div>
      `;

      const actions = document.createElement("div");
      actions.className = "admin-actions";
      actions.onclick = (e) => e.stopPropagation();

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.onclick = () => deleteAdmin(email);

      actions.appendChild(deleteBtn);

      item.appendChild(avatar);
      item.appendChild(info);
      item.appendChild(actions);

      list.appendChild(item);
    });
  });
}

/* =======================
   POPULATE FORM (Edit)
======================= */
function populateForm(email, admin) {
  // Highlight selected item
  document.querySelectorAll('.admin-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  // Find and select the clicked item
  const items = document.querySelectorAll('.admin-item');
  items.forEach(item => {
    if (item.onclick.toString().includes(email)) {
      item.classList.add('selected');
    }
  });

  document.getElementById('editEmail').value = email;
  document.getElementById('email').value = email;
  document.getElementById('role').value = admin.role || 'owner';
  
  document.getElementById('formTitle').textContent = '✏️ Edit Admin';
  document.getElementById('saveBtn').textContent = 'Update Admin';
  
  // Scroll to form on mobile
  if (window.innerWidth < 900) {
    document.querySelector('.admin-form-panel').scrollIntoView({ behavior: 'smooth' });
  }
}

/* =======================
   DELETE ADMIN
======================= */
window.deleteAdmin = async function(email) {
  // Prevent self-deletion
  const currentUser = auth.currentUser;
  if (currentUser && currentUser.email === email) {
    return alert('You cannot delete yourself!');
  }
  
  if (!confirm(`Are you sure you want to delete admin: ${email}?`)) return;

  try {
    await deleteDoc(doc(db, "admins", email));
    alert('Admin deleted successfully');
    
    // Clear form if we deleted the admin being edited
    if (document.getElementById('editEmail').value === email) {
      clearForm();
    }
  } catch(e) {
    console.error(e);
    alert('Failed to delete admin: ' + (e.message || 'Unknown error'));
  }
};

// Initialize
loadAdmins();

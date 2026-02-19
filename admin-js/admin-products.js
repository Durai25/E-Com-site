import { db } from "../js/firebase.js";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

import { checkAdminAccess } from "./auth.js";

const storage = getStorage();
const productsRef = collection(db, "products");

// Collection options for dropdown
const collectionOptions = [
  { value: "mens", label: "Men's Collection" },
  { value: "womens", label: "Women's Collection" },
  { value: "kids", label: "Kids Collection" },
  { value: "fancy", label: "Fancy Items" },
  { value: "new", label: "New Arrivals" }
];

/* =======================
   GOOGLE DRIVE IMAGE HELPER
======================= */
function getGoogleDriveImageUrl(driveLink) {
  if (!driveLink) return null;
  
  if (driveLink.includes('drive.google.com')) {
    let fileId = '';
    
    if (driveLink.includes('/file/d/')) {
      const match = driveLink.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match) fileId = match[1];
    } else if (driveLink.includes('?id=')) {
      const match = driveLink.match(/id=([a-zA-Z0-9_-]+)/);
      if (match) fileId = match[1];
    }
    
    if (fileId) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  }
  
  return driveLink;
}

/* =======================
   FORM FUNCTIONS
======================= */
window.saveProduct = async function () {
  const editId = document.getElementById('editProductId').value;
  const isEdit = !!editId;
  
  try {
    const name = document.getElementById("pname").value.trim();
    const price = Number(document.getElementById("price").value || 0);
    const category = document.getElementById("category").value;
    const stock = Number(document.getElementById("stock").value || 0);
    const file = document.getElementById("imageFile").files[0];
    const imageUrlInput = document.getElementById("imageUrl").value.trim();

    if (!name || !price) return alert("Please enter name and price");
    if (!category) return alert("Please select a collection");
    if (price <= 0) return alert("Price must be positive");
    if (stock < 0) return alert("Stock cannot be negative");

    let imageUrl = "";
    let imagePath = "";

    // Check if URL is provided
    if (imageUrlInput) {
      imageUrl = getGoogleDriveImageUrl(imageUrlInput);
    } else if (file) {
      if (!file.type.startsWith("image/"))
        return alert("Please select a valid image");
      if (file.size > 5 * 1024 * 1024)
        return alert("Image must be less than 5MB");

      imagePath = `products/${Date.now()}_${file.name}`;
      const imageRef = storageRef(storage, imagePath);
      await uploadBytes(imageRef, file);
      imageUrl = await getDownloadURL(imageRef);
    }

    if (isEdit) {
      // Update existing product
      const docRef = doc(db, "products", editId);
      const payload = { name, price, category, stock };
      
      if (imageUrl) {
        payload.image = imageUrl;
        if (imagePath) {
          payload.imagePath = imagePath;
        } else {
          payload.imagePath = "";
        }
      }

      await updateDoc(docRef, payload);
      alert("Product updated!");
      clearForm();
    } else {
      // Add new product
      if (!imageUrl && !file) {
        return alert("Please select an image file or paste an image URL");
      }

      await addDoc(productsRef, {
        name,
        price,
        category,
        stock,
        image: imageUrl,
        imagePath,
        createdAt: new Date()
      });

      alert("Product added!");
      clearForm();
    }

  } catch (e) {
    console.error(e);
    alert("Error: " + (e.message || "Unknown error"));
  }
};

window.clearForm = function () {
  document.getElementById('editProductId').value = '';
  document.getElementById('pname').value = '';
  document.getElementById('price').value = '';
  document.getElementById('category').value = '';
  document.getElementById('stock').value = '';
  document.getElementById('imageFile').value = '';
  document.getElementById('imageUrl').value = '';
  document.getElementById('formTitle').textContent = '➕ Add Product';
  document.getElementById('saveBtn').textContent = 'Add Product';
  
  // Remove selected class from all items
  document.querySelectorAll('.product-item').forEach(item => {
    item.classList.remove('selected');
  });
};

window.editProduct = function (id) {
  // This will be called when clicking on a product
};

/* =======================
   AUTH + REALTIME LIST
======================= */
(async () => {
  const role = await checkAdminAccess();
  if (!role) return;

  // realtime products list
  onSnapshot(productsRef, (snap) => {
    const list = document.getElementById("productList");
    
    if (snap.empty) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="icon">📦</div>
          <p>No products found</p>
          <p>Add your first product using the form on the left</p>
        </div>
      `;
      return;
    }

    list.innerHTML = "";

    snap.forEach((d) => {
      const p = d.data();
      const id = d.id;

      // Get category label
      const categoryObj = collectionOptions.find(c => c.value === p.category);
      const categoryLabel = categoryObj ? categoryObj.label : p.category || 'Uncategorized';

      const item = document.createElement("div");
      item.className = "product-item";
      item.onclick = () => populateForm(id, p);

      const img = document.createElement("img");
      img.src = p.image || "https://via.placeholder.com/60?text=No+Img";
      img.alt = p.name || "Product";

      const info = document.createElement("div");
      info.className = "product-item-info";
      info.innerHTML = `
        <h4>${p.name || 'Unknown'}</h4>
        <div class="price">₹${p.price || 0}</div>
        <span class="category">${categoryLabel}</span>
      `;

      const actions = document.createElement("div");
      actions.className = "product-item-actions";
      actions.onclick = (e) => e.stopPropagation();

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.onclick = () => deleteProduct(id);

      actions.appendChild(deleteBtn);

      item.appendChild(img);
      item.appendChild(info);
      item.appendChild(actions);

      list.appendChild(item);
    });
  });
})();

function populateForm(id, product) {
  // Highlight selected item
  document.querySelectorAll('.product-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  // Find and select the clicked item
  const items = document.querySelectorAll('.product-item');
  items.forEach(item => {
    if (item.onclick.toString().includes(id)) {
      item.classList.add('selected');
    }
  });

  document.getElementById('editProductId').value = id;
  document.getElementById('pname').value = product.name || '';
  document.getElementById('price').value = product.price || '';
  document.getElementById('category').value = product.category || '';
  document.getElementById('stock').value = product.stock || '';
  document.getElementById('imageUrl').value = '';
  document.getElementById('imageFile').value = '';
  
  document.getElementById('formTitle').textContent = '✏️ Edit Product';
  document.getElementById('saveBtn').textContent = 'Update Product';
  
  // Scroll to form on mobile
  if (window.innerWidth < 900) {
    document.querySelector('.product-form-panel').scrollIntoView({ behavior: 'smooth' });
  }
}

/* =======================
   DELETE PRODUCT
======================= */
window.deleteProduct = async function (id) {
  if (!confirm("Are you sure you want to delete this product?")) return;

  try {
    const d = await getDoc(doc(db, "products", id));
    if (d.exists() && d.data().imagePath) {
      try {
        await deleteObject(storageRef(storage, d.data().imagePath));
      } catch (e) {
        console.warn("Failed to delete image", e);
      }
    }
  } catch (e) {
    console.warn("Pre-delete fetch failed", e);
  }

  await deleteDoc(doc(db, "products", id));
  alert("Product deleted");
  
  // Clear form if we deleted the product being edited
  if (document.getElementById('editProductId').value === id) {
    clearForm();
  }
};

import { db, auth } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ordersContainer = document.getElementById("ordersContainer");

/* =======================
   LOAD CUSTOMER ORDERS
======================= */
async function loadCustomerOrders() {
  const user = auth.currentUser;
  
  if (!user) {
    ordersContainer.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔒</div>
        <p>Please login to view your orders</p>
        <a href="login.html" class="btn-primary">Login</a>
      </div>
    `;
    return;
  }

  try {
    // Query orders by userId
    const q = query(
      collection(db, "orders"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      ordersContainer.innerHTML = `
        <div class="empty-state">
          <div class="icon">📦</div>
          <p>No orders yet</p>
          <a href="index.html" class="btn-primary">Start Shopping</a>
        </div>
      `;
      return;
    }

    let html = "";
    
    snap.forEach((doc) => {
      const order = doc.data();
      const orderId = doc.id;
      const date = order.createdAt?.toDate 
        ? order.createdAt.toDate().toLocaleString() 
        : "N/A";
      
      const statusClass = getStatusClass(order.orderStatus || "Pending");
      const paymentStatusClass = order.paymentStatus === "Paid" ? "paid" : "pending";

      // Build items HTML
      let itemsHtml = "";
      (order.items || []).forEach((item) => {
        itemsHtml += `
          <div class="order-item">
            <img src="${item.image || 'https://via.placeholder.com/60?text=No+Img'}" alt="${item.name}">
            <div class="item-details">
              <h4>${item.name || 'Product'}</h4>
              <p class="price">₹${item.price || 0}</p>
            </div>
          </div>
        `;
      });

      html += `
        <div class="order-card">
          <div class="order-header">
            <div class="order-info">
              <h3>Order #${orderId.substring(0, 8)}</h3>
              <p class="order-date">${date}</p>
            </div>
            <div class="order-status ${statusClass}">
              ${order.orderStatus || "Pending"}
            </div>
          </div>
          
          <div class="order-items">
            ${itemsHtml}
          </div>
          
          <div class="order-footer">
            <div class="payment-info">
              <span class="payment-status ${paymentStatusClass}">
                ${order.paymentStatus === "Paid" ? "✅ Paid" : "⏳ Pending"}
              </span>
            </div>
            <div class="order-total">
              <span>Total:</span>
              <strong>₹${order.total || 0}</strong>
            </div>
          </div>
          
          <div class="order-actions">
            <button onclick="viewOrderDetails('${orderId}')" class="btn-secondary">
              View Details
            </button>
            ${order.paymentId ? `
              <button onclick="downloadInvoice('${orderId}')" class="btn-outline">
                📥 Download Invoice
              </button>
            ` : ''}
          </div>
        </div>
      `;
    });

    ordersContainer.innerHTML = html;

  } catch (e) {
    console.error("Error loading orders:", e);
    ordersContainer.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <p>Error loading orders</p>
        <p class="error-msg">${e.message}</p>
      </div>
    `;
  }
}

/* =======================
   HELPERS
======================= */
function getStatusClass(status) {
  const statusMap = {
    "Pending": "status-pending",
    "Packed": "status-packed",
    "Shipped": "status-shipped",
    "Delivered": "status-delivered"
  };
  return statusMap[status] || "status-pending";
}

/* =======================
   VIEW ORDER DETAILS
======================= */
window.viewOrderDetails = function(orderId) {
  // For now, show a simple alert - could be expanded to a modal
  alert(`Order ID: ${orderId}\nContact support for detailed tracking.`);
};

/* =======================
   DOWNLOAD INVOICE
======================= */
window.downloadInvoice = async function(orderId) {
  try {
    const { db } = await import("./firebase.js");
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    
    const snap = await getDoc(doc(db, "orders", orderId));
    if (!snap.exists()) {
      alert("Order not found");
      return;
    }
    
    const order = snap.data();
    const m = await import("./invoice.js");
    m.generateInvoice(order);
  } catch (e) {
    console.error(e);
    alert("Failed to download invoice: " + (e.message || "Unknown error"));
  }
};

// Initialize
loadCustomerOrders();


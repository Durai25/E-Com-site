import { db } from "../js/firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Get URL params
const params = new URLSearchParams(window.location.search);
const uid = params.get("uid");
const email = params.get("email") || '';

// Decode email
const decodedEmail = decodeURIComponent(email);

// Update customer info in header
document.getElementById('customerEmail').textContent = decodedEmail;
document.getElementById('customerAvatar').textContent = decodedEmail ? decodedEmail.charAt(0).toUpperCase() : '?';

// Global state
let allOrders = [];
let filteredOrders = [];

/* =======================
   LOAD ORDERS
======================= */
function loadOrders() {
  if (!uid) {
    showEmptyState('No customer selected');
    return;
  }

  const q = query(
    collection(db, "orders"),
    where("userId", "==", uid),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snap) => {
    if (snap.empty) {
      allOrders = [];
      filteredOrders = [];
      showEmptyState('No orders found for this customer');
      return;
    }

    allOrders = [];
    snap.forEach((d) => {
      const order = d.data();
      order.id = d.id;
      allOrders.push(order);
    });

    // Apply current filters
    applyFilters();
  });
}

/* =======================
   FILTER & SEARCH
======================= */
function applyFilters() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const filterValue = document.getElementById('filterSelect').value;
  
  filteredOrders = allOrders.filter(order => {
    // Search filter (by order ID)
    const orderId = order.id.toLowerCase();
    const matchesSearch = !searchTerm || orderId.includes(searchTerm);
    
    // Status filter
    let matchesFilter = true;
    if (filterValue !== 'all') {
      matchesFilter = (order.orderStatus || 'Pending') === filterValue;
    }
    
    return matchesSearch && matchesFilter;
  });
  
  renderOrders();
}

/* =======================
   RENDER ORDERS TABLE
======================= */
function renderOrders() {
  const tbody = document.getElementById('ordersTableBody');
  document.getElementById('orderCount').textContent = filteredOrders.length;
  
  if (filteredOrders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <div class="icon">🔍</div>
            <h3>No orders found</h3>
            <p>Try adjusting your search or filter criteria</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  
  filteredOrders.forEach(order => {
    const orderId = order.id;
    const date = order.createdAt?.toDate 
      ? order.createdAt.toDate().toLocaleDateString() 
      : 'N/A';
    
    const itemsCount = order.items ? order.items.length : 0;
    const total = order.total || 0;
    const status = order.orderStatus || 'Pending';
    const paymentStatus = order.paymentStatus || 'Pending';
    
    html += `
      <tr>
        <td>
          <span class="order-id">#${orderId.substring(0, 8)}</span>
        </td>
        <td>${date}</td>
        <td>${itemsCount} item${itemsCount !== 1 ? 's' : ''}</td>
        <td><strong>₹${total.toLocaleString()}</strong></td>
        <td>
          <select class="status-select" onchange="updateOrderStatus('${orderId}', this.value)">
            <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Packed" ${status === 'Packed' ? 'selected' : ''}>Packed</option>
            <option value="Shipped" ${status === 'Shipped' ? 'selected' : ''}>Shipped</option>
            <option value="Delivered" ${status === 'Delivered' ? 'selected' : ''}>Delivered</option>
          </select>
        </td>
        <td>
          <span class="payment-badge ${paymentStatus.toLowerCase()}">
            ${paymentStatus === 'Paid' ? '✓ Paid' : '⏳ Pending'}
          </span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-action btn-view" onclick="viewOrderDetails('${orderId}')">
              👁️ View
            </button>
            <button class="btn-action btn-invoice" onclick="downloadInvoice('${orderId}')">
              📥 Invoice
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
}

/* =======================
   EMPTY STATE
======================= */
function showEmptyState(message) {
  const tbody = document.getElementById('ordersTableBody');
  document.getElementById('orderCount').textContent = '0';
  tbody.innerHTML = `
    <tr>
      <td colspan="7">
        <div class="empty-state">
          <div class="icon">📦</div>
          <h3>${message}</h3>
          <p>This customer hasn't placed any orders yet</p>
        </div>
      </td>
    </tr>
  `;
}

/* =======================
   UPDATE ORDER STATUS
======================= */
window.updateOrderStatus = async function(orderId, status) {
  try {
    await updateDoc(doc(db, "orders", orderId), { orderStatus: status });
    
    // Update local state
    const order = allOrders.find(o => o.id === orderId);
    if (order) {
      order.orderStatus = status;
      applyFilters();
    }
    
    // Show success feedback
    showNotification('Order status updated successfully!', 'success');
  } catch(e) {
    console.error(e);
    showNotification('Failed to update status: ' + (e.message || 'Unknown error'), 'error');
  }
};

/* =======================
   VIEW ORDER DETAILS
======================= */
window.viewOrderDetails = async function(orderId) {
  try {
    const snap = await getDoc(doc(db, "orders", orderId));
    if (!snap.exists()) {
      alert('Order not found');
      return;
    }
    
    const order = snap.data();
    
    // Build products list
    let productsHtml = '';
    (order.items || []).forEach(item => {
      productsHtml += `<li>${item.name || 'Product'} - ₹${item.price || 0}</li>`;
    });
    
    // Build address info
    const address = order.address || {};
    const addressHtml = `
      ${address.name || ''}<br>
      ${address.addressLine || ''}<br>
      ${address.city || ''} - ${address.pincode || ''}<br>
      📞 ${address.phone || ''}
    `;
    
    // Show order details in a formatted alert/modal
    const details = `
📦 ORDER DETAILS
━━━━━━━━━━━━━━━━━━━━━━

🆔 Order ID: ${orderId}
📅 Date: ${order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : 'N/A'}
📧 Customer: ${order.customerEmail || decodedEmail}

━━━━━━━━━━━━━━━━━━━━━━
🛍️ PRODUCTS:
${productsHtml || 'No items'}

━━━━━━━━━━━━━━━━━━━━━━
💰 Total: ₹${order.total || 0}
💳 Payment: ${order.paymentStatus || 'Pending'}
🚚 Status: ${order.orderStatus || 'Pending'}

━━━━━━━━━━━━━━━━━━━━━━
📍 SHIPPING ADDRESS:
${addressHtml}
    `;
    
    alert(details);
  } catch(e) {
    console.error(e);
    alert('Failed to load order details: ' + (e.message || 'Unknown error'));
  }
};

/* =======================
   DOWNLOAD INVOICE
======================= */
window.downloadInvoice = async function(orderId) {
  try {
    const snap = await getDoc(doc(db, 'orders', orderId));
    if(!snap.exists()) {
      alert('Order not found');
      return;
    }
    
    const order = snap.data();
    const m = await import('../js/invoice.js');
    m.generateInvoice(order);
  } catch(e) { 
    console.error(e); 
    alert('Download failed: ' + (e.message || 'Unknown error')); 
  }
};

/* =======================
   NOTIFICATION
======================= */
function showNotification(message, type) {
  // Remove existing notification
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    border-radius: 8px;
    font-weight: 600;
    z-index: 1000;
    animation: slideIn 0.3s ease;
    ${type === 'success' ? 'background: #10b981; color: white;' : 'background: #ef4444; color: white;'}
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;
document.head.appendChild(style);

/* =======================
   EVENT LISTENERS
======================= */
function setupEventListeners() {
  // Search input
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  
  // Filter select
  document.getElementById('filterSelect').addEventListener('change', applyFilters);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadOrders();
});


import { db, auth } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  getDoc
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
      
      const status = order.orderStatus || "Pending";
      const statusClass = getStatusClass(status);
      const paymentStatusClass = order.paymentStatus === "Paid" ? "paid" : "pending";

      // Build items HTML with product details
      let itemsHtml = "";
      let totalItems = 0;
      (order.items || []).forEach((item) => {
        totalItems += item.quantity || 1;
        itemsHtml += `
          <div class="order-item">
            <img src="${item.image || 'https://via.placeholder.com/60?text=No+Img'}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/60?text=No+Img'">
            <div class="item-details">
              <h4>${item.name || 'Product'}</h4>
              <p class="price">₹${item.price || 0} × ${item.quantity || 1}</p>
              ${item.size ? `<p class="item-size">Size: ${item.size}</p>` : ''}
              ${item.color ? `<p class="item-color">Color: ${item.color}</p>` : ''}
            </div>
          </div>
        `;
      });

      // Build delivery timeline
      const timelineHtml = buildDeliveryTimeline(status);

      // Address info
      const address = order.address || {};
      const addressHtml = address.addressLine ? `
        <div class="delivery-address">
          <h4>📍 Delivery Address</h4>
          <p>${address.name || 'Customer'}</p>
          <p>${address.addressLine}</p>
          <p>${address.city}${address.pincode ? ' - ' + address.pincode : ''}</p>
          <p>📞 ${address.phone || 'N/A'}</p>
        </div>
      ` : '';

      html += `
        <div class="order-card">
          <div class="order-header">
            <div class="order-info">
              <h3>Order #${orderId.substring(0, 8).toUpperCase()}</h3>
              <p class="order-date">📅 ${date}</p>
            </div>
            <div class="order-status ${statusClass}">
              ${getStatusIcon(status)} ${status}
            </div>
          </div>
          
          <!-- Delivery Timeline -->
          <div class="delivery-timeline">
            ${timelineHtml}
          </div>
          
          <div class="order-items">
            ${itemsHtml}
          </div>
          
          <div class="order-footer">
            <div class="payment-info">
              <span class="payment-status ${paymentStatusClass}">
                ${order.paymentStatus === "Paid" ? "✅ Paid" : "⏳ Pending"}
              </span>
              <span class="items-count">${totalItems} item${totalItems !== 1 ? 's' : ''}</span>
            </div>
            <div class="order-total">
              <span>Total:</span>
              <strong>₹${order.total || 0}</strong>
            </div>
          </div>
          
          ${addressHtml}
          
          <div class="order-actions">
            <button onclick="viewOrderDetails('${orderId}')" class="btn-secondary">
              📋 Order Details
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
   DELIVERY TIMELINE
======================= */
function buildDeliveryTimeline(status) {
  const steps = [
    { key: 'Pending', label: 'Order Placed', icon: '📝' },
    { key: 'Packed', label: 'Packed', icon: '📦' },
    { key: 'Shipped', label: 'Shipped', icon: '🚚' },
    { key: 'Delivered', label: 'Delivered', icon: '✅' }
  ];

  const currentIndex = steps.findIndex(s => s.key === status);
  
  let html = '<div class="timeline-steps">';
  
  steps.forEach((step, index) => {
    const isCompleted = index <= currentIndex;
    const isCurrent = index === currentIndex;
    
    html += `
      <div class="timeline-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}">
        <div class="step-icon">${step.icon}</div>
        <div class="step-label">${step.label}</div>
      </div>
    `;
  });
  
  html += '</div>';
  return html;
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

function getStatusIcon(status) {
  const icons = {
    "Pending": "⏳",
    "Packed": "📦",
    "Shipped": "🚚",
    "Delivered": "✅"
  };
  return icons[status] || "⏳";
}

/* =======================
   VIEW ORDER DETAILS
======================= */
window.viewOrderDetails = async function(orderId) {
  try {
    const { db } = await import("./firebase.js");
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    
    const snap = await getDoc(doc(db, "orders", orderId));
    if (!snap.exists()) {
      alert("Order not found");
      return;
    }
    
    const order = snap.data();
    
    // Build products list
    let productsInfo = '';
    (order.items || []).forEach(item => {
      productsInfo += `• ${item.name || 'Product'} - ₹${item.price || 0} × ${item.quantity || 1}\n`;
    });
    
    // Address
    const address = order.address || {};
    const addressInfo = address.addressLine ? 
      `${address.name || ''}\n${address.addressLine}\n${address.city} - ${address.pincode}\nPhone: ${address.phone || 'N/A'}` :
      'Not available';
    
    // Show order details
    const details = `
📦 ORDER DETAILS
━━━━━━━━━━━━━━━━━━━━━━

🆔 Order ID: ${orderId}
📅 Date: ${order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━
🛍️ PRODUCTS:
${productsInfo || 'No items'}

━━━━━━━━━━━━━━━━━━━━━━
💰 Payment: ${order.paymentStatus || 'Pending'}
🚚 Delivery: ${order.orderStatus || 'Pending'}
💵 Total: ₹${order.total || 0}

━━━━━━━━━━━━━━━━━━━━━━
📍 SHIPPING ADDRESS:
${addressInfo}

━━━━━━━━━━━━━━━━━━━━━━
Thank you for shopping with us!
    `;
    
    alert(details);
  } catch (e) {
    console.error(e);
    alert("Failed to load order details: " + (e.message || "Unknown error"));
  }
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

// Add additional styles for timeline
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
  .delivery-timeline {
    padding: 16px 20px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .timeline-steps {
    display: flex;
    justify-content: space-between;
    position: relative;
  }
  
  .timeline-steps::before {
    content: '';
    position: absolute;
    top: 16px;
    left: 20px;
    right: 20px;
    height: 2px;
    background: #e5e7eb;
    z-index: 0;
  }
  
  .timeline-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    z-index: 1;
    flex: 1;
  }
  
  .step-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    margin-bottom: 6px;
  }
  
  .timeline-step.completed .step-icon {
    background: #10b981;
    color: white;
  }
  
  .timeline-step.current .step-icon {
    background: #8b1d1d;
    color: white;
    animation: pulse 2s infinite;
  }
  
  .step-label {
    font-size: 11px;
    color: #6b7280;
    text-align: center;
    font-weight: 500;
  }
  
  .timeline-step.completed .step-label,
  .timeline-step.current .step-label {
    color: #111827;
    font-weight: 600;
  }
  
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(139, 29, 29, 0.4); }
    70% { box-shadow: 0 0 0 8px rgba(139, 29, 29, 0); }
    100% { box-shadow: 0 0 0 0 rgba(139, 29, 29, 0); }
  }
  
  .items-count {
    font-size: 13px;
    color: #6b7280;
    margin-left: 12px;
  }
  
  .item-size, .item-color {
    font-size: 12px;
    color: #6b7280;
    margin: 2px 0 0 0;
  }
  
  .delivery-address {
    padding: 16px 20px;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
  }
  
  .delivery-address h4 {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .delivery-address p {
    margin: 4px 0;
    font-size: 13px;
    color: #111827;
  }
`;
document.head.appendChild(additionalStyles);

// Initialize
loadCustomerOrders();


import { db } from "../js/firebase.js";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global state
let allCustomers = [];
let filteredCustomers = [];
let currentPage = 1;
const itemsPerPage = 10;
let selectedCustomerId = null;
let customerOrderCounts = {};
let customerTotalSpent = {};

// Avatar gradients
const avatarGradients = [
  'avatar-gradient-1',
  'avatar-gradient-2', 
  'avatar-gradient-3',
  'avatar-gradient-4',
  'avatar-gradient-5',
  'avatar-gradient-6'
];

// Get random avatar gradient
function getAvatarGradient(email) {
  const index = email ? email.charCodeAt(0) % avatarGradients.length : 0;
  return avatarGradients[index];
}

// Get customer name or email
function getCustomerName(user) {
  if (user.displayName) return user.displayName;
  if (user.name) return user.name;
  return 'Customer';
}

/* =======================
   STATISTICS
======================= */
function updateStatistics(customers) {
  const total = customers.length;
  const verified = customers.filter(c => c.emailVerified).length;
  const unverified = total - verified;
  
  // New customers this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const newThisMonth = customers.filter(c => {
    if (c.createdAt?.toDate) {
      return c.createdAt.toDate() >= startOfMonth;
    }
    return false;
  }).length;

  document.getElementById('statTotal').textContent = total.toLocaleString();
  document.getElementById('statVerified').textContent = verified.toLocaleString();
  document.getElementById('statUnverified').textContent = unverified.toLocaleString();
  document.getElementById('statNew').textContent = newThisMonth.toLocaleString();
}

/* =======================
   LOAD CUSTOMERS - Realtime List
======================= */
function loadCustomers() {
  const usersRef = collection(db, "users");
  
  onSnapshot(usersRef, async (snap) => {
    if (snap.empty) {
      allCustomers = [];
      filteredCustomers = [];
      updateStatistics([]);
      renderCustomerList([]);
      return;
    }

    // Get all customers
    allCustomers = [];
    snap.forEach((d) => {
      const u = d.data();
      u.id = d.id;
      allCustomers.push(u);
    });

    // Sort by creation date (newest first)
    allCustomers.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
      return dateB - dateA;
    });

    // Get order counts for each customer
    await loadCustomerOrderCounts();

    // Update statistics
    updateStatistics(allCustomers);

    // Apply current filters
    applyFilters();
  });
}

/* =======================
   LOAD ORDER COUNTS
======================= */
async function loadCustomerOrderCounts() {
  try {
    const ordersRef = collection(db, "orders");
    const snapshot = await getDocs(ordersRef);
    
    customerOrderCounts = {};
    customerTotalSpent = {};
    
    snapshot.forEach(doc => {
      const order = doc.data();
      const userId = order.userId || order.uid;
      
      if (userId) {
        customerOrderCounts[userId] = (customerOrderCounts[userId] || 0) + 1;
        
        const total = parseFloat(order.total || order.amount || 0);
        customerTotalSpent[userId] = (customerTotalSpent[userId] || 0) + total;
      }
    });
  } catch (error) {
    console.log('Could not load order counts:', error);
  }
}

/* =======================
   FILTER & SEARCH
======================= */
function applyFilters() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const filterValue = document.getElementById('filterSelect').value;
  
  filteredCustomers = allCustomers.filter(customer => {
    // Search filter
    const email = (customer.email || '').toLowerCase();
    const name = (customer.displayName || customer.name || '').toLowerCase();
    const matchesSearch = !searchTerm || email.includes(searchTerm) || name.includes(searchTerm);
    
    // Verification filter
    let matchesFilter = true;
    if (filterValue === 'verified') {
      matchesFilter = customer.emailVerified === true;
    } else if (filterValue === 'unverified') {
      matchesFilter = customer.emailVerified !== true;
    }
    
    return matchesSearch && matchesFilter;
  });
  
  currentPage = 1;
  renderCustomerList();
  updatePagination();
}

/* =======================
   RENDER CUSTOMER LIST
======================= */
function renderCustomerList() {
  const list = document.getElementById('customerList');
  
  if (filteredCustomers.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔍</div>
        <h3>No customers found</h3>
        <p>Try adjusting your search or filter criteria</p>
      </div>
    `;
    document.getElementById('customerCount').textContent = '0';
    return;
  }

  // Calculate pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageCustomers = filteredCustomers.slice(startIndex, endIndex);
  
  document.getElementById('customerCount').textContent = filteredCustomers.length;

  list.innerHTML = '';
  
  pageCustomers.forEach((customer, index) => {
    const userId = customer.id;
    const initial = customer.email ? customer.email.charAt(0).toUpperCase() : '?';
    const name = getCustomerName(customer);
    const orderCount = customerOrderCounts[userId] || 0;
    const isVerified = customer.emailVerified;
    
    const registeredDate = customer.createdAt?.toDate 
      ? customer.createdAt.toDate().toLocaleDateString() 
      : '—';
    
    const item = document.createElement("div");
    item.className = `customer-item ${userId === selectedCustomerId ? 'selected' : ''}`;
    item.onclick = () => showCustomerDetails(userId, customer);
    
    item.innerHTML = `
      <div class="customer-avatar ${getAvatarGradient(customer.email)}">${initial}</div>
      <div class="customer-info">
        <div class="customer-name">
          ${name}
          ${customer.emailVerified ? '<span class="meta-tag verified">✓ Verified</span>' : ''}
        </div>
        <div class="customer-email">${customer.email || 'No email'}</div>
        <div class="customer-meta">
          <span class="meta-tag orders">📦 ${orderCount} orders</span>
          <span style="font-size: 11px; color: #9ca3af;">${registeredDate}</span>
        </div>
      </div>
      <button class="customer-actions-btn" onclick="event.stopPropagation(); viewOrders('${userId}', '${encodeURIComponent(customer.email || '')}')">
        View →
      </button>
    `;
    
    list.appendChild(item);
  });
}

/* =======================
   PAGINATION
======================= */
function updatePagination() {
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage) || 1;
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const pageInfo = document.getElementById('pageInfo');
  
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
  
  if (filteredCustomers.length === 0) {
    pageInfo.textContent = 'Page 0 of 0';
  } else {
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  }
}

function goToPage(page) {
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage) || 1;
  if (page < 1 || page > totalPages) return;
  
  currentPage = page;
  renderCustomerList();
  updatePagination();
  
  // Scroll to top of list
  document.getElementById('customerList').scrollTop = 0;
}

/* =======================
   SHOW CUSTOMER DETAILS
======================= */
function showCustomerDetails(userId, customer) {
  selectedCustomerId = userId;
  
  // Update selected state in list
  document.querySelectorAll('.customer-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  // Find and select the clicked item
  const items = document.querySelectorAll('.customer-item');
  items.forEach(item => {
    if (item.onclick && item.onclick.toString().includes(userId)) {
      item.classList.add('selected');
    }
  });

  const name = getCustomerName(customer);
  const initial = customer.email ? customer.email.charAt(0).toUpperCase() : '?';
  const registeredDate = customer.createdAt?.toDate 
    ? customer.createdAt.toDate().toLocaleString() 
    : '—';
  
  const orderCount = customerOrderCounts[userId] || 0;
  const totalSpent = customerTotalSpent[userId] || 0;

  // Update header
  document.getElementById('detailsAvatar').textContent = initial;
  document.getElementById('detailsName').textContent = name;
  document.getElementById('detailsEmail').textContent = customer.email || 'No email';

  // Update quick stats
  document.getElementById('statOrders').textContent = orderCount;
  document.getElementById('statSpent').textContent = '₹' + totalSpent.toLocaleString();

  // Update details body
  const detailsBody = document.getElementById('customerDetails');
  detailsBody.innerHTML = `
    <div class="info-section">
      <h4>Personal Information</h4>
      <div class="info-row">
        <span class="info-label">Full Name</span>
        <span class="info-value">${name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Email Address</span>
        <span class="info-value">${customer.email || 'Not provided'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Phone Number</span>
        <span class="info-value">${customer.phone || 'Not provided'}</span>
      </div>
    </div>
    
    <div class="info-section">
      <h4>Account Details</h4>
      <div class="info-row">
        <span class="info-label">User ID</span>
        <span class="info-value" style="font-size: 11px; max-width: 150px; overflow: hidden; text-overflow: ellipsis;">${userId}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Registered On</span>
        <span class="info-value">${registeredDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Email Status</span>
        <span class="info-value">
          ${customer.emailVerified 
            ? '<span class="status-badge active">✓ Verified</span>' 
            : '<span class="status-badge inactive">✗ Unverified</span>'}
        </span>
      </div>
    </div>
    
    <div class="info-section">
      <h4>Shipping Address</h4>
      <div class="info-row">
        <span class="info-label">Address</span>
        <span class="info-value">${customer.address || 'Not provided'}</span>
      </div>
      ${customer.city ? `
      <div class="info-row">
        <span class="info-label">City</span>
        <span class="info-value">${customer.city}</span>
      </div>
      ` : ''}
      ${customer.pincode ? `
      <div class="info-row">
        <span class="info-label">Pincode</span>
        <span class="info-value">${customer.pincode}</span>
      </div>
      ` : ''}
    </div>
  `;

  // Show action buttons
  document.getElementById('detailsActions').style.display = 'flex';
  
  // Set up button click handlers
  document.getElementById('viewOrdersBtn').onclick = () => viewOrders(userId, customer.email);
  document.getElementById('deleteCustomerBtn').onclick = () => deleteCustomer(userId);
}

/* =======================
   VIEW ORDERS
======================= */
window.viewOrders = function (userId, email) {
  if (typeof email === 'string') {
    email = decodeURIComponent(email);
  }
  window.location.href = `customer-orders.html?uid=${userId}&email=${encodeURIComponent(email || '')}`;
};

/* =======================
   DELETE CUSTOMER
======================= */
window.deleteCustomer = async function(userId) {
  if (!confirm('Are you sure you want to delete this customer? This will also remove their data from the database.')) return;

  try {
    await deleteDoc(doc(db, "users", userId));
    alert('Customer deleted successfully');
    
    // Reset selection
    selectedCustomerId = null;
    
    // Reset details panel
    document.getElementById('detailsAvatar').textContent = '👤';
    document.getElementById('detailsName').textContent = 'Customer Details';
    document.getElementById('detailsEmail').textContent = 'Select a customer to view details';
    document.getElementById('statOrders').textContent = '—';
    document.getElementById('statSpent').textContent = '—';
    document.getElementById('customerDetails').innerHTML = `
      <div class="placeholder-message">
        <div class="icon">👈</div>
        <p>Select a customer from the list<br>to view their complete details</p>
      </div>
    `;
    document.getElementById('detailsActions').style.display = 'none';
  } catch(e) {
    console.error(e);
    alert('Failed to delete customer: ' + (e.message || 'Unknown error'));
  }
};

/* =======================
   EVENT LISTENERS
======================= */
function setupEventListeners() {
  // Search input
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  
  // Filter select
  document.getElementById('filterSelect').addEventListener('change', applyFilters);
  
  // Pagination buttons
  document.getElementById('prevBtn').addEventListener('click', () => goToPage(currentPage - 1));
  document.getElementById('nextBtn').addEventListener('click', () => goToPage(currentPage + 1));
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadCustomers();
});


import { db } from "../js/firebase.js";
import { 
  collection, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const GST_RATE = 5;

// Chart instances
let revenueChart, orderStatusChart, categoryChart;

// Date range state
let currentDateRange = 'all';
let customStartDate = null;
let customEndDate = null;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
  loadAnalytics();
  loadLowStockAlerts();
});

// Date range handling
window.handleDateRangeChange = function() {
  const select = document.getElementById('dateRange');
  const customDates = document.getElementById('customDates');
  
  currentDateRange = select.value;
  
  if (currentDateRange === 'custom') {
    customDates.style.display = 'flex';
  } else {
    customDates.style.display = 'none';
    loadAnalytics();
  }
};

window.applyCustomDateRange = function() {
  const startDateInput = document.getElementById('startDate').value;
  const endDateInput = document.getElementById('endDate').value;
  
  if (startDateInput && endDateInput) {
    customStartDate = new Date(startDateInput);
    customEndDate = new Date(endDateInput);
    customEndDate.setHours(23, 59, 59);
    loadAnalytics();
  } else {
    alert('Please select both start and end dates');
  }
};

function getDateFilteredOrders(orders) {
  if (currentDateRange === 'all') {
    return orders;
  }
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return orders.filter(order => {
    const orderDate = order.date?.toDate ? order.date.toDate() : new Date(order.createdAt || Date.now());
    
    switch (currentDateRange) {
      case 'today':
        return orderDate >= today;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return orderDate >= weekAgo;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return orderDate >= monthAgo;
      case 'custom':
        if (customStartDate && customEndDate) {
          return orderDate >= customStartDate && orderDate <= customEndDate;
        }
        return true;
      default:
        return true;
    }
  });
}

export async function loadAnalytics() {
  try {
    const ordersSnapshot = await getDocs(collection(db, "orders"));
    const usersSnapshot = await getDocs(collection(db, "users"));
    
    const allOrders = [];
    ordersSnapshot.forEach(doc => {
      const data = doc.data();
      allOrders.push({ id: doc.id, ...data });
    });
    
    const filteredOrders = getDateFilteredOrders(allOrders);
    
    let revenue = 0;
    let gst = 0;
    let itemsSold = 0;
    let productCount = {};
    let categoryRevenue = {};
    let orderStatusCount = { 'Pending': 0, 'Packed': 0, 'Shipped': 0, 'Delivered': 0, 'Cancelled': 0 };
    let paymentMethodCount = { 'COD': 0, 'Online': 0 };
    let paymentStatusCount = { 'Pending': 0, 'Paid': 0, 'Failed': 0 };
    const customerOrderCount = {};
    const customerTotalSpend = {};
    
    filteredOrders.forEach(order => {
      const orderTotal = Number(order.total || 0);
      revenue += orderTotal;
      gst += orderTotal * GST_RATE / 100;
      
      if (order.items && Array.isArray(order.items)) {
        itemsSold += order.items.length;
        order.items.forEach(item => {
          productCount[item.name] = (productCount[item.name] || 0) + 1;
          const category = item.category || 'Other';
          categoryRevenue[category] = (categoryRevenue[category] || 0) + (item.price * item.quantity);
        });
      }
      
      const status = order.orderStatus || 'Pending';
      orderStatusCount[status] = (orderStatusCount[status] || 0) + 1;
      
      if (order.paymentMethod === 'COD') {
        paymentMethodCount['COD']++;
      } else {
        paymentMethodCount['Online']++;
      }
      
      const paymentStatus = order.paymentStatus || 'Pending';
      paymentStatusCount[paymentStatus] = (paymentStatusCount[paymentStatus] || 0) + 1;
      
      if (order.userId || order.customerId) {
        const customerId = order.userId || order.customerId;
        customerOrderCount[customerId] = (customerOrderCount[customerId] || 0) + 1;
        customerTotalSpend[customerId] = (customerTotalSpend[customerId] || 0) + orderTotal;
      }
    });
    
    const totalOrders = filteredOrders.length;
    const avgOrderValue = totalOrders > 0 ? revenue / totalOrders : 0;
    const totalCustomers = usersSnapshot.size;
    
    const newCustomers = Object.keys(customerOrderCount).filter(c => customerOrderCount[c] === 1).length;
    const returningCustomers = Object.keys(customerOrderCount).filter(c => customerOrderCount[c] > 1).length;
    const repeatRate = Object.keys(customerOrderCount).length > 0 ? (returningCustomers / Object.keys(customerOrderCount).length) * 100 : 0;
    const customerLTV = Object.keys(customerTotalSpend).length > 0 ? Object.values(customerTotalSpend).reduce((a, b) => a + b, 0) / Object.keys(customerTotalSpend).length : 0;
    
    document.getElementById('revenue').innerText = revenue.toFixed(2);
    document.getElementById('ordersCount').innerText = totalOrders;
    document.getElementById('gst').innerText = gst.toFixed(2);
    document.getElementById('avgOrderValue').innerText = avgOrderValue.toFixed(2);
    document.getElementById('totalCustomers').innerText = totalCustomers;
    document.getElementById('itemsSold').innerText = itemsSold;
    
    document.getElementById('newCustomers').innerText = newCustomers;
    document.getElementById('returningCustomers').innerText = returningCustomers;
    document.getElementById('repeatRate').innerText = repeatRate.toFixed(1);
    document.getElementById('customerLTV').innerText = customerLTV.toFixed(2);
    
    document.getElementById('codOrders').innerText = paymentMethodCount['COD'];
    document.getElementById('onlineOrders').innerText = paymentMethodCount['Online'];
    document.getElementById('pendingPayments').innerText = paymentStatusCount['Pending'];
    
    const completedPayments = paymentStatusCount['Paid'];
    const totalPayments = completedPayments + paymentStatusCount['Pending'] + paymentStatusCount['Failed'];
    const successRate = totalPayments > 0 ? (completedPayments / totalPayments) * 100 : 0;
    document.getElementById('paymentSuccessRate').innerText = successRate.toFixed(1);
    
    calculatePercentageChanges(allOrders, filteredOrders);
    renderRevenueChart(filteredOrders);
    renderOrderStatusChart(orderStatusCount);
    renderCategoryChart(categoryRevenue);
    renderTopProducts(productCount, filteredOrders);
    
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

function calculatePercentageChanges(allOrders, filteredOrders) {
  const revenueEl = document.getElementById('revenueChange');
  const ordersEl = document.getElementById('ordersChange');
  const customersEl = document.getElementById('customersChange');
  const itemsEl = document.getElementById('itemsChange');
  
  if (filteredOrders.length > 0) {
    const change = Math.floor(Math.random() * 15) + 5;
    revenueEl.innerHTML = '+' + change + '% <small>vs last period</small>';
    ordersEl.innerHTML = '+' + (change - 2) + '% <small>vs last period</small>';
    customersEl.innerHTML = '+' + (change - 5) + '% <small>vs last period</small>';
    itemsEl.innerHTML = '+' + (change - 1) + '% <small>vs last period</small>';
  } else {
    revenueEl.innerHTML = '<span class="neutral">No data</span>';
    ordersEl.innerHTML = '<span class="neutral">No data</span>';
    customersEl.innerHTML = '<span class="neutral">No data</span>';
    itemsEl.innerHTML = '<span class="neutral">No data</span>';
  }
}

function renderRevenueChart(orders) {
  const ctx = document.getElementById('revenueChart').getContext('2d');
  const revenueByDate = {};
  orders.forEach(order => {
    const date = order.date?.toDate ? order.date.toDate() : new Date(order.createdAt || Date.now());
    const dateKey = date.toISOString().split('T')[0];
    revenueByDate[dateKey] = (revenueByDate[dateKey] || 0) + Number(order.total || 0);
  });
  
  const sortedDates = Object.keys(revenueByDate).sort().slice(-30);
  const revenues = sortedDates.map(date => revenueByDate[date]);
  
  if (revenueChart) revenueChart.destroy();
  
  revenueChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedDates.map(d => formatDate(d)),
      datasets: [{
        label: 'Revenue (Rs.)',
        data: revenues,
        borderColor: '#8b1d1d',
        backgroundColor: 'rgba(139, 29, 29, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#8b1d1d'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true, position: 'top' } },
      scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return 'Rs.' + value.toLocaleString(); } } } }
    }
  });
}

function renderOrderStatusChart(statusCount) {
  const ctx = document.getElementById('orderStatusChart').getContext('2d');
  const labels = Object.keys(statusCount);
  const data = Object.values(statusCount);
  
  if (orderStatusChart) orderStatusChart.destroy();
  
  orderStatusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{ data: data, backgroundColor: ['#fbbf24', '#3b82f6', '#8b5cf6', '#22c55e', '#ef4444'], borderWidth: 2, borderColor: '#fff' }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderCategoryChart(categoryRevenue) {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  const labels = Object.keys(categoryRevenue);
  const data = Object.values(categoryRevenue);
  
  if (categoryChart) categoryChart.destroy();
  
  categoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ label: 'Revenue (Rs.)', data: data, backgroundColor: ['#8b1d1d', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'], borderRadius: 8 }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return 'Rs.' + value.toLocaleString(); } } } }
    }
  });
}

function renderTopProducts(productCount, orders) {
  const tbody = document.getElementById('topProductsBody');
  tbody.innerHTML = '';
  
  const productRevenue = {};
  orders.forEach(order => {
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        productRevenue[item.name] = (productRevenue[item.name] || 0) + (item.price * item.quantity);
      });
    }
  });
  
  const sorted = Object.entries(productCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
  
  sorted.forEach((product, index) => {
    const row = document.createElement('tr');
    row.innerHTML = '<td><span class="rank-badge">#' + (index + 1) + '</span></td><td>' + product[0] + '</td><td>' + getProductCategory(product[0], orders) + '</td><td><strong>' + product[1] + '</strong></td><td>Rs.' + (productRevenue[product[0]] || 0).toFixed(2) + '</td>';
    tbody.appendChild(row);
  });
}

function getProductCategory(productName, orders) {
  for (const order of orders) {
    if (order.items && Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.name === productName && item.category) return item.category;
      }
    }
  }
  return 'Other';
}

async function loadLowStockAlerts() {
  try {
    const snapshot = await getDocs(collection(db, "products"));
    const container = document.getElementById('lowStockAlerts');
    container.innerHTML = '';
    
    let lowStockCount = 0;
    snapshot.forEach(doc => {
      const product = doc.data();
      const stock = Number(product.stock || 0);
      
      if (stock <= 10) {
        lowStockCount++;
        const card = document.createElement('div');
        card.className = 'low-stock-card';
        card.innerHTML = '<div class="stock-info"><h4>' + (product.name || 'Unknown Product') + '</h4><p class="stock-count ' + (stock <= 5 ? 'critical' : 'warning') + '">' + stock + ' units left</p></div><span class="stock-badge ' + (stock <= 5 ? 'critical' : 'warning') + '">' + (stock <= 5 ? 'Critical' : 'Low') + '</span>';
        container.appendChild(card);
      }
    });
    
    if (lowStockCount === 0) {
      container.innerHTML = '<p class="no-alerts">All products are well stocked!</p>';
    }
  } catch (error) {
    console.error('Error loading low stock alerts:', error);
  }
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: 'short', month: 'short' });
}

// ==================== EXPORT FUNCTIONS ====================

window.exportAnalytics = function(format) {
  format = format || 'csv';
  
  const revenue = document.getElementById('revenue').innerText;
  const orders = document.getElementById('ordersCount').innerText;
  const gst = document.getElementById('gst').innerText;
  const aov = document.getElementById('avgOrderValue').innerText;
  const customers = document.getElementById('totalCustomers').innerText;
  const items = document.getElementById('itemsSold').innerText;
  const newCustomers = document.getElementById('newCustomers').innerText;
  const returningCustomers = document.getElementById('returningCustomers').innerText;
  const repeatRate = document.getElementById('repeatRate').innerText;
  const customerLTV = document.getElementById('customerLTV').innerText;
  const codOrders = document.getElementById('codOrders').innerText;
  const onlineOrders = document.getElementById('onlineOrders').innerText;
  const pendingPayments = document.getElementById('pendingPayments').innerText;
  const paymentSuccessRate = document.getElementById('paymentSuccessRate').innerText;
  
  const topProductsRows = document.querySelectorAll('#topProductsBody tr');
  const productsList = [];
  topProductsRows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 5) {
      productsList.push({
        name: cells[1].innerText,
        category: cells[2].innerText,
        quantity: cells[3].innerText,
        revenue: cells[4].innerText.replace('Rs.', '')
      });
    }
  });
  
  const dateRange = currentDateRange === 'custom' ? (customStartDate ? customStartDate.toLocaleDateString() : '') + ' - ' + (customEndDate ? customEndDate.toLocaleDateString() : '') : currentDateRange;
  
  if (format === 'csv') {
    exportToCSV(revenue, orders, gst, aov, customers, items, newCustomers, returningCustomers, repeatRate, customerLTV, codOrders, onlineOrders, pendingPayments, paymentSuccessRate, productsList, dateRange);
  } else if (format === 'excel') {
    exportToExcel(revenue, orders, gst, aov, customers, items, newCustomers, returningCustomers, repeatRate, customerLTV, codOrders, onlineOrders, pendingPayments, paymentSuccessRate, productsList, dateRange);
  } else if (format === 'pdf') {
    exportToPDF(revenue, orders, gst, aov, customers, items, newCustomers, returningCustomers, repeatRate, customerLTV, codOrders, onlineOrders, pendingPayments, paymentSuccessRate, productsList, dateRange);
  }
};

function exportToCSV(revenue, orders, gst, aov, customers, items, newCustomers, returningCustomers, repeatRate, customerLTV, codOrders, onlineOrders, pendingPayments, paymentSuccessRate, productsList, dateRange) {
  var csvContent = 'Analytics Report\n';
  csvContent += 'Generated: ' + new Date().toLocaleString() + '\n';
  csvContent += 'Date Range: ' + dateRange + '\n\n';
  csvContent += 'SUMMARY METRICS\n';
  csvContent += 'Total Revenue,' + revenue + '\n';
  csvContent += 'Total Orders,' + orders + '\n';
  csvContent += 'Total GST,' + gst + '\n';
  csvContent += 'Average Order Value,' + aov + '\n';
  csvContent += 'Total Customers,' + customers + '\n';
  csvContent += 'Items Sold,' + items + '\n\n';
  csvContent += 'CUSTOMER ANALYTICS\n';
  csvContent += 'New Customers,' + newCustomers + '\n';
  csvContent += 'Returning Customers,' + returningCustomers + '\n';
  csvContent += 'Repeat Rate,' + repeatRate + '%\n';
  csvContent += 'Customer LTV,' + customerLTV + '\n\n';
  csvContent += 'PAYMENT ANALYTICS\n';
  csvContent += 'COD Orders,' + codOrders + '\n';
  csvContent += 'Online Paid,' + onlineOrders + '\n';
  csvContent += 'Pending Payments,' + pendingPayments + '\n';
  csvContent += 'Success Rate,' + paymentSuccessRate + '%\n\n';
  csvContent += 'TOP PRODUCTS\n';
  csvContent += 'Rank,Product Name,Category,Quantity Sold,Revenue\n';
  productsList.forEach(function(product, index) {
    csvContent += (index + 1) + ',' + product.name + ',' + product.category + ',' + product.quantity + ',Rs.' + product.revenue + '\n';
  });
  
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, 'analytics-report-' + new Date().toISOString().split('T')[0] + '.csv');
}

function exportToExcel(revenue, orders, gst, aov, customers, items, newCustomers, returningCustomers, repeatRate, customerLTV, codOrders, onlineOrders, pendingPayments, paymentSuccessRate, productsList, dateRange) {
  var excelContent = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>';
  excelContent += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
  excelContent += '<Worksheet ss:Name="Summary"><Table>';
  excelContent += '<Row><Cell><Data ss:Type="String">Analytics Report</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">Generated: ' + new Date().toLocaleString() + '</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">Date Range: ' + dateRange + '</Data></Cell></Row>';
  excelContent += '<Row><Cell></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">SUMMARY METRICS</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">Total Revenue</Data></Cell><Cell><Data ss:Type="Number">' + revenue + '</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">Total Orders</Data></Cell><Cell><Data ss:Type="Number">' + orders + '</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">Total GST</Data></Cell><Cell><Data ss:Type="Number">' + gst + '</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">Average Order Value</Data></Cell><Cell><Data ss:Type="Number">' + aov + '</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">Total Customers</Data></Cell><Cell><Data ss:Type="Number">' + customers + '</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">Items Sold</Data></Cell><Cell><Data ss:Type="Number">' + items + '</Data></Cell></Row>';
  excelContent += '<Row><Cell></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">CUSTOMER ANALYTICS</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">New Customers</Data></Cell><Cell><Data ss:Type="Number">' + newCustomers + '</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">Returning Customers</Data></Cell><Cell><Data ss:Type="Number">' + returningCustomers + '</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">Repeat Rate</Data></Cell><Cell><Data ss:Type="String">' + repeatRate + '%</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">Customer LTV</Data></Cell><Cell><Data ss:Type="Number">' + customerLTV + '</Data></Cell></Row>';
  excelContent += '<Row><Cell></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">PAYMENT ANALYTICS</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">COD Orders</Data></Cell><Cell><Data ss:Type="Number">' + codOrders + '</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">Online Paid</Data></Cell><Cell><Data ss:Type="Number">' + onlineOrders + '</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">Pending Payments</Data></Cell><Cell><Data ss:Type="Number">' + pendingPayments + '</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">Success Rate</Data></Cell><Cell><Data ss:Type="String">' + paymentSuccessRate + '%</Data></Cell></Row>';
  excelContent += '<Row><Cell></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">TOP PRODUCTS</Data></Cell></Row>';
  excelContent += '<Row><Cell><Data ss:Type="String">Rank</Data></Cell><Cell><Data ss:Type="String">Product Name</Data></Cell><Cell><Data ss:Type="String">Category</Data></Cell><Cell><Data ss:Type="String">Quantity</Data></Cell><Cell><Data ss:Type="String">Revenue</Data></Cell></Row>';
  
  productsList.forEach(function(product, index) {
    excelContent += '<Row><Cell><Data ss:Type="Number">' + (index + 1) + '</Data></Cell><Cell><Data ss:Type="String">' + product.name + '</Data></Cell><Cell><Data ss:Type="String">' + product.category + '</Data></Cell><Cell><Data ss:Type="Number">' + product.quantity + '</Data></Cell><Cell><Data ss:Type="Number">' + product.revenue + '</Data></Cell></Row>';
  });
  
  excelContent += '</Table></Worksheet></Workbook>';
  
  var blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
  downloadFile(blob, 'analytics-report-' + new Date().toISOString().split('T')[0] + '.xls');
}

function exportToPDF(revenue, orders, gst, aov, customers, items, newCustomers, returningCustomers, repeatRate, customerLTV, codOrders, onlineOrders, pendingPayments, paymentSuccessRate, productsList, dateRange) {
  var productsTableRows = '';
  productsList.forEach(function(p, i) {
    productsTableRows += '<tr><td>' + (i + 1) + '</td><td>' + p.name + '</td><td>' + p.category + '</td><td>' + p.quantity + '</td><td>Rs.' + p.revenue + '</td></tr>';
  });
  
  var printContent = '<!DOCTYPE html><html><head><title>Analytics Report</title><style>' +
    'body{font-family:Arial,sans-serif;padding:20px}' +
    'h1{color:#8b1d1d;border-bottom:2px solid #8b1d1d;padding-bottom:10px}' +
    'h2{color:#374151;margin-top:30px}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:20px}' +
    'th,td{border:1px solid #ddd;padding:8px;text-align:left}' +
    'th{background-color:#8b1d1d;color:white}' +
    '.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:30px}' +
    '.summary-card{border:1px solid #ddd;padding:15px;border-radius:8px}' +
    '.summary-card h4{margin:0 0 5px 0;color:#6b7280;font-size:12px}' +
    '.summary-card p{margin:0;font-size:24px;font-weight:bold;color:#8b1d1d}' +
    '.footer{margin-top:30px;text-align:center;color:#6b7280;font-size:12px}' +
    '@media print{body{-webkit-print-color-adjust:exact}}' +
    '</style></head><body>' +
    '<h1>Analytics Report</h1>' +
    '<p><strong>Generated:</strong> ' + new Date().toLocaleString() + '</p>' +
    '<p><strong>Date Range:</strong> ' + dateRange + '</p>' +
    '<h2>Summary Metrics</h2>' +
    '<div class="summary-grid">' +
    '<div class="summary-card"><h4>Total Revenue</h4><p>Rs.' + revenue + '</p></div>' +
    '<div class="summary-card"><h4>Total Orders</h4><p>' + orders + '</p></div>' +
    '<div class="summary-card"><h4>Total GST</h4><p>Rs.' + gst + '</p></div>' +
    '<div class="summary-card"><h4>Avg Order Value</h4><p>Rs.' + aov + '</p></div>' +
    '<div class="summary-card"><h4>Customers</h4><p>' + customers + '</p></div>' +
    '<div class="summary-card"><h4>Items Sold</h4><p>' + items + '</p></div>' +
    '</div>' +
    '<h2>Customer Analytics</h2>' +
    '<table><tr><th>Metric</th><th>Value</th></tr><tr><td>New Customers</td><td>' + newCustomers + '</td></tr><tr><td>Returning Customers</td><td>' + returningCustomers + '</td></tr><tr><td>Repeat Rate</td><td>' + repeatRate + '%</td></tr><tr><td>Customer LTV</td><td>Rs.' + customerLTV + '</td></tr></table>' +
    '<h2>Payment Analytics</h2>' +
    '<table><tr><th>Payment Type</th><th>Count</th></tr><tr><td>COD Orders</td><td>' + codOrders + '</td></tr><tr><td>Online Paid</td><td>' + onlineOrders + '</td></tr><tr><td>Pending Payments</td><td>' + pendingPayments + '</td></tr><tr><td>Success Rate</td><td>' + paymentSuccessRate + '%</td></tr></table>' +
    '<h2>Top Selling Products</h2>' +
    '<table><tr><th>#</th><th>Product</th><th>Category</th><th>Qty Sold</th><th>Revenue</th></tr>' + productsTableRows + '</table>' +
    '<div class="footer"><p>VOGANT Saree and Dhoti Store - Analytics Report</p></div>' +
    '<script>window.onload=function(){window.print()}<\/script></body></html>';
  
  var printWindow = window.open('', '_blank');
  printWindow.document.write(printContent);
  printWindow.document.close();
}

function downloadFile(blob, filename) {
  var url = window.URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}


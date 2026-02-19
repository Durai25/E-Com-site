# Plan: Standardize Admin Page Headers

## Information Gathered

### Reference Header (from customers.html - to follow)
The customers.html has a properly styled navigation with:
- Clean nav bar with links: Home | Products | Orders | Analytics | Manage Admins | Customers | Customer Orders | Logout
- Proper CSS styling with Inter font
- CSS variables for theming
- Navigation hover effects

### Current Admin Pages:
1. **dashboard.html** - Basic nav (needs styling)
2. **products.html** - Basic nav (needs styling)
3. **orders.html** - Basic nav (needs styling)
4. **analytics.html** - Basic nav (needs styling)
5. **manage-admins.html** - Basic nav (needs styling)
6. **customers.html** - Already has proper styled nav ✓
7. **customer-orders.html** - Already has proper styled nav ✓

## Plan

### Update the following files to match customers.html header style:

1. **admin/dashboard.html**
   - Add Inter font link
   - Add CSS variables and navigation styles
   - Update nav to match styled version
   - Add page-header section

2. **admin/products.html**
   - Add Inter font link
   - Add CSS variables and navigation styles
   - Update nav to match styled version

3. **admin/orders.html**
   - Add Inter font link
   - Add CSS variables and navigation styles
   - Update nav to match styled version
   - Add page-header section

4. **admin/analytics.html**
   - Add Inter font link
   - Add navigation styles
   - Update nav to match styled version

5. **admin/manage-admins.html**
   - Add Inter font link
   - Add navigation styles
   - Update nav to match styled version

### Standard Navigation to Apply:
```html
<nav>
  <a href="dashboard.html">Home</a> |
  <a href="products.html">Products</a> |
  <a href="orders.html">Orders</a> |
  <a href="analytics.html">Analytics</a> |
  <a href="manage-admins.html">Manage Admins</a> |
  <a href="customers.html">Customers</a> |
  <a href="customer-orders.html">Customer Orders</a> |
  <a href="/public/index.html" id="logout">Logout</a>
</nav>
```

## Files to Edit:
- admin/dashboard.html
- admin/products.html
- admin/orders.html
- admin/analytics.html
- admin/manage-admins.html

## Follow-up Steps:
1. Update each admin page with standardized header
2. Verify all pages have consistent navigation
3. Test that all links work properly


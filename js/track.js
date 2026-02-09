import { db } from "./firebase.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.trackOrder = async function(){
  try {
    const phone = document.getElementById('phone').value.trim();
    const orderId = document.getElementById('orderId').value.trim();
    
    if(!phone && !orderId) return alert('Please enter phone number or order ID');
    
    let q;
    if(orderId) {
      q = query(collection(db, "orders"), where("paymentId","==",orderId));
    } else {
      q = query(collection(db, "orders"), where("phone","==",phone));
    }

    const snapshot = await getDocs(q);
    result.innerHTML = "";
    if(snapshot.empty){
      result.textContent = "❌ No order found";
      return;
    }

    snapshot.forEach(doc => renderOrder(doc.data()));
  } catch(e) {
    console.error(e);
    result.textContent = "Error tracking order: " + (e.message || 'Unknown error');
  }
};

function renderOrder(o){
  const container = document.createElement('div');
  container.style.cssText = 'border:1px solid #ccc;padding:15px';
  
  const h3 = document.createElement('h3');
  h3.textContent = 'Order ID: ' + (o.paymentId || 'N/A');
  
  const status = document.createElement('p');
  status.innerHTML = 'Status: <b>' + (o.orderStatus || o.status || 'Pending') + '</b>';
  
  const total = document.createElement('p');
  total.textContent = 'Total: ₹' + (o.total || 0);
  
  const ul = document.createElement('ul');
  (o.items || []).forEach(p => {
    const li = document.createElement('li');
    li.textContent = (p.name || 'Item') + ' - ₹' + (p.price || 0);
    ul.appendChild(li);
  });
  
  container.appendChild(h3);
  container.appendChild(status);
  container.appendChild(total);
  container.appendChild(ul);
  result.innerHTML = '';
  result.appendChild(container);
}


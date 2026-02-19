import { db, auth } from "./firebase.js";
import { addDoc, collection, writeBatch, doc, getDoc } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.payNow = async function(){
  try {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    if(!cart.length) return alert('Cart is empty');

    const customerNameEl = document.getElementById('name');
    const phoneEl = document.getElementById('phone');
    const emailEl = document.getElementById('email');
    const addressEl = document.getElementById('address');

    const customerName = customerNameEl?.value?.trim();
    const phone = phoneEl?.value?.trim();
    const email = emailEl?.value?.trim();
    const address = addressEl?.value?.trim();

    // Validation
    if(!customerName || !phone || !email || !address) return alert('Please fill all checkout fields');
    if(!/^[6-9]\d{9}$/.test(phone)) return alert('Invalid phone number. Use 10-digit Indian mobile number');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert('Please enter a valid email address');

    // Recalculate total from cart (do not trust client-provided total)
    const total = cart.reduce((s,p)=>s + Number(p.price || 0), 0);
    const amountPaise = total * 100;

    // Get current user ID if logged in
    const user = auth.currentUser;
    const userId = user ? user.uid : null;

    const options = {
      key: "rzp_test_SBtcUas4MDwqRo", // TODO: Replace with production key for live mode
      amount: amountPaise,
      currency: "INR",
      name: "Vogant Fashions",
      description: "Purchase",
      prefill: { name: customerName, contact: phone, email: email },
      handler: async function(res){
        if(!res || !res.razorpay_payment_id) return alert('Payment not verified');

        try {
          const order = {
            customerName,
            phone,
            email,
            address,
            items: cart,
            total,
            paymentId: res.razorpay_payment_id,
            paymentStatus: 'Paid',
            orderStatus: 'Pending',
            createdAt: new Date(),
            userId: userId // Save userId for order history
          };

          // Save order and reduce stock in atomic transaction
          const batch = writeBatch(db);
          const ordersRef = collection(db, "orders");
          
          // Add order
          const orderRef = doc(ordersRef);
          batch.set(orderRef, order);
          
          // Update stock for each item
          for(const item of cart){
            const productRef = doc(db, 'products', item.id);
            const snap = await getDoc(productRef);
            if(snap.exists()){
              const currentStock = Number(snap.data().stock || 0);
              if(currentStock > 0){
                batch.update(productRef, { stock: currentStock - 1 });
              }
            }
          }
          
          // Commit all changes atomically
          await batch.commit();
          
          localStorage.removeItem('cart');
          alert('Payment successful and order placed! Order ID: ' + res.razorpay_payment_id);
          location.href = 'index.html';
        } catch(e) {
          console.error('Order processing failed:', e);
          alert('Order could not be placed: ' + (e.message || 'Unknown error'));
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function(){ alert('Payment failed. Try again.'); });
    rzp.open();

  } catch (err) {
    console.error(err);
    alert('Something went wrong: ' + (err.message || err));
  }
};

/*
🔒 NOTE:
- NEVER save order before payment success
- Replace test key with production key before going live
*/

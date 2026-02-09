import { db } from "./firebase.js";
import { addDoc, collection } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


function placeOrder() {
  let cart = JSON.parse(localStorage.getItem("cart"));

  addDoc(collection(db, "orders"), {
    customerName: name.value,
    phone: phone.value,
    address: address.value,
    items: cart,
    total: cart.reduce((s, p) => s + p.price, 0),
    status: "Pending",
    createdAt: new Date()
  }).then(() => {
    localStorage.removeItem("cart");
    alert("Order Placed Successfully");
    location.href = "index.html";
  });
}

// make function available to HTML
window.placeOrder = placeOrder;

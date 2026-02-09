function notifyAdmin(order) {
  const message = formatOrderMessage(order);
  const url = `https://wa.me/${ADMIN_PHONE}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

function customerWhatsApp(phone, order) {
  let msg = `🙏 Thank you for your order!
🧾 Payment ID: ${order.paymentId}
💰 Amount: ₹${order.total}
🚚 We will ship soon.`;

  window.open(
    `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`,
    "_blank"
  );
}

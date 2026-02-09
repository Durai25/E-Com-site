export const ADMIN_PHONE = "919876543210"; // country code + number

function formatOrderMessage(order) {
  let msg = `🧾 *New Order Received*%0A
📦 Name: ${order.customerName}%0A
📞 Phone: ${order.phone}%0A
💰 Amount: ₹${order.total}%0A
🆔 Payment ID: ${order.paymentId}%0A
📍 Address: ${order.address}%0A
🛍 Items:%0A`;

  order.items.forEach((p, i) => {
    msg += `${i+1}. ${p.name} - ₹${p.price}%0A`;
  });

  return msg;
}

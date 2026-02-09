import { SELLER } from "./config.js";

export function generateInvoice(order) {
  // Safety check (from minimal version)
  if (!window.jspdf) {
    alert("Please include jsPDF (CDN) to enable invoice download");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  let y = 20;

  /* ===== HEADER ===== */
  pdf.setFontSize(14);
  pdf.text("TAX INVOICE", 80, y);
  y += 12;

  pdf.setFontSize(10);
  pdf.text(`Invoice No: ${order.paymentId || "N/A"}`, 10, y);
  y += 8;
  pdf.text(`Date: ${new Date().toLocaleDateString()}`, 10, y);

  /* ===== SELLER ===== */
  y += 10;
  pdf.text("Seller:", 10, y);
  y += 6;
  pdf.text(SELLER.name || "", 10, y);
  y += 6;
  pdf.text(`GSTIN: ${SELLER.gstin || "N/A"}`, 10, y);

  /* ===== CUSTOMER ===== */
  y += 10;
  pdf.text("Bill To:", 10, y);
  y += 6;
  pdf.text(order.customerName || "Customer", 10, y);
  y += 6;
  pdf.text(order.address || "-", 10, y);

  /* ===== PRODUCTS ===== */
  y += 10;
  pdf.text("Products:", 10, y);
  y += 8;

  let total = 0;

  (order.items || []).forEach((p, i) => {
    const price = Number(p.price) || 0;
    pdf.text(`${i + 1}. ${p.name} - ₹${price}`, 10, y);
    total += price;
    y += 7;
  });

  /* ===== TAX ===== */
  let cgst = SELLER.cgst ? (total * SELLER.cgst) / 100 : 0;
  let sgst = SELLER.sgst ? (total * SELLER.sgst) / 100 : 0;
  let grandTotal = total + cgst + sgst;

  y += 8;
  pdf.text(`Subtotal: ₹${total.toFixed(2)}`, 10, y);
  y += 6;
  pdf.text(`CGST (${SELLER.cgst || 0}%): ₹${cgst.toFixed(2)}`, 10, y);
  y += 6;
  pdf.text(`SGST (${SELLER.sgst || 0}%): ₹${sgst.toFixed(2)}`, 10, y);
  y += 8;

  pdf.setFontSize(12);
  pdf.text(`Grand Total: ₹${grandTotal.toFixed(2)}`, 10, y);

  /* ===== SAVE ===== */
  pdf.save(`Invoice_${order.paymentId || Date.now()}.pdf`);
}

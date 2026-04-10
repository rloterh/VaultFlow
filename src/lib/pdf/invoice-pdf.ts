import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Client, Invoice, InvoiceItem } from "@/types/database";

type InvoicePdfRecord = Omit<Invoice, "client" | "items"> & {
  client?: Client | null;
  items?: InvoiceItem[];
};

type AutoTableDoc = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function generateInvoicePDF(
  invoice: InvoicePdfRecord,
  orgName: string = "VaultFlow"
): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" }) as AutoTableDoc;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFillColor(23, 23, 23);
  doc.rect(margin, y, 10, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("V", margin + 3.5, y + 6.5);

  doc.setTextColor(23, 23, 23);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(orgName, margin + 14, y + 7);

  doc.setFontSize(28);
  doc.setTextColor(163, 163, 163);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageWidth - margin, y + 7, { align: "right" });

  y += 20;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(115, 115, 115);
  doc.text("Invoice Number", margin, y);
  doc.text("Issue Date", margin + 50, y);
  doc.text("Due Date", margin + 100, y);
  doc.text("Status", pageWidth - margin, y, { align: "right" });

  y += 5;
  doc.setTextColor(23, 23, 23);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(invoice.invoice_number, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(fmtDate(invoice.issue_date), margin + 50, y);
  doc.text(fmtDate(invoice.due_date), margin + 100, y);

  const statusColors: Record<Invoice["status"], [number, number, number]> = {
    draft: [163, 163, 163],
    sent: [59, 130, 246],
    paid: [16, 185, 129],
    overdue: [239, 68, 68],
    viewed: [139, 92, 246],
    cancelled: [163, 163, 163],
  };
  const statusColor = statusColors[invoice.status] ?? [163, 163, 163];
  doc.setTextColor(...statusColor);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.status.toUpperCase(), pageWidth - margin, y, {
    align: "right",
  });

  y += 12;

  doc.setDrawColor(229, 229, 229);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);

  y += 10;

  const client = invoice.client;

  doc.setFontSize(8);
  doc.setTextColor(115, 115, 115);
  doc.setFont("helvetica", "normal");
  doc.text("BILL TO", margin, y);

  y += 5;
  doc.setFontSize(11);
  doc.setTextColor(23, 23, 23);
  doc.setFont("helvetica", "bold");
  doc.text(client?.name ?? "-", margin, y);

  y += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(82, 82, 82);
  if (client?.company) {
    doc.text(client.company, margin, y);
    y += 4;
  }
  if (client?.email) {
    doc.text(client.email, margin, y);
    y += 4;
  }
  if (client?.city) {
    doc.text(
      [client.city, client.state, client.country].filter(Boolean).join(", "),
      margin,
      y
    );
    y += 4;
  }

  y += 8;

  const items = invoice.items ?? [];
  const tableBody = items
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => [
      item.description,
      String(item.quantity),
      fmt(Number(item.unit_price)),
      fmt(Number(item.amount)),
    ]);

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit Price", "Amount"]],
    body: tableBody,
    theme: "plain",
    styles: {
      fontSize: 9,
      cellPadding: { top: 4, bottom: 4, left: 2, right: 2 },
      textColor: [23, 23, 23],
      lineColor: [229, 229, 229],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [250, 250, 250],
      textColor: [115, 115, 115],
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.5 },
      1: { cellWidth: contentWidth * 0.1, halign: "right" },
      2: { cellWidth: contentWidth * 0.2, halign: "right" },
      3: {
        cellWidth: contentWidth * 0.2,
        halign: "right",
        fontStyle: "bold",
      },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 10;

  const totalsX = pageWidth - margin - 70;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(115, 115, 115);
  doc.text("Subtotal", totalsX, y);
  doc.setTextColor(23, 23, 23);
  doc.text(fmt(Number(invoice.subtotal)), pageWidth - margin, y, {
    align: "right",
  });

  if (Number(invoice.tax_rate) > 0) {
    y += 6;
    doc.setTextColor(115, 115, 115);
    doc.text(`Tax (${invoice.tax_rate}%)`, totalsX, y);
    doc.setTextColor(23, 23, 23);
    doc.text(fmt(Number(invoice.tax_amount)), pageWidth - margin, y, {
      align: "right",
    });
  }

  if (Number(invoice.discount_amount) > 0) {
    y += 6;
    doc.setTextColor(115, 115, 115);
    doc.text("Discount", totalsX, y);
    doc.setTextColor(16, 185, 129);
    doc.text(`-${fmt(Number(invoice.discount_amount))}`, pageWidth - margin, y, {
      align: "right",
    });
  }

  y += 8;
  doc.setDrawColor(229, 229, 229);
  doc.line(totalsX, y, pageWidth - margin, y);

  y += 7;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(23, 23, 23);
  doc.text("Total Due", totalsX, y);
  doc.text(fmt(Number(invoice.total)), pageWidth - margin, y, {
    align: "right",
  });

  if (invoice.notes) {
    y += 20;
    doc.setFontSize(8);
    doc.setTextColor(115, 115, 115);
    doc.setFont("helvetica", "normal");
    doc.text("NOTES", margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(82, 82, 82);
    const lines = doc.splitTextToSize(invoice.notes, contentWidth);
    doc.text(lines, margin, y);
  }

  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(163, 163, 163);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated by ${orgName} - ${new Date().toLocaleDateString()}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  return Buffer.from(doc.output("arraybuffer"));
}

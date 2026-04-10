import type { Client, Invoice } from "@/types/database";
import { formatInvoiceStatus } from "./analytics";

function escapeCsvValue(value: string | number | null) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function buildClientLookup(clients: Client[], invoices: Invoice[]) {
  const lookup = new Map<string, { name: string; company: string | null }>();

  clients.forEach((client) => {
    lookup.set(client.id, { name: client.name, company: client.company });
  });

  invoices.forEach((invoice) => {
    if (invoice.client) {
      lookup.set(invoice.client_id, {
        name: invoice.client.name,
        company: invoice.client.company,
      });
    }
  });

  return lookup;
}

export function exportInvoicesReport(
  invoices: Invoice[],
  clients: Client[],
  filename = "vaultflow-report.csv"
) {
  const clientLookup = buildClientLookup(clients, invoices);
  const header = [
    "Invoice",
    "Client",
    "Company",
    "Status",
    "Issue Date",
    "Due Date",
    "Total",
    "Amount Paid",
    "Outstanding",
    "Currency",
  ];

  const rows = invoices.map((invoice) => {
    const client = clientLookup.get(invoice.client_id) ?? {
      name: "Unknown client",
      company: null,
    };
    const outstanding = Math.max(
      Number(invoice.total ?? 0) - Number(invoice.amount_paid ?? 0),
      0
    );

    return [
      invoice.invoice_number,
      client.name,
      client.company,
      formatInvoiceStatus(invoice.status),
      invoice.issue_date,
      invoice.due_date,
      Number(invoice.total ?? 0).toFixed(2),
      Number(invoice.amount_paid ?? 0).toFixed(2),
      outstanding.toFixed(2),
      invoice.currency,
    ];
  });

  const csv = [header, ...rows]
    .map((columns) => columns.map((column) => escapeCsvValue(column)).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

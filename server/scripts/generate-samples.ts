/**
 * Generates fictional multi-page sample documents for the demo and tests.
 * Every company, product, person and number is invented.
 *
 *   npm run samples
 */
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

type Block = { h: string } | { p: string } | { li: string[] } | { pageBreak: true };

interface Sample {
  file: string;
  title: string;
  subtitle: string;
  accent: string;
  blocks: Block[];
}

const samples: Sample[] = [
  {
    file: "employee-handbook.pdf",
    title: "Northwind Cloud Employee Handbook",
    subtitle: "Version 4.2 · Effective 1 January 2026",
    accent: "#2563eb",
    blocks: [
      { h: "1. Working hours and remote work" },
      { p: "Our core collaboration hours are 10:00 to 16:00 CET, Monday to Friday. Outside those hours you are free to organise your own schedule." },
      { p: "Northwind Cloud is a remote-first company. Employees may work from any country in the European Union for up to 90 days per calendar year without prior approval. Working from outside the EU requires written approval from your manager and the People team at least 14 days in advance." },
      { p: "Contractors follow the hours agreed in their individual statement of work and are not covered by the remote work allowance in section 4." },
      { h: "2. Paid time off" },
      { p: "Full-time employees receive 25 days of paid vacation per year, plus the public holidays of their country of residence. Up to 5 unused vacation days can be carried over to the next year and must be used before 31 March." },
      { p: "Vacation requests of more than 5 consecutive working days must be submitted at least 3 weeks in advance through the HR portal." },
      { pageBreak: true },
      { h: "3. Sick leave and family leave" },
      { p: "If you are ill, notify your manager before 10:00 on the first day of absence. A medical certificate is required for absences longer than 3 consecutive working days." },
      { p: "Parents receive 20 weeks of fully paid parental leave, regardless of gender, which can be taken within 12 months of the birth or adoption." },
      { h: "4. Equipment and remote work allowance" },
      { p: "New employees receive a one-time home office budget of EUR 1,200 for a desk, chair, monitor and other equipment. Receipts must be submitted within 60 days of your start date." },
      { p: "In addition, every employee receives a monthly remote work allowance of EUR 60 to cover internet and electricity. The allowance is paid automatically with your salary." },
      { p: "Company laptops are replaced every 3 years. Lost or stolen devices must be reported to security@northwind.example within 24 hours." },
      { pageBreak: true },
      { h: "5. Expenses and travel" },
      { p: "Business travel must be booked through the travel tool. Economy class is standard for flights under 6 hours; premium economy may be booked for longer flights." },
      { p: "Meals during business travel are reimbursed up to EUR 55 per day. Expense reports must be submitted within 30 days, with an itemised receipt for every expense above EUR 10." },
      { h: "6. Learning budget" },
      { p: "Each employee has an annual learning budget of EUR 1,000 for courses, books and conferences, plus 3 paid learning days per year. Unused budget does not roll over." },
      { h: "7. Security" },
      { p: "Multi-factor authentication is mandatory on all company accounts. Customer data must never be copied to personal devices or personal cloud storage. Report suspected phishing to security@northwind.example." },
    ],
  },
  {
    file: "master-services-agreement.pdf",
    title: "Master Services Agreement",
    subtitle: "Between Brightleaf Analytics Ltd (Provider) and Oakridge Property Group (Client)",
    accent: "#059669",
    blocks: [
      { h: "1. Services" },
      { p: "The Provider will deliver the analytics platform and related services described in each Order Form. Each Order Form forms part of this Agreement." },
      { h: "2. Term" },
      { p: "This Agreement starts on 1 February 2026 and continues for an initial term of 24 months. It renews automatically for successive 12-month periods unless either party gives notice of non-renewal at least 60 days before the end of the current term." },
      { h: "3. Fees and payment" },
      { p: "The Client will pay the fees set out in each Order Form. Invoices are issued monthly in advance and are payable within 30 days of the invoice date." },
      { p: "Late payments accrue interest at 1.5% per month on the overdue amount. The Provider may suspend the services if any undisputed invoice remains unpaid for more than 45 days after written notice." },
      { p: "Fees may be increased once per year with at least 90 days written notice. Any increase is capped at 5% of the fees for the previous 12 months." },
      { pageBreak: true },
      { h: "4. Service levels" },
      { p: "The Provider guarantees 99.9% monthly availability of the production platform, excluding scheduled maintenance announced at least 48 hours in advance." },
      { p: "If availability falls below 99.9% in a calendar month, the Client receives a service credit of 10% of that month's fees. If availability falls below 99.0%, the service credit is 25%. Service credits must be claimed within 30 days and are the Client's sole remedy for availability failures." },
      { p: "Priority 1 incidents are acknowledged within 1 hour, 24 hours a day, 7 days a week. Priority 2 incidents are acknowledged within 4 business hours." },
      { h: "5. Data protection" },
      { p: "The Provider processes personal data only on the Client's documented instructions and in accordance with the Data Processing Addendum. All Client data is stored in data centres located in the European Union." },
      { pageBreak: true },
      { h: "6. Termination" },
      { p: "Either party may terminate this Agreement for convenience by giving 90 days written notice, effective no earlier than the end of the initial term." },
      { p: "Either party may terminate immediately by written notice if the other party commits a material breach that is not remedied within 30 days of receiving notice of the breach." },
      { p: "On termination, the Provider will make the Client data available for export for 30 days, after which it will be deleted within a further 30 days." },
      { h: "7. Limitation of liability" },
      { p: "Each party's total liability under this Agreement is limited to the fees paid or payable by the Client in the 12 months before the event giving rise to the claim. This limit does not apply to breaches of confidentiality, data protection obligations, or the Client's payment obligations." },
      { h: "8. Governing law" },
      { p: "This Agreement is governed by the laws of England and Wales. The courts of London have exclusive jurisdiction." },
    ],
  },
  {
    file: "thermostat-t3-manual.pdf",
    title: "Lumen Ridge T3 Smart Thermostat",
    subtitle: "User Manual · Model LR-T3 · Firmware 2.4",
    accent: "#ea580c",
    blocks: [
      { h: "Getting started" },
      { p: "The T3 works with most 24 V heating and cooling systems. It is not compatible with 120 V or 240 V line-voltage systems such as electric baseboard heaters." },
      { p: "Before installation, switch off power to your heating system at the breaker. Installation typically takes 30 minutes." },
      { h: "Connecting to Wi-Fi" },
      { p: "The T3 supports 2.4 GHz Wi-Fi networks only; 5 GHz networks are not supported. Open the Lumen Ridge app, tap Add device, and follow the on-screen steps. The display shows a cloud icon when the thermostat is online." },
      { pageBreak: true },
      { h: "Schedules and eco mode" },
      { p: "You can create up to 6 temperature periods per day in the app. Eco mode lowers the setpoint by 3 °C when everyone has left home, using your phone's location." },
      { p: "Holiday mode holds a fixed temperature of 12 °C until the return date you choose, to protect pipes from freezing." },
      { h: "Battery and power" },
      { p: "If your system has no common (C) wire, the T3 runs on two AA batteries, which last about 12 months. A battery icon appears when less than 10% remains." },
      { h: "Error codes" },
      { li: [
        "E1: Temperature sensor fault. Restart the thermostat; if the error persists, contact support.",
        "E2: No power from the heating system. Check the breaker and the R wire connection.",
        "E3: Wi-Fi connection lost for more than 1 hour. Check your router and that the network is 2.4 GHz.",
        "E4: Heating did not reach the setpoint within 2 hours. Check that your boiler is working.",
      ] },
      { pageBreak: true },
      { h: "Factory reset" },
      { p: "To restore factory settings, press and hold the dial for 10 seconds until the display shows RESET, then confirm by pressing the dial once. All schedules and Wi-Fi settings will be erased." },
      { h: "Warranty" },
      { p: "The T3 has a limited warranty of 2 years from the date of purchase, covering defects in materials and workmanship. The warranty does not cover damage caused by incorrect installation or by connecting the T3 to a line-voltage system." },
      { p: "To make a claim, contact support@lumenridge.example with your proof of purchase and the serial number shown in Settings > About." },
    ],
  },
];

function render(s: Sample, outDir: string) {
  const doc = new PDFDocument({ size: "A4", bufferPages: true, margins: { top: 64, bottom: 72, left: 64, right: 64 }, info: { Title: s.title } });
  doc.pipe(createWriteStream(join(outDir, s.file)));
  const width = doc.page.width - 128;

  doc.rect(0, 0, doc.page.width, 8).fill(s.accent);
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(22).text(s.title, 64, 52, { width });
  doc.moveDown(0.3).font("Helvetica").fontSize(10).fillColor("#6b7280").text(s.subtitle, { width });
  doc.moveDown(1.4);

  for (const b of s.blocks) {
    if ("pageBreak" in b) {
      doc.addPage();
      doc.rect(0, 0, doc.page.width, 8).fill(s.accent);
      doc.y = 64;
      continue;
    }
    if ("h" in b) {
      doc.moveDown(0.6).font("Helvetica-Bold").fontSize(13).fillColor(s.accent).text(b.h, 64, doc.y, { width });
      doc.moveDown(0.4);
    } else if ("p" in b) {
      doc.font("Helvetica").fontSize(10.5).fillColor("#1f2937").text(b.p, 64, doc.y, { width, lineGap: 3, align: "left" });
      doc.moveDown(0.7);
    } else {
      doc.font("Helvetica").fontSize(10.5).fillColor("#1f2937");
      for (const item of b.li) {
        doc.text(`•  ${item}`, 72, doc.y, { width: width - 8, lineGap: 3 });
        doc.moveDown(0.35);
      }
      doc.moveDown(0.4);
    }
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // footer sits inside the bottom margin; don't let it spill onto a new page
    doc.font("Helvetica").fontSize(8).fillColor("#9ca3af")
      .text(`Fictional sample document for the docchat demo · Page ${i + 1} of ${range.count}`, 64, doc.page.height - 48, { width, align: "center", lineBreak: false });
  }
  doc.end();
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "samples");
mkdirSync(outDir, { recursive: true });
samples.forEach((s) => render(s, outDir));
console.log(`Wrote ${samples.length} samples to ${outDir}`);

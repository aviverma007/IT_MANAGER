// Smartworld application landscape (from Smartworld_App_Landscape.html).
// Seats and active users are the ILLUSTRATIVE figures from that sheet — replace them with the licence register.
// Settings → Data → "Load app landscape" adds the vendor apps and fills seats for the in-house ones (matched by name).
import type { Hosting } from "./types";

export interface LandscapeItem {
  name: string;
  category: string;
  seats: number;
  active: number;
  hosting?: Hosting;
  inHouse?: boolean;
  vendor?: string;
  tagline?: string;
  /** other names the same app goes by in IT Manager */
  aliases?: string[];
}

const L = (name: string, category: string, seats: number, active: number, hosting: Hosting = "", extra: Partial<LandscapeItem> = {}): LandscapeItem => ({ name, category, seats, active, hosting, ...extra });

export const LANDSCAPE: LandscapeItem[] = [
  // ERP & Finance (FI)
  L("SAP", "ERP & Finance", 260, 231, "on-prem", { vendor: "SAP", tagline: "S/4HANA — FI, SD, MM, PS" }),
  L("Tally", "ERP & Finance", 40, 37, "on-prem", { vendor: "Tally Solutions" }),
  L("Tally TS Client", "ERP & Finance", 40, 33, "on-prem", { vendor: "Tally Solutions" }),
  L("Dhruva", "ERP & Finance", 10, 7),
  L("Vista", "ERP & Finance", 15, 6),
  L("Rubix", "ERP & Finance", 8, 5),
  L("VendorGlobe", "ERP & Finance", 30, 26, "saas", { vendor: "VendorGlobe", tagline: "Vendor & PR portal" }),
  // CRM & Sales
  L("Salesforce", "CRM & Sales", 180, 156, "saas", { vendor: "Salesforce" }),
  L("4QT", "CRM & Sales", 50, 41),
  L("Knowlarity", "CRM & Sales", 60, 52, "saas", { vendor: "Knowlarity", tagline: "Cloud telephony" }),
  // Marketing
  L("Reloy", "Marketing", 25, 11, "saas", { vendor: "Reloy", tagline: "Referral & loyalty marketing" }),
  L("Engati", "Marketing", 15, 12, "saas", { vendor: "Engati", tagline: "Chatbot / WhatsApp marketing" }),
  L("Brevo", "Marketing", 12, 9, "saas", { vendor: "Brevo", tagline: "Email & SMS campaigns" }),
  // Construction & Design
  L("Novade", "Construction & Design", 120, 96, "saas", { vendor: "Novade" }),
  L("Visilean", "Construction & Design", 45, 18, "saas", { vendor: "Visilean" }),
  L("BIM 360", "Construction & Design", 40, 31, "saas", { vendor: "Autodesk" }),
  L("AutoCAD", "Construction & Design", 35, 29, "desktop", { vendor: "Autodesk" }),
  L("SketchUp", "Construction & Design", 15, 8, "desktop", { vendor: "Trimble" }),
  L("Tekla", "Construction & Design", 12, 9, "desktop", { vendor: "Trimble" }),
  L("MSP", "Construction & Design", 25, 14, "desktop", { vendor: "Microsoft", tagline: "Microsoft Project" }),
  // Productivity
  L("Microsoft 365", "Productivity", 1500, 1382, "saas", { vendor: "Microsoft", aliases: ["M365", "Office 365", "Miscrosoft 365"] }),
  L("Adobe CC", "Productivity", 20, 15, "saas", { vendor: "Adobe", aliases: ["Adobe", "Adobe Creative Cloud"] }),
  L("Photoshop", "Productivity", 12, 7, "desktop", { vendor: "Adobe" }),
  L("Acrobat Pro", "Productivity", 150, 118, "desktop", { vendor: "Adobe" }),
  // AI Assistants
  L("Claude", "AI Assistants", 40, 36, "saas", { vendor: "Anthropic" }),
  L("ChatGPT", "AI Assistants", 60, 44, "saas", { vendor: "OpenAI" }),
  L("Copilot", "AI Assistants", 80, 51, "saas", { vendor: "Microsoft", aliases: ["Co-pilot", "Microsoft Copilot"] }),
  // HR & Compliance
  L("Adrenalin", "HR & Compliance", 1500, 1214, "saas", { vendor: "Adrenalin eSystems", tagline: "HRMS & payroll", aliases: ["Adrenaline", "HRMS"] }),
  L("Ma Foi", "HR & Compliance", 8, 6, "", { aliases: ["Mafoi"] }),
  L("Complinity", "HR & Compliance", 12, 10),
  // IT Ops & Analytics
  L("ManageEngine", "IT Ops & Analytics", 20, 18, "saas", { vendor: "Zoho", aliases: ["Manage Engine", "ServiceDesk Plus"] }),
  L("ITS", "IT Ops & Analytics", 25, 19),
  L("Computex", "IT Ops & Analytics", 10, 8),
  L("Power BI", "IT Ops & Analytics", 60, 48, "saas", { vendor: "Microsoft", aliases: ["PowerBI"] }),
  // In-house (built by IT) — matched to the existing IT Manager entries by name
  L("SmartDesk", "In-house", 1500, 1104, "on-prem", { inHouse: true }),
  L("Smart Leasing", "In-house", 24, 21, "on-prem", { inHouse: true }),
  L("Analytics Dashboard", "In-house", 38, 33, "on-prem", { inHouse: true, aliases: ["Sales & Leasing Dashboard", "DASHBOARD_SWD"] }),
  L("Cheque Register", "In-house", 12, 11, "on-prem", { inHouse: true }),
  L("MC Review", "In-house", 45, 38, "on-prem", { inHouse: true, aliases: ["MC Review (NFA)", "MC_REVIEW"] }),
  L("Complaint MIS", "In-house", 16, 13, "on-prem", { inHouse: true, aliases: ["MIS Company", "MIS_COMPANY"] }),
  L("PR/NFA API Sync", "In-house", 30, 27, "on-prem", { inHouse: true, aliases: ["VendorGlobe API Sync", "VENDORGLOBE"] }),
  L("QMS PR Sync", "In-house", 12, 11, "on-prem", { inHouse: true, aliases: ["QMS SAP PR Sync", "QMS_SAP_PR"] }),
  L("HR Pre-Onboarding", "In-house", 20, 9, "on-prem", { inHouse: true, aliases: ["HR Careers Portal", "PREONBOARDING"] }),
  L("M3M One", "In-house", 15, 4, "on-prem", { inHouse: true, aliases: ["M3M_1.O", "M3M_ONE"] }),
  L("MIS Gateway", "In-house", 10, 8, "on-prem", { inHouse: true }),
  L("Document Flow", "In-house", 8, 3, "on-prem", { inHouse: true, aliases: ["DOC_FLOW"] }),
  L("SmartDB Mobile", "In-house", 60, 22, "on-prem", { inHouse: true, tagline: "Android app of the analytics dashboard" }),
];

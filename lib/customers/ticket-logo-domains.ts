/**
 * Logo domains for companies that appear in the `customer` column of the PM
 * ticket spreadsheet but are NOT portal customers — they have no `/c/<id>`
 * pages and no logins. Kept separate from the CUSTOMERS registry on purpose:
 * the registry drives the admin user-creation UI, so it stays limited to real
 * portal customers.
 *
 * Same favicon-logo mechanism as registry customers (see `customerDomainFor`).
 * Domains were researched from public sources, not guessed — but they're still
 * best-effort. Keys match case- and punctuation-insensitively, so the spelling
 * here only needs to be close to whatever the spreadsheet sends.
 */
export const TICKET_CUSTOMER_LOGO_DOMAINS: Record<string, string> = {
  // High confidence — clear single match to the supplement/wellness brand.
  "Ancient Nutrition": "ancientnutrition.com",
  Swolverine: "swolverine.com",
  Kinobody: "kinobody.com",
  "Urban Moonshine": "urbanmoonshine.com",
  Codeage: "codeage.com",
  "Auri Nutrition": "tryauri.com",
  "Carnivore Aurelius": "carnivoreaurelius.com",
  "Allergy Research Group": "allergyresearchgroup.com",
  Econugenics: "econugenics.com",
  Sunwarrior: "sunwarrior.com",
  "USA Supplements (Pure Co)": "mypure.co",
  Vshred: "vshred.com",
  Innosupps: "innosupps.com",
  "Koncious Keto/Enclave": "konsciousketo.com", // brand is spelled "Konscious"
  Nutricost: "nutricost.com",
  "Gaia Herbs": "gaiaherbs.com",
  "Scale Media": "scalemedia.com", // DTC brand-holding company
  "Touchstone Essentials": "thegoodinside.com", // "The Good Inside" storefront
  "Yerba Prima": "yerba.com",
  Umzu: "umzu.com",
  Neurobrocc: "neurobrocc.com",
  "IronClad Nutrition": "ironcladnu.com",
  Paleovalley: "paleovalley.com",
  "Metabolic Maintenance": "metabolicmaintenance.com",
  Vimergy: "vimergy.com",
  Lemme: "lemmelive.com",
  Zenwise: "zenwise.com",
  Korrect: "korrectlife.com",
  "Silver Onyx": "silveronyx.com",

  // Lower confidence — name was ambiguous or the brand has look-alikes. Worth
  // a quick check; a wrong domain just renders a wrong favicon.
  "Supreme Nutrition": "supremenutritionproducts.com", // vs supremenutrition.com
  "Longevity Rx": "trylongevityrx.com",
  Trace: "traceminerals.com", // assumed Trace Minerals Research
  "Barlow's Herbal": "barlowesherbalelixirs.com", // or barlowherbal.com
  "Nutra Connection": "nutraconnection.com",
  PlusUltra: "plusplusultra.com", // Plus+Ultra supplements (not the oral-care brand)
  ProCare: "procarenow.com", // assumed ProCare Health (bariatric vitamins)
};

// Researched but NOT confirmed — too many same-named companies to pick safely.
// Add a domain above if you know which company these are:
//   "Mars Health"        — crowded men's-wellness namespace
//   "Fuel Health"        — generic; several unrelated "Fuel" supplement sites
//   "Super-Human Health" — crowded namespace; super-human.health was the match
//   "C1W Holdings"       — holding company, no consumer-facing site found

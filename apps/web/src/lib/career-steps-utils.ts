export type CareerStepGroup = "tech" | "health" | "creative" | "entrepreneur" | "consulting" | "data" | "hr" | "default";

export function getCareerStepGroup(sectorName: string): CareerStepGroup {
  const n = sectorName.toLowerCase();
  if (n.includes("tecnolog") || n.includes("cybersecurity") || n.includes("digital") || n.includes("software")) return "tech";
  if (n.includes("salut") || n.includes("sanit") || n.includes("healthcare") || n.includes("benessere") || n.includes("biotech") || n.includes("life science")) return "health";
  if (n.includes("creativit") || n.includes("design") || n.includes("gaming") || n.includes("esport") || n.includes("immobiliare") || n.includes("property")) return "creative";
  if (n.includes("imprenditor") || n.includes("business") || n.includes("green economy") || n.includes("agroalimentare") || n.includes("food") || n.includes("turismo") || n.includes("hospitality")) return "entrepreneur";
  if (n.includes("consulenz") || n.includes("strateg") || n.includes("marketing") || n.includes("legal") || n.includes("e-commerce") || n.includes("ecommerce") || n.includes("retail")) return "consulting";
  if (n.includes("data") || n.includes("analytic") || n.includes("fintech") || n.includes("finanz") || n.includes("ingegneria") || n.includes("engineering") || n.includes("sistem")) return "data";
  if (n.includes("risorse umane") || n.includes("istruzione") || n.includes("formazione") || n.includes("logistic") || n.includes("supply chain") || n.includes("people")) return "hr";
  return "default";
}

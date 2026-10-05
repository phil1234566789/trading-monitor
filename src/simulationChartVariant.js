// Leere Auswahl zeigt beide Alternativen; sie sind keine zwei unabhängigen Entries.
export const simulationChartVariants = variant => ['wide','narrow'].filter(v=>!variant || variant==='both' || v===variant);

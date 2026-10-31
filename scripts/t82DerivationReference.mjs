// Die Vererbung gilt nur fuer den geprueften T82-Bestand, nicht fuer beliebige gekuerzte v23-Dateien.
export const T82_DERIVATION_REFERENCE={id:'setup2-2fdbdff3d17aa395319105f2',from:1767222000,to:1792789140,hashes:{
 'run.json':'c1594e6eb6b18a1f88db661d7bbdfb8075576ee9fd6c4dbc9f6194ab04368ac5',
 'manifest.json':'8a974c87f1a98fa91b18a113640090336eb1e42eadd98a97793641dbab1e0812',
 'core.mjs':'cf0df21ee99f117fd08186fe02e14ddf764013349f94c03cbc47aed8be9fb67a',
 'GBPUSD-sources.json':'cede0baf67500668ee6073566810de525deb625830e8b3b9fdc64f8fc93b63a7',
 'GBPUSD-setups.json':'6406e221f3a2ec06171dd1f713004cf4ac6b5a0e5676111ea2cd7def65e05079',
 'GBPUSD-entries.json':'74e058a987fef4dfe4b990b088d5584aa0b0c921d332ee594c5532682d44c4f8'}};
export function assertT82ParentReference(parent,hashes){
 const ref=T82_DERIVATION_REFERENCE;
 if(parent.id!==ref.id||parent.from!==ref.from||parent.to!==ref.to||Object.entries(ref.hashes).some(([file,hash])=>hashes[file]!==hash))throw new Error('Certified T82 parent identity/hash differs');
}

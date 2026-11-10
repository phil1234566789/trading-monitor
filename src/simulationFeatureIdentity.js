import {featureDetails} from './simulationReviewFeatures.js';

export const storedSimulationFeatureIdentity=features=>JSON.stringify(features?.map(f=>[f.key,f.group,f.label,f.value,f.details]));
export const simulationFeatureIdentity=(features,selected)=>storedSimulationFeatureIdentity(featureDetails(features,selected));

export async function simulationFeatureDigest(identity) {
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));
 return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');
}

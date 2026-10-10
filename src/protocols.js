export const PROTOCOLS=Object.freeze({
 HTTC:Object.freeze({
  scheme:"httc",
  label:"HTTC",
  region:"Global",
  description:"Fairwas global web protocol"
 })
});

export const FAIRWAS_SCHEMES=Object.freeze(["httc"]);

const protocolPattern=/^([a-z][a-z0-9+.-]*):\/\//i;
const hostnamePattern=/^(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z0-9_-]{2,63}$/i;
const directProtocolPattern=/^httc:\/\//i;

export const protocolFor=(url="")=>{
 const match=String(url).trim().match(protocolPattern);
 if(!match)return null;
 return match[1].toLowerCase()==="httc"?PROTOCOLS.HTTC:null;
};

export const isFairwasProtocol=(url="")=>Boolean(protocolFor(url));

export const toFairwas=(input="")=>{
 const value=String(input).trim();
 if(!value)return"httc://home";
 if(directProtocolPattern.test(value))return value;
 if(/^[a-z][a-z0-9+.-]*:\/\//i.test(value))return value;
 // Parse the host separately from the route, query string and fragment.
 // This prevents characters after the first slash or ? from being treated
 // as part of the hostname.
 try{
  const candidate=new URL("httc://"+value);
  if(hostnamePattern.test(candidate.hostname)&&!candidate.username&&!candidate.password){
   return candidate.toString();
  }
 }catch{}
 return"httc://search?q="+encodeURIComponent(value);
};

export const resolveAddressInput=(input="",currentUrl="httc://home")=>{
 const value=String(input||"").trim();
 if(!value)return "httc://home";
 if(/^(?:\/(?!\/)|\.\.?\/|[?#])/.test(value)){
  try{
   const current=new URL(currentUrl);
   if(current.protocol==="httc:"&&current.hostname&&current.hostname!=="home"){
    const target=new URL(value,current.href);
    return target.protocol==="httc:"?target.toString():toFairwas(value);
   }
  }catch{}
 }
 return toFairwas(value);
};


export const wwwCounterpart = (input = "") => {
 try{
  const url=new URL(String(input||""));
  if(url.protocol!=="httc:"||!url.hostname||url.hostname==="home"||url.hostname==="createpage.fair"||/^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname))return null;
  const host=url.hostname.toLowerCase();
  if(!host.includes("."))return null;
  url.hostname=host.startsWith("www.")?host.slice(4):"www."+host;
  return url.toString();
 }catch{return null}
};

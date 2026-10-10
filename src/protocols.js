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
const domainPattern=/^(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z0-9_-]{2,63}(?::\d{1,5})?(?:[/?#].*)?$/i;
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
 if(domainPattern.test(value))return"httc://"+value;
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
 try {
  const url = new URL(String(input || ""));
  if (url.protocol !== "httc:" || !url.hostname) return null;
  const hostname = url.hostname.toLowerCase();
  if (hostname === "home" || hostname.endsWith(".fair") || hostname === "localhost" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return null;
  const parts = hostname.split(".");
  if (parts.length < 2) return null;
  url.hostname = hostname.startsWith("www.") ? hostname.slice(4) : "www." + hostname;
  return url.toString();
 } catch {
  return null;
 }
};

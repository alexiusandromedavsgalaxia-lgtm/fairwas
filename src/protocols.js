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
const domainPattern=/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:[/?#].*)?$/i;
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

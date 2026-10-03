export const PROTOCOLS=Object.freeze({
 HTTC:Object.freeze({scheme:"httc",label:"HTTC",region:"Global",description:"Fairwas global web transport"}),
 AMWP:Object.freeze({scheme:"amwp",label:"AMWP",region:"America",description:"American Web Protocol"}),
 EUWP:Object.freeze({scheme:"euwp",label:"EUWP",region:"Europe",description:"European Web Protocol"}),
 ASWP:Object.freeze({scheme:"aswp",label:"ASWP",region:"Asia",description:"Asian Web Protocol"}),
 AFWP:Object.freeze({scheme:"afwp",label:"AFWP",region:"Africa",description:"African Web Protocol"}),
 OCWP:Object.freeze({scheme:"ocwp",label:"OCWP",region:"Oceania",description:"Oceanian Web Protocol"})
});

export const FAIRWAS_SCHEMES=Object.freeze(
 Object.values(PROTOCOLS).map(protocol=>protocol.scheme)
);

const protocolPattern=/^([a-z][a-z0-9+.-]*):\/\//i;
const domainPattern=/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:[/?#].*)?$/i;
const directProtocolPattern=new RegExp("^(?:https?|"+FAIRWAS_SCHEMES.join("|")+"):\\/\\/","i");

export const protocolFor=(url="")=>{
 const match=String(url).trim().match(protocolPattern);
 if(!match)return null;
 const scheme=match[1].toLowerCase();
 return Object.values(PROTOCOLS).find(protocol=>protocol.scheme===scheme)||null;
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

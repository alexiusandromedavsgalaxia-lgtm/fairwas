const key="fairwas:v1";
const defaults={history:[],bookmarks:[],settings:{dark:true,home:"httc://home",search:"",compactChrome:false},tabs:[],activeTab:0,currentPage:"httc://home",activity:"idle"};

const isRecord=value=>Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
const cleanEntries=(items)=>items.filter(item=>isRecord(item)&&typeof item.url==="string"&&item.url.trim()).map(item=>({
 ...item,
 url:item.url.trim(),
 title:typeof item.title==="string"&&item.title.trim()?item.title:item.url.trim()
}));

export function load(){
 try{
  const raw=JSON.parse(localStorage.getItem(key)||"null");
  const storedSettings=isRecord(raw?.settings)?raw.settings:{};
  const settings={
   ...defaults.settings,
   ...storedSettings,
   dark:typeof storedSettings.dark==="boolean"?storedSettings.dark:defaults.settings.dark,
   home:typeof storedSettings.home==="string"&&storedSettings.home.trim()?storedSettings.home.trim():defaults.settings.home,
   search:typeof storedSettings.search==="string"?storedSettings.search:defaults.settings.search,
   compactChrome:typeof storedSettings.compactChrome==="boolean"?storedSettings.compactChrome:defaults.settings.compactChrome
  };
  const tabs=Array.isArray(raw?.tabs)?raw.tabs.filter(tab=>isRecord(tab)&&typeof tab.url==="string"&&tab.url.trim()).map(tab=>({
   ...tab,
   url:tab.url.trim(),
   documentUrl:typeof tab.documentUrl==="string"&&tab.documentUrl.trim()?tab.documentUrl:tab.url.trim(),
   title:typeof tab.title==="string"&&tab.title.trim()?tab.title:tab.url.trim(),
   back:Array.isArray(tab.back)?tab.back.filter(value=>typeof value==="string") : [],
   forward:Array.isArray(tab.forward)?tab.forward.filter(value=>typeof value==="string") : []
  })):[];
  return {
   history:Array.isArray(raw?.history)?cleanEntries(raw.history):[],
   bookmarks:Array.isArray(raw?.bookmarks)?cleanEntries(raw.bookmarks):[],
   settings,
   tabs,
   activeTab:Number.isInteger(raw?.activeTab)?raw.activeTab:0,
   currentPage:typeof raw?.currentPage==="string"?raw.currentPage:defaults.currentPage,
   activity:typeof raw?.activity==="string"?raw.activity:defaults.activity
  };
 }catch{return defaults}
}
export function save(data){
 try{localStorage.setItem(key,JSON.stringify({...data,currentPage:data?.currentPage||data?.tabs?.[data?.activeTab||0]?.url||defaults.currentPage,tabCount:Array.isArray(data?.tabs)?data.tabs.length:0}))}catch{}
}

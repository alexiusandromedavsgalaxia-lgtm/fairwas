const key="fairwas:v1";
const defaults={history:[],bookmarks:[],settings:{dark:true,home:"httc://home",search:""},tabs:[],activeTab:0,currentPage:"httc://home",activity:"idle"};
export function load(){
 try{
  const raw=JSON.parse(localStorage.getItem(key)||"null");
  return {
   history:Array.isArray(raw?.history)?raw.history:[],
   bookmarks:Array.isArray(raw?.bookmarks)?raw.bookmarks:[],
   settings:{...defaults.settings,...(raw?.settings&&typeof raw.settings==="object"?raw.settings:{})},
   tabs:Array.isArray(raw?.tabs)?raw.tabs:[],
   activeTab:Number.isInteger(raw?.activeTab)?raw.activeTab:0,
   currentPage:typeof raw?.currentPage==="string"?raw.currentPage:defaults.currentPage,
   activity:typeof raw?.activity==="string"?raw.activity:defaults.activity
  };
 }catch{return defaults}
}
export function save(data){
 try{localStorage.setItem(key,JSON.stringify({...data,currentPage:data?.currentPage||data?.tabs?.[data?.activeTab||0]?.url||defaults.currentPage,tabCount:Array.isArray(data?.tabs)?data.tabs.length:0}))}catch{}
}
const key="fairwas:v1";
const defaults={history:[],bookmarks:[],settings:{dark:true,home:"httc://home",search:""}};
export function load(){
 try{
  const raw=JSON.parse(localStorage.getItem(key)||"null");
  return {
   history:Array.isArray(raw?.history)?raw.history:[],
   bookmarks:Array.isArray(raw?.bookmarks)?raw.bookmarks:[],
   settings:{...defaults.settings,...(raw?.settings&&typeof raw.settings==="object"?raw.settings:{})}
  };
 }catch{return defaults}
}
export function save(data){
 try{localStorage.setItem(key,JSON.stringify(data))}catch{}
}
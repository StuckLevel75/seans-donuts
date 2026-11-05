// Converts public OneDrive share links to the documented shares API content endpoint.
// The remote file must be shared with "Anyone with the link"; OneDrive may still deny embedding.
export function imageSource(value){
  if(typeof value!=="string")return "";
  const raw=value.trim();
  if(raw.startsWith("/")&&!raw.startsWith("//"))return raw;
  let url;
  try{url=new URL(raw)}catch{return ""}
  if(url.protocol!=="https:")return "";
  if(url.hostname==="1drv.ms"||url.hostname==="onedrive.live.com"){
    const bytes=new TextEncoder().encode(raw);
    let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);
    const token=btoa(binary).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
    return "https://api.onedrive.com/v1.0/shares/u!"+token+"/root/content";
  }
  return raw;
}
export function attachImage(img,original){
  const src=imageSource(original);
  if(!src)return false;
  img.src=src;
  if(src!==original){
    img.referrerPolicy="no-referrer";
    img.addEventListener("error",()=>{
      img.hidden=true;
      const link=document.createElement("a");
      link.href=original;link.target="_blank";link.rel="noopener noreferrer";
      link.textContent="Open picture on OneDrive";
      img.after(link);
    },{once:true});
  }
  return true;
}

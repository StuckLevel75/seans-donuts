// Display direct HTTPS image URLs. OneDrive share pages are links, not guaranteed image bytes.
export function imageSource(value){
 if(typeof value!=="string")return "";
 const raw=value.trim();
 if(raw.startsWith("/")&&!raw.startsWith("//"))return raw;
 if(/^(?![a-z][a-z0-9+.-]*:)(?!\/\/)[^?#]+\.(png|jpe?g|gif|webp|avif)(?:[?#].*)?$/i.test(raw))return "/"+raw.split("/").map(encodeURIComponent).join("/");
 try{const url=new URL(raw);return url.protocol==="https:"?raw:""}catch{return ""}
}
export function attachImage(img,original){
 const src=imageSource(original);if(!src)return false;
 img.src=src;
 img.addEventListener("error",()=>{
   img.hidden=true;
   if(!img.isConnected)return;
   const link=document.createElement("a");link.href=src;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open picture";img.after(link);
 },{once:true});
 return true;
}

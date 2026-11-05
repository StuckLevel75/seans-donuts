// Discord CDN image URLs only for newly entered profile pictures.
export function isDiscordImage(value){
  if(!value)return true;
  try{const u=new URL(value);return u.protocol==="https:" && ["cdn.discordapp.com","media.discordapp.net"].includes(u.hostname) && /\.(?:png|jpe?g|gif|webp)$/i.test(u.pathname) && !u.username && !u.password;}
  catch{return false;}
}
export function imageSource(value){
  if(typeof value!=="string")return "";
  const raw=value.trim();
  if(raw.startsWith("/")&&!raw.startsWith("//"))return raw; // Existing bundled character image.
  try{const u=new URL(raw);return u.protocol==="https:"?raw:"";}catch{return ""}
}
export function attachImage(img,original){
  const src=imageSource(original);if(!src)return false;img.src=src;return true;
}

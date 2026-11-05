// Cloudinary image upload configuration. Add a restricted unsigned preset in Cloudinary.
export const cloudinaryConfig={cloudName:"",uploadPreset:""};
export function imageSource(value){if(typeof value!=="string")return "";const raw=value.trim();if(raw.startsWith("/")&&!raw.startsWith("//"))return raw;try{const u=new URL(raw);return u.protocol==="https:"?raw:""}catch{return ""}}
export function attachImage(img,original){const src=imageSource(original);if(!src)return false;img.src=src;return true}
export async function uploadImage(file){
  const {cloudName,uploadPreset}=cloudinaryConfig;
  if(!cloudName||!uploadPreset)throw Error("Cloudinary is not configured yet. Set cloudName and uploadPreset in image-links.js.");
  if(!file||!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type))throw Error("Select a PNG, JPG, GIF or WebP image.");
  if(file.size>5*1024*1024)throw Error("Image must be 5 MB or smaller.");
  const body=new FormData();body.append("file",file);body.append("upload_preset",uploadPreset);
  const response=await fetch("https://api.cloudinary.com/v1_1/"+encodeURIComponent(cloudName)+"/image/upload",{method:"POST",body});
  const data=await response.json();if(!response.ok||!data.secure_url)throw Error(data.error?.message||"Image upload failed.");
  return data.secure_url;
}

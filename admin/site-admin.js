import {getApp,getApps,initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,collection,getDocs,serverTimestamp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {firebaseConfig} from "../firebase-config.js";
const app=getApps().length?getApp():initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const DEFAULT=[["about","About Me"],["gta-rp","GTA RP"],["updates","Latest Updates"],["socials","Socials"],["streaming","Streaming"]].map(([id,title])=>({id,title,visible:true}));
let sections=structuredClone(DEFAULT),ready=false;
const clean=s=>s.map(x=>({id:x.id,title:x.title.slice(0,70),visible:!!x.visible}));
function drawBuilder(){
 const root=$("builder-sections");root.replaceChildren();
 sections.forEach((s,i)=>{
  const line=document.createElement("div");line.className="builder-item";line.draggable=true;line.dataset.id=s.id;
  const handle=document.createElement("span");handle.className="handle";handle.textContent="☰";
  const visible=document.createElement("input");visible.type="checkbox";visible.checked=s.visible;visible.title="Show section";
  visible.onchange=()=>{s.visible=visible.checked};
  const label=document.createElement("label");label.textContent="Visible ";label.append(visible);
  const title=document.createElement("input");title.type="text";title.maxLength=70;title.value=s.title;title.setAttribute("aria-label","Section title for "+s.id);title.oninput=()=>{s.title=title.value};
  const up=document.createElement("button");up.type="button";up.className="secondary";up.textContent="↑";up.disabled=i===0;up.onclick=()=>move(i,i-1);
  const down=document.createElement("button");down.type="button";down.className="secondary";down.textContent="↓";down.disabled=i===sections.length-1;down.onclick=()=>move(i,i+1);
  line.ondragstart=e=>{e.dataTransfer.setData("text/plain",s.id);e.dataTransfer.effectAllowed="move"};
  line.ondragover=e=>e.preventDefault();
  line.ondrop=e=>{e.preventDefault();const id=e.dataTransfer.getData("text/plain");const from=sections.findIndex(x=>x.id===id);if(from>=0&&from!==i)move(from,i)};
  line.append(handle,label,title,up,down);root.append(line);
 });
}
function move(from,to){const a=sections.splice(from,1)[0];sections.splice(to,0,a);drawBuilder()}
function preview(){
 const root=$("builder-preview-list");root.replaceChildren();
 sections.filter(s=>s.visible).forEach(s=>{const row=document.createElement("div");row.className="preview-row";const title=document.createElement("strong");title.textContent=s.title||s.id;const note=document.createElement("div");note.textContent="Section: "+s.id;row.append(title,note);root.append(row)});
 const old=$("builder-live-frame");if(old)old.remove();
 const frame=document.createElement("iframe");frame.id="builder-live-frame";frame.title="Unpublished homepage preview";frame.style.cssText="width:100%;height:560px;border:1px solid #31543a;border-radius:10px;margin-top:14px;background:#070b08";
 frame.src="/?layout-preview=1";frame.onload=()=>frame.contentWindow.postMessage({type:"sl75-layout-preview",sections:clean(sections),heroTitle:$("builder-hero-title").value,heroLead:$("builder-hero-lead").value},location.origin);
 $("builder-preview-area").append(frame);
 $("builder-preview-area").classList.remove("hidden");$("builder-status").textContent="Live preview only — not yet published.";
}
function normalize(saved){
 const map=new Map((Array.isArray(saved)?saved:[]).filter(s=>s&&typeof s.id==="string").map(s=>[s.id,s]));
 return DEFAULT.map(s=>{const v=map.get(s.id);return v?{id:s.id,title:typeof v.title==="string"?v.title.slice(0,70):s.title,visible:v.visible!==false}:s});
}
async function loadSettings(){
 try{
  const [layout,site,homepage]=await Promise.all([getDoc(doc(db,"settings","layout")),getDoc(doc(db,"settings","site")),getDoc(doc(db,"settings","homepage"))]);
  const hero=homepage.exists()?homepage.data():{};
  $("builder-hero-title").value=hero.heroTitle||"STUCKLEVEL75";
  $("builder-hero-lead").value=hero.heroLead||"Gaming, streaming, and everything I\u0027m working on. Find my socials, check out my content, and explore my GTA RP projects.";
  if(layout.exists()){
   const arr=layout.data().sections;
   const byId=new Map(normalize(arr).map(s=>[s.id,s]));
   sections=Array.isArray(arr)?[...arr.map(s=>byId.get(s.id)).filter(Boolean),...DEFAULT.map(s=>byId.get(s.id)).filter(s=>!arr.some(x=>x.id===s.id))]:structuredClone(DEFAULT);
  }else sections=structuredClone(DEFAULT);
  drawBuilder();
  const v=site.exists()?site.data():{};
  $("site-maintenance").checked=v.maintenance===true;
  $("site-registration").checked=v.registrationEnabled!==false;
  $("site-banner").checked=v.bannerEnabled===true;
  $("site-banner-text").value=v.bannerText||"";
  $("site-banner-start").value=v.bannerStart||"";
  $("site-banner-end").value=v.bannerEnd||"";
  $("system-status").textContent="Firebase connected. Settings loaded.";
  ready=true;
 }catch(e){$("system-status").textContent="Settings error: "+e.message}
}
$("builder-preview").onclick=preview;
$("builder-reset").onclick=()=>{sections=structuredClone(DEFAULT);drawBuilder();$("builder-status").textContent="Defaults restored in editor. Click Publish to save.";};
$("builder-publish").onclick=async()=>{
 if(!ready)return;
 if(!confirm("Publish homepage layout changes?"))return;
 try{await setDoc(doc(db,"settings","layout"),{sections:clean(sections),updatedAt:serverTimestamp()});await setDoc(doc(db,"settings","homepage"),{heroTitle:$("builder-hero-title").value.trim().slice(0,100),heroLead:$("builder-hero-lead").value.trim().slice(0,350),updatedAt:serverTimestamp()},{merge:true});$("builder-status").textContent="Homepage layout and content published."; }
 catch(e){$("builder-status").textContent="Publish failed: "+e.message}
};
$("site-settings").onsubmit=async e=>{
 e.preventDefault();if(!ready)return;
 const bannerStart=$("site-banner-start").value,bannerEnd=$("site-banner-end").value;
 if(bannerStart&&bannerEnd&&bannerEnd<=bannerStart){$("system-status").textContent="Banner end must be after start.";return}
 try{await setDoc(doc(db,"settings","site"),{
  maintenance:$("site-maintenance").checked,
  registrationEnabled:$("site-registration").checked,
  bannerEnabled:$("site-banner").checked,
  bannerText:$("site-banner-text").value.trim(),
  bannerStart,bannerEnd,updatedAt:serverTimestamp()
 });$("system-status").textContent="Site settings saved."}
 catch(e){$("system-status").textContent="Save failed: "+e.message}
};
async function loadMembers(){
 $("members-status").textContent="Loading members…";const root=$("members-list");root.replaceChildren();
 try{
  const snap=await getDocs(collection(db,"members"));
  for(const member of snap.docs){
   const data=member.data(),line=document.createElement("div");line.className="item";
   const title=document.createElement("strong");title.textContent=data.username||"Member";
   const info=document.createElement("p");info.className="hint";info.textContent="Account ID: "+member.id.slice(0,8)+"…";
   const flagRef=doc(db,"memberFlags",member.id),flag=await getDoc(flagRef),suspended=flag.exists()&&flag.data().suspended===true;
   const button=document.createElement("button");button.type="button";button.className=suspended?"secondary":"danger";button.textContent=suspended?"Restore Member":"Suspend Member";
   button.onclick=async()=>{if(!confirm((suspended?"Restore":"Suspend")+" this member?"))return;try{await setDoc(flagRef,{suspended:!suspended,updatedAt:serverTimestamp()},{merge:true});loadMembers()}catch(e){$("members-status").textContent=e.message}};
   line.append(title,info,button);root.append(line);
  }
  $("members-status").textContent=snap.size+" member profiles found.";
 }catch(e){$("members-status").textContent="Member list error: "+e.message}
}
$("members-refresh").onclick=loadMembers;
onAuthStateChanged(auth,user=>{ready=false;if(user){loadSettings();loadMembers()}else{$("system-status").textContent="Sign in to view settings.";sections=structuredClone(DEFAULT)}});

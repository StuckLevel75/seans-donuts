import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { attachImage } from "./image-links.js";
const $ = id => document.getElementById(id);
const graveyard=$("graveyard-list"),living=$("living-characters-list"),updates=$("updates-list"),modal=$("character-modal");
const sean={name:"Sean Salazar",role:"Business Owner · Gang Member",status:"dead",description:"Sean Salazar was a business owner and gang member in HighLife RP, best known for owning and operating Sean’s Donuts.",imageUrl:"/Screenshot%202026-01-22%20034911.png",businesses:"Sean's Donuts",affiliations:"Gang Member"};
let lastFocus=null,allUpdates=[],showAll=false;
function element(tag,cls,value){const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e}
function openProfile(c){
  lastFocus=document.activeElement;
  const root=$("profile-content");root.replaceChildren();
  if(c.imageUrl && (/^https:\/\//i.test(c.imageUrl)||c.imageUrl.startsWith("/"))){const img=element("img");img.alt=c.name+" screenshot";if(attachImage(img,c.imageUrl))root.append(img)}
  root.append(element("span","status "+(c.status==="dead"?"dead":"living-status"),c.status==="dead"?"Deceased":"Alive"));
  const name=element("h2",null,c.name);name.id="profile-name";root.append(name);
  root.append(element("div","character-role",c.role||""),element("p",null,c.description||""));
  for(const [label,value] of [["Businesses",c.businesses],["Affiliations",c.affiliations],["More History",c.history]]){
    if(!value)continue;const block=element("div","profile-extra");block.append(element("strong",null,label),element("div",null,value));root.append(block)
  }
  modal.hidden=false;document.body.style.overflow="hidden";$("profile-close").focus();
}
function closeProfile(){modal.hidden=true;document.body.style.overflow="";lastFocus?.focus()}
$("profile-close").addEventListener("click",closeProfile);
modal.addEventListener("click",e=>{if(e.target===modal)closeProfile()});
document.addEventListener("keydown",e=>{if(modal.hidden)return;if(e.key==="Escape")closeProfile();if(e.key==="Tab"){const controls=[...modal.querySelectorAll("button,a,input,[tabindex]:not([tabindex='-1'])")].filter(el=>!el.disabled);if(!controls.length)return;const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
function card(c){
  const a=element("article","character-card");a.dataset.profile="true";a.tabIndex=0;a.setAttribute("role","button");a.setAttribute("aria-label","View "+c.name+" profile");
  if(c.imageUrl&&(/^https:\/\//i.test(c.imageUrl)||c.imageUrl.startsWith("/"))){const img=element("img","character-photo");img.alt=c.name+" screenshot";img.loading="lazy";if(attachImage(img,c.imageUrl))a.append(img)}
  const d=element("div","character-details");d.append(element("span","status "+(c.status==="dead"?"dead":"living-status"),c.status==="dead"?"Deceased":"Alive"),element("h3",null,c.name||"Unnamed Character"),element("div","character-role",c.role||""),element("p",null,c.description||""));a.append(d);
  a.addEventListener("click",()=>openProfile(c));a.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openProfile(c)}});return a
}
function drawUpdates(){
  updates.replaceChildren();
  const sorted=[...allUpdates].sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  const shown=showAll?sorted:sorted.slice(0,3);
  if(!shown.length)updates.append(element("p","note","No announcements yet. Check back soon."));
  for(const u of shown){
    const a=element("article","update-card");
    if(u.pinned)a.append(element("div","update-pin","📌 Pinned"));
    const date=u.createdAt?.toDate?.();a.append(element("div","update-meta",(u.category||"General")+(date?" · "+date.toLocaleDateString():"")));
    a.append(element("h3",null,u.title||"Update"),element("p",null,u.body||""));updates.append(a)
  }
  $("updates-more").hidden=sorted.length<=3;$("updates-more").textContent=showAll?"Show fewer updates":"Show older updates";
}
$("updates-more").addEventListener("click",()=>{showAll=!showAll;drawUpdates()});
if(firebaseConfig.projectId&&firebaseConfig.apiKey){
  const db=getFirestore(initializeApp(firebaseConfig));
  onSnapshot(collection(db,"characters"),snap=>{
    const records=snap.docs.map(d=>({id:d.id,...d.data()}));
    const seanExists=records.some(c=>String(c.name||"").trim().toLowerCase()==="sean salazar");
    const dead=[...(!seanExists?[sean]:[]),...records.filter(c=>c.status==="dead")];
    const alive=records.filter(c=>c.status==="alive");
    dead.sort((a,b)=>(a.name||"").localeCompare(b.name||""));alive.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
    graveyard.replaceChildren(...dead.map(card));
    living.replaceChildren(...(alive.length?alive.map(card):[element("p","note","No living characters added yet.")]));
  },err=>{console.error("Characters unavailable",err);living.replaceChildren(element("p","note","Characters could not load right now."))});
  onSnapshot(doc(db,"settings","homepage"),snap=>{
    const about=snap.exists()?snap.data().about:null;
    if(typeof about==="string"&&about.trim()){
      const section=document.querySelector("#about .about");
      if(section)section.textContent=about.trim();
    }
  },err=>console.warn("Homepage settings unavailable",err.code));
  onSnapshot(collection(db,"updates"),snap=>{allUpdates=snap.docs.map(d=>({id:d.id,...d.data()}));drawUpdates()},err=>{console.error("Updates unavailable",err);updates.replaceChildren(element("p","note","Updates could not load. Check that the Firestore rules have been published."))});
}

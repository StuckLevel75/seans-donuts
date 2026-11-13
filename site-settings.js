import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getFirestore,doc,onSnapshot} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";
const app=initializeApp(firebaseConfig,"public-site-settings"),db=getFirestore(app);
const defaults=["about","gta-rp","characters","living-characters","graveyard","businesses","updates","socials","streaming"];
const originalTitles=new Map(defaults.map(id=>[id,document.querySelector("section#"+id+" h2")?.textContent||id]));
const main=document.querySelector("main"),hero=main.querySelector(".hero");
const heroTitle=hero.querySelector("h1"),heroLead=hero.querySelector(".lead");
const originalHeroTitle=heroTitle.textContent,originalHeroLead=heroLead.textContent;
function applyHero(v){if(v?.heroTitle&&v.heroTitle!=="STUCKLEVEL75")heroTitle.textContent=v.heroTitle;else{heroTitle.replaceChildren(document.createTextNode("STUCK"));const span=document.createElement("span");span.textContent="LEVEL75";heroTitle.append(span)}heroLead.textContent=v?.heroLead||originalHeroLead;}
const banner=document.getElementById("site-banner"),maintenance=document.getElementById("maintenance-screen");
function applyLayout(data){
 const sections=Array.isArray(data?.sections)?data.sections:[];
 const map=new Map(sections.filter(s=>s&&defaults.includes(s.id)).map(s=>[s.id,s]));
 const order=[...sections.map(s=>s.id).filter(id=>defaults.includes(id)),...defaults.filter(id=>!sections.some(s=>s.id===id))];
 for(const id of defaults){
  const section=document.getElementById(id),config=map.get(id);
  if(!section)continue;
  section.hidden=(id==="graveyard" ? true : id==="living-characters" ? false : config?.visible===false);
  const title=section.querySelector("h2");
  if(title)title.textContent=typeof config?.title==="string"&&config.title.trim()?config.title.slice(0,70):originalTitles.get(id);
 }
 for(const id of order){const section=document.getElementById(id);if(section)main.append(section)}
}
function applySite(data){
 const maintenanceOn=data?.maintenance===true;
 maintenance.hidden=!maintenanceOn;main.hidden=maintenanceOn;
 document.querySelector("header").hidden=maintenanceOn;
 const start=data?.bannerStart?new Date(data.bannerStart).getTime():0;
 const end=data?.bannerEnd?new Date(data.bannerEnd).getTime():Infinity;
 const now=Date.now();
 const show=data?.bannerEnabled===true&&!maintenanceOn&&!!data.bannerText&&(!start||now>=start)&&now<=end;
 banner.hidden=!show;
 banner.textContent=show?String(data.bannerText).slice(0,240):"";
}
const isPreview=new URLSearchParams(location.search).has("layout-preview");
if(isPreview){window.addEventListener("message",e=>{if(e.origin!==location.origin||e.data?.type!=="sl75-layout-preview")return;applyLayout({sections:e.data.sections});applyHero(e.data)});}
else onSnapshot(doc(db,"settings","layout"),snap=>applyLayout(snap.exists()?snap.data():null),err=>console.warn("Layout unavailable",err.code));
onSnapshot(doc(db,"settings","site"),snap=>applySite(snap.exists()?snap.data():null),err=>console.warn("Site settings unavailable",err.code));

if(!isPreview)onSnapshot(doc(db,"settings","homepage"),snap=>applyHero(snap.exists()?snap.data():null),err=>console.warn("Hero settings unavailable",err.code));

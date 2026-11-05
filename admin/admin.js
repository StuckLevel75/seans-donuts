import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore,collection,addDoc,doc,updateDoc,deleteDoc,onSnapshot,serverTimestamp,writeBatch,setDoc,query,where,getDocs } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "../firebase-config.js";
import { attachImage, uploadImage } from "../image-links.js";
const $=id=>document.getElementById(id),msg=s=>$("message").textContent=s;
const SEAN={name:"Sean Salazar",role:"Business Owner · Gang Member",status:"dead",description:"Sean Salazar was a business owner and gang member in HighLife RP, best known for owning and operating Sean’s Donuts.",imageUrl:"https://stucklevel75.com/Screenshot%202026-01-22%20034911.png",businesses:"Sean's Donuts",affiliations:"Gang Member",history:""};
const DEFAULT_ABOUT="Hey, I'm Dakota! I'm a gamer who enjoys GTA RP, streaming, and creating content. I've spent a lot of time playing GTA RP, building businesses, and creating different characters along the way.";
if(!firebaseConfig.apiKey||!firebaseConfig.projectId){$("setup").classList.remove("hidden");$("login").classList.add("hidden")}
else{
  const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
  let characters=[],posts=[],unsubscribe=[];
  let analyticsRequest=0;
  async function loadTraffic(){
    const request=++analyticsRequest;
    const cutoff=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
    const today=new Date().toISOString().slice(0,10);
    const status=$("traffic-status");status.textContent="Loading analytics…";
    try{
      const snap=await getDocs(query(collection(db,"trafficVisits"),where("day",">=",cutoff)));
      if(request!==analyticsRequest)return;
      const visits=snap.docs.map(d=>d.data()).filter(v=>v.day>=cutoff && (v.page==="home"||v.page==="remington"));
      const unique=new Set(visits.map(v=>v.uid)).size;
      const todayUnique=new Set(visits.filter(v=>v.day===today).map(v=>v.uid)).size;
      const counts={home:0,remington:0},daily={};
      for(const v of visits){counts[v.page]++;daily[v.day]=(daily[v.day]||0)+1}
      $("traffic-visitors").textContent=unique.toLocaleString();
      $("traffic-views").textContent=visits.length.toLocaleString();
      $("traffic-today").textContent=todayUnique.toLocaleString();
      $("traffic-top").textContent=visits.length?(counts.home>=counts.remington?"Homepage":"Remington Market"):"—";
      $("traffic-pages").textContent="Homepage: "+counts.home+" · Remington Market: "+counts.remington;
      const bars=$("traffic-bars");bars.replaceChildren();
      const days=Array.from({length:7},(_,i)=>new Date(Date.now()-(6-i)*86400000).toISOString().slice(0,10));
      const max=Math.max(1,...days.map(d=>daily[d]||0));
      for(const day of days){
        const wrapper=document.createElement("div");wrapper.className="traffic-day";
        const number=document.createElement("span");number.textContent=daily[day]||0;
        const bar=document.createElement("div");bar.className="traffic-column";bar.style.height=(Math.max(3,(daily[day]||0)/max*90))+"px";
        const label=document.createElement("span");label.textContent=day.slice(5);
        wrapper.append(number,bar,label);bars.append(wrapper);
      }
      status.textContent="Last refreshed: "+new Date().toLocaleTimeString()+". Counts are approximate; one visit per browser, page and UTC day.";
    }catch(err){if(request===analyticsRequest)status.textContent="Could not load analytics: "+err.message+" (check Firestore rules)."}
  }
  $("analytics-admin").addEventListener("click",()=>{});
  document.querySelector('a[href="#analytics-admin"]').addEventListener("click",()=>{if(auth.currentUser)loadTraffic()});

  const updateCounts=()=>$("overview-counts").textContent=characters.length+" saved characters · "+posts.length+" announcements";
  const resetCharacter=()=>{$("editor").reset();$("character-id").value="";$("form-title").textContent="Add Character"};
  const resetUpdate=()=>{$("update-editor").reset();$("update-id").value="";$("update-form-title").textContent="New Announcement"};
  const makeButton=(label,cls,handler)=>{const b=document.createElement("button");b.type="button";b.className=cls;b.textContent=label;b.addEventListener("click",handler);return b};
  const displayCharacters=()=>{
    const root=$("records");root.replaceChildren();
    for(const c of characters){
      const item=document.createElement("div");item.className="item";const title=document.createElement("strong");
      title.textContent=(c.name||"Unnamed")+" — "+(c.status==="dead"?"Deceased":"Alive");item.append(title);
      if(c.imageUrl&&/^https:\/\//i.test(c.imageUrl)){const img=document.createElement("img");img.alt=c.name||"Character";if(attachImage(img,c.imageUrl))item.append(img)}
      item.append(makeButton("Edit","secondary",()=>{for(const k of ["name","role","status","description","businesses","affiliations","history"]){$(k).value=c[k]|| (k==="status"?"dead":"")} $("image-url").value=c.imageUrl||"";$("character-id").value=c.id;$("form-title").textContent="Edit Character";$("characters-admin").scrollIntoView({behavior:"smooth"})}),
        makeButton("Delete","danger",async()=>{if(!confirm("Delete "+c.name+"?"))return;try{await deleteDoc(doc(db,"characters",c.id));msg("Character deleted");resetCharacter()}catch(e){msg("Delete failed: "+e.message)}}));root.append(item)
    }
  };
  const displayUpdates=()=>{
    const root=$("update-records");root.replaceChildren();
    for(const u of [...posts].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))){
      const item=document.createElement("div");item.className="item";const title=document.createElement("strong");title.textContent=(u.pinned?"📌 ":"")+(u.title||"Update")+" — "+(u.category||"General");item.append(title);
      item.append(makeButton("Edit","secondary",()=>{$("update-id").value=u.id;$("update-title").value=u.title||"";$("update-category").value=u.category||"General";$("update-body").value=u.body||"";$("update-pinned").checked=!!u.pinned;$("update-form-title").textContent="Edit Announcement";$("updates-admin").scrollIntoView({behavior:"smooth"})}),
      makeButton("Delete","danger",async()=>{if(!confirm("Delete this announcement?"))return;try{await deleteDoc(doc(db,"updates",u.id));msg("Announcement deleted");resetUpdate()}catch(e){msg("Delete failed: "+e.message)}}));root.append(item)
    }
  };
  onAuthStateChanged(auth,user=>{
    unsubscribe.forEach(fn=>fn());unsubscribe=[];
    $("login").classList.toggle("hidden",!!user);$("dashboard").classList.toggle("hidden",!user);
    if(!user){analyticsRequest++;return;} loadTraffic();
    unsubscribe.push(onSnapshot(collection(db,"characters"),snap=>{characters=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));displayCharacters();updateCounts();$("import-sean").disabled=characters.some(c=>(c.name||"").trim().toLowerCase()==="sean salazar")},e=>msg("Cannot load characters: "+e.message)));
    unsubscribe.push(onSnapshot(collection(db,"updates"),snap=>{posts=snap.docs.map(d=>({id:d.id,...d.data()}));displayUpdates();updateCounts()},e=>msg("Cannot load announcements: "+e.message+" — publish the new Firestore rules")));
    unsubscribe.push(onSnapshot(doc(db,"settings","homepage"),snap=>{$("homepage-about").value=snap.exists()?(snap.data().about||DEFAULT_ABOUT):DEFAULT_ABOUT},e=>msg("Cannot load homepage settings: "+e.message+" — publish the new Firestore rules")));
  });
  $("login").onsubmit=async e=>{e.preventDefault();try{await signInWithEmailAndPassword(auth,$("email").value,$("password").value);$("password").value="";msg("Signed in")}catch(e){msg("Login failed: "+e.message)}};
  $("logout").onclick=()=>signOut(auth);
  $("cancel").onclick=resetCharacter;$("update-cancel").onclick=resetUpdate;
  $("character-upload").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{msg("Uploading picture…");$("image-url").value=await uploadImage(file);msg("Picture uploaded. Save Character to apply it.")}catch(err){msg(err.message)}finally{e.target.value=""}});
  $("editor").onsubmit=async e=>{
    e.preventDefault();const id=$("character-id").value,imageUrl=$("image-url").value.trim();
    if(imageUrl&&!/^https:\/\/[^\s]+$/i.test(imageUrl)){msg("Upload a picture or enter a valid HTTPS image URL.");return}
    const data={name:$("name").value.trim(),role:$("role").value.trim(),status:$("status").value,description:$("description").value.trim(),businesses:$("businesses").value.trim(),affiliations:$("affiliations").value.trim(),history:$("history").value.trim(),imageUrl};
    if(!data.name||!data.role||!data.description){msg("Complete required fields");return}
    try{msg("Saving character…");
      if(id)await updateDoc(doc(db,"characters",id),data);
      else{
        const characterRef=doc(collection(db,"characters"));const announcementRef=doc(db,"updates","character-"+characterRef.id);
        const batch=writeBatch(db);batch.set(characterRef,{...data,createdAt:serverTimestamp()});
        batch.set(announcementRef,{title:"New GTA RP Character: "+data.name,category:"Characters",body:data.name+" has been added to the "+(data.status==="dead"?"Character Graveyard.":"Living Characters roster."),pinned:false,automatic:true,characterId:characterRef.id,createdAt:serverTimestamp()});
        await batch.commit();
      }
      resetCharacter();msg("Character saved")
    }catch(err){msg("Save failed: "+err.message)}
  };
  $("import-sean").onclick=async()=>{if(characters.some(c=>(c.name||"").trim().toLowerCase()==="sean salazar")){msg("Sean Salazar is already in the admin");return}
    if(!confirm("Add Sean Salazar to Firebase so you can edit his profile?"))return;
    try{await addDoc(collection(db,"characters"),{...SEAN,createdAt:serverTimestamp()});msg("Sean Salazar is now editable in Characters")}catch(e){msg("Import failed: "+e.message)}
  };
  $("update-editor").onsubmit=async e=>{e.preventDefault();const id=$("update-id").value;const data={title:$("update-title").value.trim(),category:$("update-category").value,body:$("update-body").value.trim(),pinned:$("update-pinned").checked};if(!data.title||!data.body)return;
    try{msg("Saving announcement…");if(id)await updateDoc(doc(db,"updates",id),data);else await addDoc(collection(db,"updates"),{...data,createdAt:serverTimestamp()});resetUpdate();msg("Announcement saved")}catch(err){msg("Announcement failed: "+err.message)}
  };
  $("homepage-editor").onsubmit=async e=>{e.preventDefault();const about=$("homepage-about").value.trim();if(!about){msg("About Me cannot be empty");return}try{await setDoc(doc(db,"settings","homepage"),{about,updatedAt:serverTimestamp()},{merge:true});msg("Homepage text saved")}catch(err){msg("Homepage save failed: "+err.message)}};
}

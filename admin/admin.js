import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore,collection,addDoc,doc,updateDoc,deleteDoc,onSnapshot,serverTimestamp,writeBatch,setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "../firebase-config.js";
const $=id=>document.getElementById(id),msg=s=>$("message").textContent=s;
const SEAN={name:"Sean Salazar",role:"Business Owner · Gang Member",status:"dead",description:"Sean Salazar was a business owner and gang member in HighLife RP, best known for owning and operating Sean’s Donuts.",imageUrl:"https://stucklevel75.com/Screenshot%202026-01-22%20034911.png",businesses:"Sean's Donuts",affiliations:"Gang Member",history:""};
const DEFAULT_ABOUT="Hey, I'm Dakota! I'm a gamer who enjoys GTA RP, streaming, and creating content. I've spent a lot of time playing GTA RP, building businesses, and creating different characters along the way.";
if(!firebaseConfig.apiKey||!firebaseConfig.projectId){$("setup").classList.remove("hidden");$("login").classList.add("hidden")}
else{
  const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
  let characters=[],posts=[],unsubscribe=[];
  const updateCounts=()=>$("overview-counts").textContent=characters.length+" saved characters · "+posts.length+" announcements";
  const resetCharacter=()=>{$("editor").reset();$("character-id").value="";$("form-title").textContent="Add Character"};
  const resetUpdate=()=>{$("update-editor").reset();$("update-id").value="";$("update-form-title").textContent="New Announcement"};
  const makeButton=(label,cls,handler)=>{const b=document.createElement("button");b.type="button";b.className=cls;b.textContent=label;b.addEventListener("click",handler);return b};
  const displayCharacters=()=>{
    const root=$("records");root.replaceChildren();
    for(const c of characters){
      const item=document.createElement("div");item.className="item";const title=document.createElement("strong");
      title.textContent=(c.name||"Unnamed")+" — "+(c.status==="dead"?"Deceased":"Alive");item.append(title);
      if(c.imageUrl&&/^https:\/\//i.test(c.imageUrl)){const img=document.createElement("img");img.src=c.imageUrl;img.alt=c.name||"Character";item.append(img)}
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
    if(!user)return;
    unsubscribe.push(onSnapshot(collection(db,"characters"),snap=>{characters=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));displayCharacters();updateCounts();$("import-sean").disabled=characters.some(c=>(c.name||"").trim().toLowerCase()==="sean salazar")},e=>msg("Cannot load characters: "+e.message)));
    unsubscribe.push(onSnapshot(collection(db,"updates"),snap=>{posts=snap.docs.map(d=>({id:d.id,...d.data()}));displayUpdates();updateCounts()},e=>msg("Cannot load announcements: "+e.message+" — publish the new Firestore rules")));
    unsubscribe.push(onSnapshot(doc(db,"settings","homepage"),snap=>{$("homepage-about").value=snap.exists()?(snap.data().about||DEFAULT_ABOUT):DEFAULT_ABOUT},e=>msg("Cannot load homepage settings: "+e.message+" — publish the new Firestore rules")));
  });
  $("login").onsubmit=async e=>{e.preventDefault();try{await signInWithEmailAndPassword(auth,$("email").value,$("password").value);$("password").value="";msg("Signed in")}catch(e){msg("Login failed: "+e.message)}};
  $("logout").onclick=()=>signOut(auth);
  $("cancel").onclick=resetCharacter;$("update-cancel").onclick=resetUpdate;
  $("editor").onsubmit=async e=>{
    e.preventDefault();const id=$("character-id").value,imageUrl=$("image-url").value.trim();
    if(imageUrl&&!/^https:\/\/[^\s]+$/i.test(imageUrl)){msg("Enter a valid HTTPS image link");return}
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

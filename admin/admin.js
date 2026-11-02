import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "../firebase-config.js";
const $ = id => document.getElementById(id), msg = s => $("message").textContent=s;
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  $("setup").classList.remove("hidden"); $("login").classList.add("hidden");
} else {
  const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
  let records=[], unsubscribe=()=>{};
  const reset=()=>{$("editor").reset();$("character-id").value="";$("form-title").textContent="Add Character"};
  onAuthStateChanged(auth,user=>{
    unsubscribe();unsubscribe=()=>{};
    $("login").classList.toggle("hidden",!!user);$("dashboard").classList.toggle("hidden",!user);
    if(!user)return;
    unsubscribe=onSnapshot(collection(db,"characters"),snap=>{
      records=snap.docs.map(d=>({id:d.id,...d.data()}));records.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
      $("records").replaceChildren();
      for(const c of records){
        const item=document.createElement("div");item.className="item";
        const title=document.createElement("strong");title.textContent=(c.name||"Unnamed")+" — "+(c.status==="dead"?"Deceased":"Alive");item.append(title);
        if(c.imageUrl){const img=document.createElement("img");img.src=c.imageUrl;img.alt=c.name||"Character";item.append(img)}
        const edit=document.createElement("button");edit.textContent="Edit";edit.className="secondary";edit.onclick=()=>{
          $("character-id").value=c.id;$("name").value=c.name||"";$("role").value=c.role||"";$("status").value=c.status||"dead";$("description").value=c.description||"";$("image-url").value=c.imageUrl||"";$("form-title").textContent="Edit Character";window.scrollTo({top:0,behavior:"smooth"});
        };
        const del=document.createElement("button");del.textContent="Delete";del.className="danger";del.onclick=async()=>{
          if(!confirm("Delete "+c.name+"?"))return;
          try{await deleteDoc(doc(db,"characters",c.id));msg("Character deleted");reset()}catch(e){msg("Delete failed: "+e.message)}
        };
        item.append(edit,del);$("records").append(item);
      }
    },e=>msg("Cannot load characters: "+e.message));
  });
  $("login").onsubmit=async e=>{e.preventDefault();try{await signInWithEmailAndPassword(auth,$("email").value,$("password").value);$("password").value="";msg("Signed in")}catch(e){msg("Login failed: "+e.message)}};
  $("logout").onclick=()=>signOut(auth);
  $("cancel").onclick=reset;
  $("editor").onsubmit=async e=>{
    e.preventDefault();const id=$("character-id").value;
    const imageUrl=$("image-url").value.trim();
    if(imageUrl && !/^https:\/\/[^\s]+$/i.test(imageUrl)){msg("Enter a valid HTTPS image link");return}
    const data={name:$("name").value.trim(),role:$("role").value.trim(),status:$("status").value,description:$("description").value.trim(),imageUrl};
    if(!data.name||!data.role||!data.description){msg("Complete all required fields");return}
    try{
      msg("Saving…");
      if(id) await updateDoc(doc(db,"characters",id),data);
      else await addDoc(collection(db,"characters"),{...data,createdAt:serverTimestamp()});
      reset();msg("Character saved");
    }catch(err){msg("Save failed: "+err.message)}
  };
}

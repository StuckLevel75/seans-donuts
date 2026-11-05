import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,sendEmailVerification,sendPasswordResetEmail} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {firebaseConfig} from "../firebase-config.js";
import {uploadImage,imageSource} from "../image-links.js";
const $=id=>document.getElementById(id),app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const status=s=>$("status").textContent=s;
let pendingName="",current=null,blocked=false;
async function checkSite(){
  try{const s=await getDoc(doc(db,"settings","site"));blocked=s.exists()&&s.data().registrationEnabled===false}
  catch(e){blocked=true;status("Registration settings unavailable; new registrations paused.")}
  $("signup").classList.toggle("hidden",blocked);
}
await checkSite();
onAuthStateChanged(auth,async user=>{
  current=user&&!user.isAnonymous?user:null;
  $("guest").classList.toggle("hidden",!!current);$("member").classList.toggle("hidden",!current);
  if(!current)return;
  $("email-display").textContent=current.email||"";
  $("verification").textContent=current.emailVerified?"Email verified":"Please verify your email address.";
  $("verify").classList.toggle("hidden",current.emailVerified);
  try{
    const ref=doc(db,"members",current.uid),snap=await getDoc(ref);
    if(snap.exists()){
      const p=snap.data();$("username").value=p.username||"";$("bio").value=p.bio||"";$("avatar").value=p.avatarUrl||"";
    }else if(pendingName){
      await setDoc(ref,{username:pendingName,bio:"",avatarUrl:"",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      $("username").value=pendingName;$("bio").value="";$("avatar").value="";
      pendingName="";
    }else{status("Profile not created yet. Enter a username and save.")}
    const flag=await getDoc(doc(db,"memberFlags",current.uid));
    if(flag.exists()&&flag.data().suspended===true){
      $("profile").classList.add("hidden");status("This account is suspended from member features.");
    }else $("profile").classList.remove("hidden");
    $("avatar-preview").src=imageSource($("avatar").value);
  }catch(e){status("Could not load profile: "+e.message)}
});
$("signup").onsubmit=async e=>{
  e.preventDefault();await checkSite();if(blocked){status("Registration is currently closed.");return}
  pendingName=$("new-name").value.trim();
  if(pendingName.length<2)return;
  try{const result=await createUserWithEmailAndPassword(auth,$("new-email").value,$("new-password").value);await sendEmailVerification(result.user);status("Account created. Check your email to verify your address.")}
  catch(err){status("Registration failed: "+err.message)}
};
$("signin").onsubmit=async e=>{e.preventDefault();try{await signInWithEmailAndPassword(auth,$("email").value,$("password").value);status("Signed in.")}catch(err){status("Sign in failed: "+err.message)}};
$("logout").onclick=()=>signOut(auth);
$("verify").onclick=async()=>{try{await sendEmailVerification(auth.currentUser);status("Verification email sent.")}catch(err){status(err.message)}};
$("reset-password").onclick=async()=>{const email=$("email").value.trim();if(!email){status("Enter your email in the Sign In form first.");return}try{await sendPasswordResetEmail(auth,email);status("If the address is registered, a reset email will be sent.")}catch(err){status(err.message)}};
$("avatar-upload").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{status("Uploading avatar…");const url=await uploadImage(file);$("avatar").value=url;$("avatar-preview").src=url;status("Avatar uploaded. Save Profile to apply it.")}catch(err){status(err.message)}finally{e.target.value=""}});
$("profile").onsubmit=async e=>{
  e.preventDefault();if(!current)return;
  const username=$("username").value.trim(),bio=$("bio").value.trim(),avatarUrl=$("avatar").value.trim();
  if(username.length<2||username.length>32||bio.length>500||avatarUrl.length>500||(avatarUrl&&!/^https:\/\/[^\s]+$/i.test(avatarUrl))){status("Check username, bio, and avatar image URL.");return}
  try{
    const ref=doc(db,"members",current.uid),existing=await getDoc(ref);
    const data={username,bio,avatarUrl,updatedAt:serverTimestamp()};
    if(!existing.exists())data.createdAt=serverTimestamp();
    await setDoc(ref,data,{merge:true});
    $("avatar-preview").src=imageSource(avatarUrl);status("Private profile saved.");
  }catch(err){status("Save failed: "+err.message)}
};

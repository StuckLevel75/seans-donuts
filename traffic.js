import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  const app=initializeApp(firebaseConfig,"traffic-tracker"),auth=getAuth(app),db=getFirestore(app);
  const page=location.pathname.startsWith("/remington")?"remington":"home";
  const day=new Date().toISOString().slice(0,10);
  const key="sl75-traffic-"+page+"-"+day;
  let started=false;
  async function record(user){
    if(!user||!user.isAnonymous||started||sessionStorage.getItem(key))return;
    started=true;
    try{
      await setDoc(doc(db,"trafficVisits",user.uid+"_"+day+"_"+page),{uid:user.uid,day,page});
      sessionStorage.setItem(key,"1");
    }catch(err){
      if(err.code==="permission-denied")sessionStorage.setItem(key,"1");
      else console.warn("Traffic tracking unavailable:",err.code);
    }
  }
  onAuthStateChanged(auth,async user=>{
    if(user)return record(user);
    try{await signInAnonymously(auth)}
    catch(err){console.warn("Anonymous tracking unavailable:",err.code)}
  });
}

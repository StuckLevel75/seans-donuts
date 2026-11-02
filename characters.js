import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
const list = document.getElementById("graveyard-list");
if (list && firebaseConfig.projectId && firebaseConfig.apiKey) {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const esc = s => String(s || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  onSnapshot(query(collection(db,"characters"),orderBy("createdAt","asc")), snap => {
    const records = snap.docs.map(d => d.data()).filter(c => c.status === "dead");
    if (!records.length) return;
    list.replaceChildren();
    for (const c of records) {
      const article = document.createElement("article"); article.className="character-card";
      const details = document.createElement("div"); details.className="character-details";
      if (c.imageUrl && /^https:\/\//.test(c.imageUrl)) {
        const img=document.createElement("img"); img.className="character-photo"; img.src=c.imageUrl; img.alt=(c.name || "Character")+" screenshot"; img.loading="lazy"; article.append(img);
      }
      details.innerHTML='<span class="status dead">Deceased</span><h3>'+esc(c.name)+'</h3><div class="character-role">'+esc(c.role)+'</div><p>'+esc(c.description)+'</p>';
      article.append(details); list.append(article);
    }
  }, err => console.warn("Character list unavailable",err.code));
}

import { db } from '../services/firebase.js';
import {
  collection,
  collectionGroup,
  getDocs,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function migratePublishStatus() {
  const confirmRun = confirm("รัน Migration ใช่หรือไม่?");
  if (!confirmRun) return;

  let updatedCount = 0;

  // 1️⃣ Migrate novels
  const novelsSnap = await getDocs(collection(db, "novels"));

  for (const novelDoc of novelsSnap.docs) {
    const data = novelDoc.data();
    const patch = {};

    if (!data.publishStatus) {
      patch.publishStatus = data.isPublished ? "published" : "draft";
    }

    if (!data.unlockedBy) {
      patch.unlockedBy = [];
    }

    if (Object.keys(patch).length > 0) {
      await updateDoc(doc(db, "novels", novelDoc.id), patch);
      updatedCount++;
    }
  }

  // 2️⃣ Migrate all episodes
  const episodesSnap = await getDocs(collectionGroup(db, "episodes"));

  for (const epDoc of episodesSnap.docs) {
    const data = epDoc.data();
    const patch = {};

    if (!data.publishStatus) {
      patch.publishStatus = data.isPublished ? "published" : "draft";
    }

    if (!data.unlockedBy) {
      patch.unlockedBy = [];
    }

    if (Object.keys(patch).length > 0) {
      await updateDoc(epDoc.ref, patch);
      updatedCount++;
    }
  }

  alert(`Migration เสร็จแล้ว! อัปเดตทั้งหมด ${updatedCount} documents`);
  console.log("Migration complete");
}

window.runMigration = migratePublishStatus;
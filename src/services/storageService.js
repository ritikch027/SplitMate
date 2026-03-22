import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { storage } from "../config/firebaseConfig";

export const uploadProfilePhoto = async (userId, localUri) => {
  const response = await fetch(localUri);
  const blob = await response.blob();

  const storageRef = ref(storage, `profilePhotos/${userId}/${Date.now()}.jpg`);

  await uploadBytes(storageRef, blob, {
    contentType: "image/jpeg",
  });

  return getDownloadURL(storageRef);
};

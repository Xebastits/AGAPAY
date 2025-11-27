// src/lib/cloudinary.ts

export const uploadToCloudinary = async (file: File) => {

  const cloudName = "dhc2nduyf"; 
  const uploadPreset = "vkcgsvte"; 

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: formData }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Upload failed");
    
    return data.secure_url; // Returns the HTTPS link (e.g., res.cloudinary.com/...)
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    throw error;
  }
};
"use client";

import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { uploadToCloudinary } from "@/app/lib/cloudinary";

type CreateCampaignModalProps = {
    setIsModalOpen: (value: boolean) => void;
    refreshRequests: () => void;
};

export default function CreateCampaignModal({
    setIsModalOpen,
    refreshRequests
}: CreateCampaignModalProps) {

    const account = useActiveAccount();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [fullName, setFullName] = useState("");
    const [name, setName] = useState("");
    const [age, setAge] = useState(""); 
    const [description, setDescription] = useState("");
    const [goal, setGoal] = useState("100"); // Default reasonable goal
    const [deadline, setDeadline] = useState("30"); // Default 30 days
    const [isEmergency, setIsEmergency] = useState(false);
    const [campaignImage, setCampaignImage] = useState<File | null>(null);
    const [idImage, setIdImage] = useState<File | null>(null);

    // Status Modal State
    const [statusModal, setStatusModal] = useState<{
        isOpen: boolean;
        type: "success" | "error";
        title: string;
        message: string;
        onClose?: () => void;
    }>({ isOpen: false, type: "success", title: "", message: "" });

    const closeStatusModal = () => {
        const callback = statusModal.onClose;
        setStatusModal({ ...statusModal, isOpen: false });
        if (callback) callback();
    };

    // 1. Helper: Blocks non-integer keys
    const preventNonIntegers = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (["e", "E", "+", "-", "."].includes(e.key)) {
            e.preventDefault();
        }
    };

    // 2. Helper: Input Change (Allows typing freely)
    const handleIntegerChange = (
        e: React.ChangeEvent<HTMLInputElement>, 
        setter: (val: string) => void
    ) => {
        const val = e.target.value;
        if (val === "" || /^\d+$/.test(val)) {
            setter(val);
        }
    };

    // 3. NEW: Blur Handler (Forces Minimum/Maximum on exit)
    const handleBlur = (
        value: string, 
        setter: (val: string) => void, 
        min: number, 
        max?: number
    ) => {
        let num = parseInt(value);
        if (isNaN(num)) num = min; // Default to min if empty

        if (num < min) num = min;  // Force Minimum
        if (max && num > max) num = max; // Force Maximum

        setter(num.toString());
    };

    const handleSubmit = async () => {
        if (!account) {
            setStatusModal({
                isOpen: true,
                type: "error",
                title: "Wallet Required",
                message: "Please connect your wallet first."
            });
            return;
        }

        const numericGoal = parseInt(goal);
        const numericAge = parseInt(age);
        const numericDeadline = parseInt(deadline);

        // Final Validation Check
        if (isNaN(numericGoal) || numericGoal < 1) {
            setStatusModal({ isOpen: true, type: "error", title: "Invalid Goal", message: "Goal must be at least 1 PHP." });
            return;
        }
        if (isNaN(numericAge) || numericAge < 18) {
            setStatusModal({ isOpen: true, type: "error", title: "Invalid Age", message: "You must be at least 18 years old." });
            return;
        }
        if (isNaN(numericDeadline) || numericDeadline < 1) {
            setStatusModal({ isOpen: true, type: "error", title: "Invalid Duration", message: "Duration must be at least 1 day." });
            return;
        }

        if (!fullName || !name || !description || !campaignImage || !idImage) {
            setStatusModal({
                isOpen: true,
                type: "error",
                title: "Missing Fields",
                message: "Please fill all fields and upload BOTH images."
            });
            return;
        }

        try {
            setIsSubmitting(true);

            const campUrl = await uploadToCloudinary(campaignImage);
            const idUrl = await uploadToCloudinary(idImage);
            const finalName = isEmergency ? `(EMERGENCY) ${name}` : name;

            await addDoc(collection(db, "campaigns"), {
                creator: account.address,
                fullName,
                name: finalName,
                description,
                age: numericAge, 
                goal: numericGoal.toString(), 
                deadline: numericDeadline, 
                isEmergency,
                imageUrl: campUrl,
                idImageUrl: idUrl,
                status: "pending",
                createdAt: Date.now()
            });

            setStatusModal({
                isOpen: true,
                type: "success",
                title: "Success!",
                message: "Your campaign request has been submitted successfully.",
                onClose: () => {
                    refreshRequests();
                    setIsModalOpen(false);
                }
            });

        } catch (error) {
            console.error("Submission Error:", error);
            setStatusModal({
                isOpen: true,
                type: "error",
                title: "Submission Failed",
                message: "An error occurred while saving your request."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center backdrop-blur-md z-50 p-4">
            <div className="w-full max-w-lg bg-white p-6 rounded-lg shadow-xl max-h-[100vh] overflow-y-auto relative">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <p className="text-xl font-bold">New Campaign Request<span style={{ color: 'red' }}>*</span></p>
                    <button className="text-gray-500 hover:text-black" onClick={() => setIsModalOpen(false)}>✕</button>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-bold mb-1">User&apos;s Legal Name</label>
                            <input 
                                value={fullName} 
                                onChange={(e) => setFullName(e.target.value)} 
                                className="w-full px-3 py-2 border rounded" 
                                placeholder="John Doe" 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">Age (18+)</label>
                            <input 
                                type="number" 
                                value={age} 
                                onChange={(e) => handleIntegerChange(e, setAge)} 
                                onBlur={() => handleBlur(age, setAge, 18, 150)} // Force 18-150 range
                                onKeyDown={preventNonIntegers}
                                className="w-full px-3 py-2 border rounded" 
                                placeholder="18" 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-1">Campaign Title</label>
                        <input 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            className="w-full px-3 py-2 border rounded" 
                            placeholder="Title" 
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-1">Description</label>
                        <textarea 
                            value={description} 
                            onChange={(e) => setDescription(e.target.value)} 
                            className="w-full px-3 py-2 border rounded h-24" 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-1">Goal (PHP)</label>
                            <input 
                                type="number" 
                                value={goal} 
                                onChange={(e) => handleIntegerChange(e, setGoal)}
                                onBlur={() => handleBlur(goal, setGoal, 1)} // Force Min 1
                                onKeyDown={preventNonIntegers}
                                className="w-full px-3 py-2 border rounded" 
                                placeholder="1000"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">Duration (Days)</label>
                            <input 
                                type="number" 
                                value={deadline} 
                                onChange={(e) => handleIntegerChange(e, setDeadline)}
                                onBlur={() => handleBlur(deadline, setDeadline, 1)} // Force Min 1
                                onKeyDown={preventNonIntegers}
                                className="w-full px-3 py-2 border rounded" 
                                placeholder="30"
                            />
                        </div>
                    </div>

                    <div className={`p-4 rounded border cursor-pointer flex items-center gap-3 ${isEmergency ? "bg-red-50 border-red-300" : "bg-slate-50 border-slate-200"}`} onClick={() => setIsEmergency(!isEmergency)}>
                        <input type="checkbox" checked={isEmergency} onChange={(e) => setIsEmergency(e.target.checked)} className="w-5 h-5 text-red-600 rounded" />
                            <label className={`block font-bold text-sm cursor-pointer ${isEmergency ? 'text-red-700' : 'text-slate-600'}`}>
                                Mark as Emergency (High Priority)
                            </label>
                    </div>

                    <div className="border-t pt-4 mt-2">
                        <label className="block text-sm font-bold text-blue-800 mb-2">1. Campaign Cover Image</label>
                        <input type="file" accept="image/*" onChange={(e) => setCampaignImage(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    </div>

                    <div className="border-t pt-4 mt-2 bg-yellow-50 p-3 rounded">
                        <label className="block text-sm font-bold text-yellow-800 mb-2">2. ID Verification</label>
                        <input type="file" accept="image/*" onChange={(e) => setIdImage(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-100 file:text-yellow-700 hover:file:bg-yellow-200" />
                    </div>

                    <button onClick={handleSubmit} disabled={isSubmitting} className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded">
                        {isSubmitting ? "Uploading..." : "Submit for Approval"}
                    </button>
                </div>
            </div>

            {/* STATUS MODAL */}
            {statusModal.isOpen && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 z-[60]">
                    <div className="bg-white rounded-lg shadow-2xl p-6 max-w-sm w-full">
                        <h3 className={`text-xl font-bold text-center mb-2 ${statusModal.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                            {statusModal.title}
                        </h3>
                        <p className="text-center text-gray-600 mb-6">{statusModal.message}</p>
                        <button 
                            onClick={closeStatusModal} 
                            className={`w-full py-2.5 rounded-lg text-white font-bold ${statusModal.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                            Okay
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
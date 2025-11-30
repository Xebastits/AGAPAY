"use client";

type CampaignRequest = {
    id: string;
    name: string;
    rejectionReason?: string;
    rejectionTime?: number;
};

type RejectionGuidanceModalProps = {
    isOpen: boolean;
    onClose: () => void;
    request: CampaignRequest | null;
    openCreateModal: () => void; // NEW
};

export default function RejectionGuidanceModal({
    isOpen,
    onClose,
    request,
    openCreateModal,
}: RejectionGuidanceModalProps) {

    if (!isOpen || !request) return null;

    const handleCreateNew = () => {
        onClose();          // close rejection modal
        openCreateModal();  // open create campaign modal in dashboard
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center backdrop-blur-md z-50">
            <div className="w-full max-w-2xl bg-white p-6 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <p className="text-xl font-bold text-slate-800">Campaign Rejection Guidance</p>
                    <button className="text-gray-500 hover:text-black" onClick={onClose}>✕</button>
                </div>

                <div className="text-sm text-slate-700 mb-6">
                    <div className="mb-4">
                        <h3 className="font-bold text-lg mb-2">
                            Your campaign "{request.name}" was rejected
                        </h3>

                        {request.rejectionReason && (
                            <div className="bg-red-50 p-3 rounded mb-4">
                                <strong>Reason for rejection:</strong> {request.rejectionReason}
                            </div>
                        )}
                    </div>

                    <div className="mb-4">
                        <h4 className="font-bold mb-2">How to improve your resubmission:</h4>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Ensure all information is accurate and complete</li>
                            <li>Provide clear, detailed descriptions of your campaign purpose</li>
                            <li>Upload high-quality, relevant images</li>
                            <li>Verify that your ID documents are clear and valid</li>
                            <li>Check that your campaign goal and timeline are realistic</li>
                        </ul>
                    </div>

                    <div className="mb-4">
                        <h4 className="font-bold mb-2">Notice:</h4>
                        <p className="text-red-600 font-bold mt-2">
                            You may create a new campaign under 24-hours with corrected details to be re-evaluated.
                        </p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 rounded shadow transition"
                    >
                        Close
                    </button>

                    <button
                        onClick={handleCreateNew}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded shadow transition"
                    >
                        Create New Campaign
                    </button>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState } from "react";

type NDAModalProps = {
  isOpen: boolean;
  onAccept: () => void;
};

export default function NDAModal({ isOpen, onAccept }: NDAModalProps) {
  const [accepted, setAccepted] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center backdrop-blur-md z-50">
      <div className="w-full max-w-2xl bg-white p-6 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <p className="text-xl font-bold text-slate-800">Non-Disclosure Agreement</p>
        </div>

        <div className="text-sm text-slate-700 mb-6">
          <p className="mb-4">
            By accessing this platform, you agree to the following terms:
          </p>

          <ul className="list-disc list-inside space-y-2">
            <li>You will not disclose any sensitive information shared on this platform.</li>
            <li>You will use the information solely for the purpose of supporting legitimate crowdfunding campaigns.</li>
            <li>You acknowledge that violation of this agreement may result in legal action.</li>
            <li>This agreement is binding and enforceable under applicable laws.</li>
          </ul>
        </div>

        <div className="flex items-center mb-6">
          <input
            type="checkbox"
            id="accept-nda"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="accept-nda" className="text-sm">
            I have read and agree to the Non-Disclosure Agreement.
          </label>
        </div>

        <button
          onClick={onAccept}
          disabled={!accepted}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded shadow transition"
        >
          Accept and Continue
        </button>
      </div>
    </div>
  );
}

"use client";

export default function DeleteActivityButton({ activityId: _activityId }: { activityId: string }) {
  void _activityId;

  return (
    <button 
      type="submit" 
      className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors"
    >
      Delete
    </button>
  );
}

"use client";

export default function DeleteActivityButton({ activityId }: { activityId: string }) {
  return (
    <button 
      type="submit" 
      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
      onClick={(e) => {
        if (!confirm('Are you sure you want to delete this activity?')) {
          e.preventDefault();
        }
      }}
    >
      Delete
    </button>
  );
}
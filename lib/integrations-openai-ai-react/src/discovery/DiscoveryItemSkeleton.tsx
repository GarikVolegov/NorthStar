/**
 * DiscoveryItemSkeleton — placeholder animato durante il caricamento.
 * Replicate il layout esatto di DiscoveryItemCard.
 */
import React from "react";

export const DiscoveryItemSkeleton: React.FC = () => (
  <div className="flex flex-col rounded-2xl border bg-white shadow-sm overflow-hidden animate-pulse">
    {/* Image placeholder */}
    <div className="h-36 w-full bg-gray-100" />
    <div className="flex flex-col gap-3 p-4">
      {/* Badges */}
      <div className="flex gap-2">
        <div className="h-5 w-20 rounded-full bg-gray-100" />
      </div>
      {/* Title */}
      <div className="space-y-1.5">
        <div className="h-3.5 w-full rounded bg-gray-100" />
        <div className="h-3.5 w-3/4 rounded bg-gray-100" />
      </div>
      {/* Insight */}
      <div className="h-3 w-5/6 rounded bg-indigo-50" />
      {/* Summary */}
      <div className="space-y-1">
        <div className="h-3 w-full rounded bg-gray-100" />
        <div className="h-3 w-2/3 rounded bg-gray-100" />
      </div>
      {/* Footer */}
      <div className="flex justify-between pt-2 border-t border-gray-100">
        <div className="h-3 w-16 rounded bg-gray-100" />
        <div className="flex gap-1.5">
          <div className="h-6 w-6 rounded-lg bg-gray-100" />
          <div className="h-6 w-6 rounded-lg bg-gray-100" />
        </div>
      </div>
    </div>
  </div>
);

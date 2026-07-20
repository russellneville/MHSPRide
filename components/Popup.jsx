"use client";
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { usePopup } from "@/context/PopupContext";

export function Popup() {
  const { isOpen, title , content, closePopup} = usePopup();

    if (!isOpen) return null;

  return (
    <div
      className="fixed w-full min-h-screen p-5 flex justify-center items-center top-0 inset-0 z-50 bg-black/50"
    >
      {/* Popup */}
      <div
        className="bg-background border shadow-lg rounded-lg w-4/5 sm:max-w-lg max-h-full overflow-y-auto"
      >
        {/* Popup Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button size="sm" variant="ghost" onClick={closePopup}>
            <X />
          </Button>
        </div>

        {/* Popup Content */}
        <div className="p-4">{content}</div>
      </div>
    </div>
  );
}

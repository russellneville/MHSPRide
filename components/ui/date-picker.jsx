import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from '@/components/ui/calendar';
import { Calendar1, ChevronDownIcon } from "lucide-react";
import { Button } from "./button";

export default function DatePicker({ id, date, setDate , disabled}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button id={id} variant='outline' className='w-full items-center justify-between'>
          <div className="flex items-center gap-2">
            <Calendar1 />
            {date ? date.toLocaleDateString() : "Select date"}
          </div>
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          captionLayout="dropdown"
          onSelect={(date) => setDate(date)}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}

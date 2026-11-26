import React, { useState, useEffect } from 'react';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Responsive dropdown: uses a Vaul bottom drawer on mobile (<= 767px) and
 * the shadcn Select popover on desktop. Props mirror a simplified Select API.
 *
 * options: [{ value, label }]
 */
export default function MobileDrawerSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select',
  title = 'Select',
  triggerClassName = '',
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className={`flex items-center justify-between w-full h-12 px-3 rounded-xl border border-input bg-background text-sm ${triggerClassName}`}
        >
          <span className={value ? 'text-gray-800' : 'text-gray-400'}>{selectedLabel}</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[70vh]">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6 pb-safe space-y-1">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`flex items-center justify-between w-full px-3 py-3 rounded-xl text-left text-sm ${
                o.value === value ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              {o.label}
              {o.value === value && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}